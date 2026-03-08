import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';

dotenv.config();

if (!process.env.GOOGLE_API_KEY) {
    console.error('Error: GOOGLE_API_KEY not found in .env file');
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

const ALLURE_RESULTS_DIR = path.join(process.cwd(), 'allure-results');
const AI_ANALYSIS_DIR = path.join(ALLURE_RESULTS_DIR, 'ai-analysis');

if (!fs.existsSync(AI_ANALYSIS_DIR)) {
    fs.mkdirSync(AI_ANALYSIS_DIR, { recursive: true });
}

function extractCodeContext(trace: string): string {
    if (!trace) return 'Code context is unavailable';

    const match = trace.match(/webpack:\/\/cypress\/\.\/(cypress\/e2e\/[^:]+):(\d+):/);
    if (!match) return 'Could not determine test file from stack trace';

    const relativeFilePath = match[1];
    const lineNumber = parseInt(match[2], 10);
    const absoluteFilePath = path.join(process.cwd(), relativeFilePath);

    if (!fs.existsSync(absoluteFilePath)) {
        return `File ${relativeFilePath} not found on disk`;
    }

    const fileContent = fs.readFileSync(absoluteFilePath, 'utf-8');
    const lines = fileContent.split('\n');

    const startLine = Math.max(0, lineNumber - 10);
    const endLine = Math.min(lines.length, lineNumber + 10);
    
    const codeSnippet = lines.slice(startLine, endLine).map((line, index) => {
        const currentLineNum = startLine + index + 1;
        const prefix = currentLineNum === lineNumber ? '>> ' : '   ';
        return `${prefix}${currentLineNum}: ${line}`;
    }).join('\n');

    return `File: ${relativeFilePath}\nCode around the error:\n\`\`\`typescript\n${codeSnippet}\n\`\`\``;
}

const now = new Date();
const timestamp = now.toISOString().replace(/T/, '_').replace(/\..+/, '').replace(/:/g, '-');
const mdFileName = `ai-report-${timestamp}.md`;
const mdFilePath = path.join(AI_ANALYSIS_DIR, mdFileName);

async function analyzeFailedTests() {
    console.log('Starting allure-results analysis...');

    if (!fs.existsSync(ALLURE_RESULTS_DIR)) {
        console.log('allure-results folder not found.');
        return;
    }

    const files = fs.readdirSync(ALLURE_RESULTS_DIR)
        .filter(file => file.endsWith('-result.json'));

    let fullReportContent = `# 🤖 AI Analysis General Report (${now.toLocaleString('en-US')})\n\n`;
    let hasFailedTests = false;

    for (const file of files) {
        const filePath = path.join(ALLURE_RESULTS_DIR, file);
        const testData = JSON.parse(fs.readFileSync(filePath, 'utf8'));

        if (testData.status === 'failed' || testData.status === 'broken') {
            hasFailedTests = true;
            console.log(`Failed test found: ${testData.name}`);
            
            const errorMessage = testData.statusDetails?.message || 'No error message provided';
            const errorTrace = testData.statusDetails?.trace || 'No stack trace provided';
            const codeContext = extractCodeContext(errorTrace);

            const prompt = `
            You are an experienced Senior QA Engineer specializing in Cypress and TypeScript. Your task is to analyze the failed test and provide a clear explanation of the root cause.
            Please respond entirely in English. Base your analysis strictly on the provided source code snippet.
            
            Test Name: ${testData.name}
            Error: ${errorMessage}
            Stack Trace: ${errorTrace}
            
            Test Code Context:
            ${codeContext}
            `;

            try {
                const result = await model.generateContent(prompt);
                const aiResponse = result.response.text();

                fullReportContent += `## ❌ Test: ${testData.name}\n\n`;
                fullReportContent += `${aiResponse}\n\n`;
                fullReportContent += `---\n\n`; 
                
                const relativeAttachmentPath = `ai-analysis/${mdFileName}`;
                if (!testData.attachments) testData.attachments = [];
                
                const alreadyAttached = testData.attachments.some((att: any) => att.name === '🤖 AI Debug Analysis (General)');
                
                if (!alreadyAttached) {
                    testData.attachments.push({
                        name: '🤖 AI Debug Analysis (General)',
                        type: 'text/markdown',
                        source: relativeAttachmentPath
                    });
                    
                    fs.writeFileSync(filePath, JSON.stringify(testData, null, 2));
                    console.log(`✅ Report link attached to test: ${testData.name}`);
                }

            } catch (error: any) {
                console.error(`❌ Error fetching Gemini response for test ${testData.name}:`, error.message);
                fullReportContent += `## ❌ Test: ${testData.name}\n\n**Analysis Error:** Failed to get a response from AI (${error.message})\n\n---\n\n`;
            }
        }
    }

    if (hasFailedTests) {
        fs.writeFileSync(mdFilePath, fullReportContent);
        console.log(`\n🎉 General AI report successfully saved to: ${mdFilePath}`);
    } else {
        console.log('No failed tests found. Report was not created.');
    }
    
    console.log('Analysis completed!');
}

analyzeFailedTests();