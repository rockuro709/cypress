import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Marked } from 'marked';
import { markedHighlight } from 'marked-highlight';
import hljs from 'highlight.js';

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

const marked = new Marked(
    markedHighlight({
        langPrefix: 'hljs language-',
        highlight(code, lang) {
            const language = hljs.getLanguage(lang) ? lang : 'plaintext';
            return hljs.highlight(code, { language }).value;
        }
    })
);

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
const htmlFilePath = path.join(AI_ANALYSIS_DIR, 'index.html'); // Путь для HTML-отчета

const reportCSS = `
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; line-height: 1.6; color: #24292f; background-color: #ffffff; padding: 30px; max-width: 1012px; margin: 0 auto; }
    h1, h2, h3 { border-bottom: 1px solid #d0d7de; padding-bottom: .3em; margin-top: 24px; margin-bottom: 16px; }
    h1 { font-size: 2em; } h2 { font-size: 1.5em; color: #cf222e; } /* Красные заголовки для упавших тестов */
    a { color: #0969da; text-decoration: none; }
    code { font-family: ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, Liberation Mono, monospace; font-size: 85%; background-color: rgba(175, 184, 193, 0.2); padding: 0.2em 0.4em; border-radius: 6px; }
    pre { background-color: #f6f8fa; border-radius: 6px; padding: 16px; overflow: auto; }
    pre code { background-color: transparent; padding: 0; }
    blockquote { padding: 0 1em; color: #57606a; border-left: .25em solid #d0d7de; margin: 0; }
    hr { height: .25em; padding: 0; margin: 24px 0; background-color: #d0d7de; border: 0; }
    table { border-spacing: 0; border-collapse: collapse; width: 100%; margin-top: 0; margin-bottom: 16px; }
    table th, table td { padding: 6px 13px; border: 1px solid #d0d7de; }
    table tr:nth-child(2n) { background-color: #f6f8fa; }
    
    /* Стили для highlight.js (github-theme) */
    .hljs{color:#24292e;background:#ffffff}.hljs-doctag,.hljs-keyword,.hljs-meta .hljs-keyword,.hljs-template-tag,.hljs-template-variable,.hljs-type,.hljs-variable.language_{color:#d73a49}.hljs-title,.hljs-title.class_,.hljs-title.class_.inherited__,.hljs-title.function_{color:#6f42c1}.hljs-attr,.hljs-attribute,.hljs-literal,.hljs-meta,.hljs-number,.hljs-operator,.hljs-variable,.hljs-selector-attr,.hljs-selector-class,.hljs-selector-id{color:#005cc5}.hljs-regexp,.hljs-string,.hljs-meta .hljs-string{color:#032f62}.hljs-built_in,.hljs-symbol{color:#e36209}.hljs-comment,.hljs-code,.hljs-formula{color:#6a737d}.hljs-name,.hljs-quote,.hljs-selector-tag,.hljs-selector-pseudo{color:#22863a}.hljs-subst{color:#24292e}.hljs-section{color:#005cc5;font-weight:bold}.hljs-bullet{color:#735c0f}.hljs-emphasis{color:#24292e;font-style:italic}.hljs-strong{color:#24292e;font-weight:bold}.hljs-addition{color:#22863a;background-color:#f0fff4}.hljs-deletion{color:#b31d28;background-color:#ffeef0}
`;

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
            You are an expert Senior QA Automation Engineer. Analyze this failed Cypress test and provide a crystal-clear root cause analysis and a solution.
            
            **Formatting Rules:**
            - Respond ENTIRELY in English.
            - Use Markdown extensively (headings, bullet points, bold text).
            - Use emojis (e.g., 💡, 🔍, 🛠️, ❌) to make the text visually appealing and scannable.
            - Format any code examples using \`\`\`typescript blocks.
            - Provide a brief "Summary" blockquote at the beginning.
            
            Test Name: ${testData.name}
            Error: ${errorMessage}
            
            Test Code Context:
            ${codeContext}
            `;

            try {
                const result = await model.generateContent(prompt);
                const aiResponse = result.response.text();

                fullReportContent += `## ❌ Test: ${testData.name}\n\n`;
                fullReportContent += `**Error:** \`${errorMessage}\`\n\n`;
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
                fullReportContent += `## ❌ Test: ${testData.name}\n\n> ⚠️ **Analysis Error:** Failed to get a response from AI (${error.message})\n\n---\n\n`;
            }
        }
    }

    if (hasFailedTests) {
        fs.writeFileSync(mdFilePath, fullReportContent);
        
        const htmlContent = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>AI Test Analysis Report</title>
            <style>${reportCSS}</style>
        </head>
        <body>
            ${marked.parse(fullReportContent)}
        </body>
        </html>`;
        
        fs.writeFileSync(htmlFilePath, htmlContent);
        console.log(`\n🎉 General AI report successfully saved as Markdown and HTML!`);
    } else {
        console.log('No failed tests found. Report was not created.');
    }
    
    console.log('Analysis completed!');
}

analyzeFailedTests();