import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';

dotenv.config();

if (!process.env.GOOGLE_API_KEY) {
    console.error('Ошибка: Не найден GOOGLE_API_KEY в файле .env');
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

const ALLURE_RESULTS_DIR = path.join(process.cwd(), 'allure-results');
const AI_ANALYSIS_DIR = path.join(ALLURE_RESULTS_DIR, 'ai-analysis');

if (!fs.existsSync(AI_ANALYSIS_DIR)) {
    fs.mkdirSync(AI_ANALYSIS_DIR, { recursive: true });
}

// --- ФУНКЦИЯ ДЛЯ ИЗВЛЕЧЕНИЯ КОДА ---
function extractCodeContext(trace: string): string {
    if (!trace) return 'Код недоступен';

    const match = trace.match(/webpack:\/\/cypress\/\.\/(cypress\/e2e\/[^:]+):(\d+):/);
    if (!match) return 'Не удалось определить файл теста из стектрейса';

    const relativeFilePath = match[1];
    const lineNumber = parseInt(match[2], 10);
    const absoluteFilePath = path.join(process.cwd(), relativeFilePath);

    if (!fs.existsSync(absoluteFilePath)) {
        return `Файл ${relativeFilePath} не найден на диске`;
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

    return `Файл: ${relativeFilePath}\nКод вокруг ошибки:\n\`\`\`typescript\n${codeSnippet}\n\`\`\``;
}

// --- НОВАЯ ЛОГИКА ГЕНЕРАЦИИ ИМЕНИ ФАЙЛА ---
// Получаем текущую дату в формате YYYY-MM-DD_HH-mm-ss
const now = new Date();
const timestamp = now.toISOString().replace(/T/, '_').replace(/\..+/, '').replace(/:/g, '-');
const mdFileName = `ai-report-${timestamp}.md`;
const mdFilePath = path.join(AI_ANALYSIS_DIR, mdFileName);

async function analyzeFailedTests() {
    console.log('Начинаем анализ allure-results...');

    if (!fs.existsSync(ALLURE_RESULTS_DIR)) {
        console.log('Папка allure-results не найдена.');
        return;
    }

    const files = fs.readdirSync(ALLURE_RESULTS_DIR)
        .filter(file => file.endsWith('-result.json'));

    // Инициализируем содержимое будущего единого файла
    let fullReportContent = `# 🤖 Общий отчет AI-анализа (${now.toLocaleString('ru-RU')})\n\n`;
    let hasFailedTests = false;

    for (const file of files) {
        const filePath = path.join(ALLURE_RESULTS_DIR, file);
        const testData = JSON.parse(fs.readFileSync(filePath, 'utf8'));

        if (testData.status === 'failed' || testData.status === 'broken') {
            hasFailedTests = true;
            console.log(`Обнаружен упавший тест: ${testData.name}`);
            
            const errorMessage = testData.statusDetails?.message || 'Нет сообщения об ошибке';
            const errorTrace = testData.statusDetails?.trace || 'Нет стектрейса';
            const codeContext = extractCodeContext(errorTrace);

            const prompt = `
            Ты — опытный Senior QA Engineer, специалист по Cypress и TypeScript. Твоя задача — проанализировать упавший тест и дать чёткое объяснение причины.
            Опирайся на предоставленный фрагмент исходного кода теста.
            
            Название теста: ${testData.name}
            Ошибка: ${errorMessage}
            Стек вызовов: ${errorTrace}
            
            Контекст кода теста:
            ${codeContext}
            `;

            try {
                const result = await model.generateContent(prompt);
                const aiResponse = result.response.text();

                // Добавляем анализ конкретного теста в общую строку
                fullReportContent += `## ❌ Тест: ${testData.name}\n\n`;
                fullReportContent += `${aiResponse}\n\n`;
                fullReportContent += `---\n\n`; // Визуальный разделитель между тестами
                
                // Добавляем ссылку на этот общий файл в JSON теста
                const relativeAttachmentPath = `ai-analysis/${mdFileName}`;
                if (!testData.attachments) testData.attachments = [];
                
                const alreadyAttached = testData.attachments.some((att: any) => att.name === '🤖 AI Debug Analysis (Общий)');
                
                if (!alreadyAttached) {
                    testData.attachments.push({
                        name: '🤖 AI Debug Analysis (Общий)',
                        type: 'text/markdown',
                        source: relativeAttachmentPath
                    });
                    
                    fs.writeFileSync(filePath, JSON.stringify(testData, null, 2));
                    console.log(`✅ Ссылка на отчет добавлена к тесту ${testData.name}`);
                }

            } catch (error: any) {
                console.error(`❌ Ошибка при обращении к Gemini для теста ${testData.name}:`, error.message);
                fullReportContent += `## ❌ Тест: ${testData.name}\n\n**Ошибка анализа:** Не удалось получить ответ от ИИ (${error.message})\n\n---\n\n`;
            }
        }
    }

    // Сохраняем собранный текст в один файл в самом конце
    if (hasFailedTests) {
        fs.writeFileSync(mdFilePath, fullReportContent);
        console.log(`\n🎉 Общий отчет успешно сохранен: ${mdFilePath}`);
    } else {
        console.log('Упавших тестов не найдено, отчет не создавался.');
    }
    
    console.log('Анализ завершен!');
}

analyzeFailedTests();