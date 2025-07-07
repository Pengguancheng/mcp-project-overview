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

// 定义不同的摘要类型
export type SummaryType = 'overview' | 'guidelines';

/**
 * 生成项目概览文档
 * @param targetDir 目标目录
 * @param existingOverviewPath 现有概览文档路径
 * @param apiKey OpenAI API 密钥
 * @param summaryType 摘要类型（已废弃，保留参数兼容旧代码）
 * @returns 生成的概览文档内容
 */
export async function generateProjectOverview(
  targetDir: string,
  existingOverviewPath: string = path.resolve('overview.md'),
  apiKey: string,
  summaryType?: SummaryType
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
    logger.info(`Summarizing each file in parallel for overview...`);
    const summaryPromises = Object.entries(docsBySource).map(async ([src, docs]) => {
      // 使用默认提示词生成概览摘要
      const summary = await generateFileSummary(docs, llm, {
        mapPrompt: '提炼每个文件或模块的核心功能和可复用代码要点，帮助不熟悉项目的人快速了解',
      });

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

    // Construct integration prompt for overview
    const combinePrompt = `
你是一位资深后端架构师，负责整理一份面向团队的 project overview
请根据现有的 overview.md 结构，生成更新后的项目概览，要求如下：

1. **目录结构**：以 Markdown 格式输出项目目录，列出文件和文件夹，并在每一项前添加完整路径。
2. **精简描述**：在“概览”章节中，使用不超过三行的简洁语言，提炼每个文件或模块的核心功能和可复用代码要点，帮助不熟悉项目的人快速了解。
3. **基础内容**：以现有 overview.md 为基础，保留有效内容，优先用最新摘要更新对应章节；若目標資料夾下的文件不在最新摘要中，则从目录移除该章节。
4. **路径信息**：在每个文件标题下方插入完整路径，格式：path：绝对路径

---
## 此次讀取目標資料夾

${targetDir}

## 此次讀取檔案

${filePaths.map(p => `- \`${p}\``).join('\n')}

---

## 现有 overview.md

${existing}

---

## 各文件精炼摘要

${fileSummaries
  .map(
    fs => `### ${fs.filePath}
路径：${fs.absolutePath}
${fs.summary}`
  )
  .join('\n\n')}

`;

    // Generate updated overview
    const updatedOverview = await llm.invoke(combinePrompt);

    // 记录日志
    logger.info(`生成项目概览文档完成`);

    // Write to overview.md
    writeOverviewToFile(existingOverviewPath, updatedOverview.text);

    logger.info(
      `${path.basename(existingOverviewPath)} 已更新 (${fileSummaries.length} 个文件的项目概览已合并)`
    );

    return updatedOverview.text;
  } catch (error: any) {
    logger.error('生成项目概览时出错:', error);
    throw error;
  }
}
