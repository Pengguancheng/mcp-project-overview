import path from 'path';
import { initializeOpenAIModel } from '../utils/langchain';
import {
  generateFileSummary,
  groupDocumentsBySource,
  loadFilesFromDirectory,
  readExistingOverview,
  writeOverviewToFile,
} from '../utils/fileProcessing';
import logger from '../utils/logger';

/**
 * 生成项目开发者指南文档
 * @param targetDir 目标目录
 * @param existingGuidelinesPath 现有指南文档路径
 * @param apiKey OpenAI API 密钥
 * @returns 生成的指南文档内容
 */
export async function generateProjectGuidelines(
  targetDir: string,
  existingGuidelinesPath: string = path.resolve('guidelines.md'),
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
    logger.info(`Summarizing each file in parallel for guidelines...`);
    const summaryPromises = Object.entries(docsBySource).map(async ([src, docs]) => {
      // 第一步：针对单个文件摘要，按类别提取规范与示例
      const summary = await generateFileSummary(docs, llm, {
        mapPrompt: `
请分析以下代码文件，并按照“接口分类”提取关键信息和示例，输出 JSON 数组，格式如下：
[
  {
    "category": "Repository",
    "purpose": "说明此接口或类的职责",
    "usage": "调用示例代码",
    "notes": "注意事项，如错误处理、事务等"
  },
  {
    "category": "Domain Model",
    "purpose": "...",
    "usage": "...",
    "notes": "..."
  },
  ...
]
  
代码内容：
{text}
`,
      });

      const relativePath = path.relative(process.cwd(), src);
      logger.info(`  • ${src} → ${summary.slice(0, 60).replace(/\n/g, ' ')}...`);
      return { filePath: relativePath, absolutePath: src, summary };
    });

    // Wait for all summaries to complete
    const fileSummaries = await Promise.all(summaryPromises);

    // Read existing guidelines
    logger.info('Merging summaries into guidelines.md...');
    const existing = readExistingOverview(existingGuidelinesPath);

    // 不直接判断哪些文件被移除，而是将所有路径提供给 LLM 进行判断
    logger.info(`Providing file paths to LLM for existence check`);

    // 第二步：合并所有文件的摘要，生成统一的开发者使用指南
    const combinePrompt = `
你是一位资深后端架构师，负责整理一份面向团队的**开发者使用指南（Developer Guide）**。  
请根据以下结构，将所有 map 阶段输出的 JSON 摘要合并，并补充必要的说明与示例，最终输出完整的 Markdown 文档，不带其他多余文字。

# 开发者使用指南

## 1. 接口分类总览
为每个分类（如 Repository、Domain Model、Procedure、Context、gRPC Server 等）生成一个简要目录。

## 2. 分类规范详述
对每个分类分别按以下小节编写：
- **职责说明**：该层/接口在整体架构中的作用和定位。
- **初始化与配置**：依赖注入、环境变量、客户端或服务器启动示例。
- **核心方法与调用示例**：重点列出关键方法签名、参数说明及调用示例代码块。
- **错误处理与日志**：统一错误抛出规范、日志级别与格式范例。
- **性能与监控建议**：如索引策略、缓存配置、埋点指标等。

## 3. 代码风格与命名约定
- 类与接口：PascalCase
- 方法与变量：camelCase
- 文件与包：kebab-case
- 数据模型字段：snake_case 或 JSON/BSON Tag 规则

## 4. 注释与文档规范
- 公共 API 注释使用 Javadoc/Swagger 格式
- 业务逻辑注释须清晰说明「为什么」和「如何做」

## 5. 测试策略
- 单元测试：示例、测试覆盖度目标
- 集成测试：如何准备环境、清理数据

## 6. 运维与监控
- 日志采集与聚合
- 异常报警与健康检查

## 7. 附录
- 常见错误及排查指南
- 代码片段汇总

以下是 原有的 guideline.md
${existing}

以下是 map 阶段生成的 JSON 摘要，请插入到相应章节：
\`\`\`json
${fileSummaries.map(x => x.summary).join(',\n')}
\`\`\`

请直接输出符合上述结构的 Markdown 文档。  
`;

    // Generate updated guidelines
    const updatedGuidelines = await llm.invoke(combinePrompt);

    // 记录日志
    logger.info(`生成开发者指南文档完成`);

    // Write to guidelines.md
    writeOverviewToFile(existingGuidelinesPath, updatedGuidelines.text);

    logger.info(
      `${path.basename(existingGuidelinesPath)} 已更新 (${fileSummaries.length} 个文件的开发者指南已合并)`
    );

    return updatedGuidelines.text;
  } catch (error: any) {
    logger.error('生成开发者指南时出错:', error);
    throw error;
  }
}
