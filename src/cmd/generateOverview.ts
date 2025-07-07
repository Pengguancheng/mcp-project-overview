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

export async function generateProjectOverview(
  targetDir: string,
  existingOverviewPath: string = path.resolve('overview.md'),
  apiKey: string,
  summaryType: SummaryType = 'overview'
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
    logger.info(`Summarizing each file in parallel with type: ${summaryType}...`);
    const summaryPromises = Object.entries(docsBySource).map(async ([src, docs]) => {
      // 根据不同的摘要类型使用不同的提示词
      let summary;
      switch (summaryType) {
        case 'guidelines':
          summary = await generateFileSummary(docs, llm, {
            mapPrompt: '请分析以下代码，提取出使用指南、API调用方式和注意事项：\n\n{text}',
            combinePrompt: '请整合以下所有使用指南，形成一份完整的开发者指南文档：\n\n{text}',
          });
          break;
        case 'overview':
        default:
          summary = await generateFileSummary(docs, llm);
          break;
      }

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
    let combinePrompt = `
    请以"現有的 overview.md"为格式，整合以上信息，新摘要內容为主，新增或替换相应章节，移除在相同路徑下新摘要不存在的路徑文檔。在每个文件的标题下方添加完整路径信息。
    
    以下為指定目錄下完整檔案列表，請整理進檔案目錄 section
    ${filePaths.join('\n\n')}
        
    以下是现有的 overview.md（用作基础）：
    ${existing}
    
    下面是各个文件的最新精炼摘要：
    ${fileSummaries.map(fs => `### ${fs.filePath}\n完整路径: ${fs.absolutePath}\n${fs.summary}`).join('\n\n')}
    `;

    switch (summaryType) {
      case 'guidelines':
        combinePrompt = `
请根据以下要求，将以下两部分内容合并成一份**开发者使用指南**，同时兼顾开发规范与使用场景：

---
## 1. 文档来源
- **现有使用指南（existing）**
\`\`\`markdown
${existing}
\`\`\`
- **新增使用场景与步骤（newGuides）**
\`\`\`markdown
${fileSummaries.map(x => x.summary).join('\n\n')}
\`\`\`

## 2. 合并规范
1. **环境与客户端初始化**：数据库、消息队列、缓存等依赖的配置与启动示例。
2. **具体实现示例**：持久层实现（如 MongoDB）的代码示例：索引创建、TTL 策略、错误处理。
3. **典型使用场景与工作流**：初始化、依赖注入、CRUD 调用示例，以及事务/批处理流程。
4. **代码规范要素**：
   - **模型定义规范**：字段、类型及 Tag（JSON/BSON）命名规则与示例。
   - **仓储接口规范**：方法签名、参数、返回值及错误处理契约。
   - **命名约定与代码风格**：类/类型 PascalCase、变量/函数 camelCase、文件 kebab-case、Tag 命名。
   - **注释与文档**：清晰注释业务逻辑，自定义注释规范小节。
   - **错误处理**：统一抛错格式，自定义 Error 类及示例。
   - **示例代码与附录**：整合示例片段，附录中列出特殊日志及异常策略。
5. **单元测试与集成测试**：测试环境准备、数据清理及主要逻辑分支测试示例。
6. **运维与监控建议**：日志级别、埋点指标与报警策略，如 TTL 索引监控思路。
7. **文档一致性**：保持列表、表格、代码块格式，统一术语翻译。

请直接输出合并后的完整 **Markdown** 文档，不要包含其他说明文字。`;
        break;
      default:
        break;
    }

    // Generate updated overview
    const updatedOverview = await llm.invoke(combinePrompt);

    // 确定文件类型名称用于日志
    const fileTypeNames = {
      overview: '项目概览',
      guidelines: '开发者指南',
    };

    const fileTypeName = fileTypeNames[summaryType] || '项目文档';
    logger.info(`生成 ${fileTypeName} 文档完成`);

    // Write to overview.md
    writeOverviewToFile(existingOverviewPath, updatedOverview.text);

    const documentTypeMap = {
      overview: '项目概览',
      guidelines: '开发者指南',
    };

    logger.info(
      `${path.basename(existingOverviewPath)} 已更新 (${fileSummaries.length} 个文件的${documentTypeMap[summaryType] || '摘要'}已合并)`
    );

    return updatedOverview.text;
  } catch (error: any) {
    logger.error('生成项目概览时出错:', error);
    throw error;
  }
}