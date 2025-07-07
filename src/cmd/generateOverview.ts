import * as path from 'path';
import { initializeOpenAIModel } from '../utils/langchain';
import logger from '../utils/logger';
import {
  loadFilesFromDirectory,
  groupDocumentsBySource,
  generateFileSummary,
  readExistingOverview,
  writeOverviewToFile,
} from '../utils/fileProcessing';

export async function generateProjectOverview(
  targetDir: string,
  existingOverviewPath: string = path.resolve('overview.md'),
  apiKey: string
): Promise<string> {
  try {
    // Initialize OpenAI LLM
    const llm = initializeOpenAIModel(apiKey, 'gpt-4.1-mini');

    // Load all files from the target directory
    const allDocs = await loadFilesFromDirectory(targetDir);

    const filePaths = allDocs.map(doc => doc.metadata.source as string);

    // Group documents by source file
    const docsBySource = groupDocumentsBySource(allDocs);

    // Generate summaries for each file in parallel
    logger.info('Summarizing each file in parallel...');
    const summaryPromises = Object.entries(docsBySource).map(async ([src, docs]) => {
      const summary = await generateFileSummary(docs, llm);
      const relativePath = path.relative(process.cwd(), src);
      logger.info(`  • ${src} → ${summary.slice(0, 60).replace(/\n/g, ' ')}...`);
      return { filePath: relativePath, absolutePath: src, summary };
    });

    // Wait for all summaries to complete
    const fileSummaries = await Promise.all(summaryPromises);

    // Read existing overview
    logger.info('Merging summaries into overview.md...');
    const existing = readExistingOverview(existingOverviewPath);

    // 不直接判断哪些文件被移除，而是将所有路径提供给 LLM 进行判断
    logger.info(`Providing file paths to LLM for existence check`);

    // Construct integration prompt
    const combinePrompt = `
以下為指定目錄下完整檔案列表，請整理進檔案目錄 section
${filePaths.join('\n\n')}
    
以下是现有的 overview.md（用作基础）：
${existing}

下面是各个文件的最新精炼摘要：
${fileSummaries.map(fs => `### ${fs.filePath}\n完整路径: ${fs.absolutePath}\n${fs.summary}`).join('\n\n')}

请以"更新后的 overview.md"为格式，整合以上信息，新增或替换相应章节，以新摘要为主输出完整内容。确保移除已删除文件的条目。在每个文件的标题下方添加完整路径信息。
`;

    // Generate updated overview
    const updatedOverview = await llm.invoke(combinePrompt);

    // Write to overview.md
    writeOverviewToFile(existingOverviewPath, updatedOverview.text);
    logger.info(`overview.md 已更新 (${fileSummaries.length} 个文件摘要合并)`);

    return updatedOverview.text;
  } catch (error: any) {
    logger.error('生成项目概览时出错:', error);
    throw error;
  }
}
