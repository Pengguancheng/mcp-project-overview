import * as path from 'path';
import { initializeOpenAIModel } from '../utils/langchain';
import logger from '../utils/logger';
import { groupDocumentsBySource, loadFilesFromDirectory } from '../utils/fileProcessing';
import { Overview, OverviewType } from '../domain/model/overview';
import { CodeOverviewCtx } from '../procedure/code-overview/codeOverviewCtx';
import { Procedure } from '../procedure/procedure';
import { UpdateChromaProcess } from '../procedure/code-overview/updateChromaProcess';
import * as fs from 'fs';
import { z, ZodRawShape } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

// 定义 Overview schema
export const OVERVIEW_SCHEMA: ZodRawShape = {
  text: z
    .string()
    .describe(
      '類別、接口或函數的說明文，需包含清楚的功能摘要、用途介紹，以及常見的使用情境範例，內容不可為空。應讓讀者僅憑該欄即可理解此程式的作用與基本用法。'
    ),
  type: z.string().describe('程式類型，可以是類、接口或函數 ex: class, interface, function'),
  name: z
    .string()
    .describe('類或函數的完整名稱 ex: model.Video, VideoSystem.Domain.Repository.UserRepository'),
  namespace: z
    .string()
    .optional()
    .describe('類或函數的命名空間或路徑 ex: repository, VideoSystem.Domain.Repository'),
  filePath: z
    .string()
    .describe(
      '項目內檔案路徑，作為文檔的唯一標識符，如果提供則會覆蓋同路徑的文檔 ex: project: strategy-summary, path: strategy-summary/domain/repository/overview_summary.go'
    ),
  summary: z
    .string()
    .describe(
      '此類別、接口或函數的重點摘要，應用簡要語句清楚說明其核心功能與設計目的。內容不可為空。'
    ),
  references: z
    .array(z.string())
    .optional()
    .describe('被該程式檔案引用的元素列表，可包含檔案路徑、命名空間、類別名稱或導入路徑'),
};

// 收集 schema 各欄位說明
function extractFieldDescriptions(schema: any): Record<string, string> {
  const descs: Record<string, string> = {};
  for (const key in schema) {
    if (schema[key]?.description) {
      descs[key] = schema[key].description;
    } else if (typeof schema[key]?._def?.description === 'string') {
      descs[key] = schema[key]._def.description;
    }
  }
  return descs;
}

// 動態組 prompt 範本
function generateOverviewPrompt(): string {
  const fieldDescs = extractFieldDescriptions(OVERVIEW_SCHEMA);
  return `
你是一个专业的代码文档分析助手。请根据以下字段规则，为指定的代码生成结构化概览：

${Object.entries(fieldDescs)
  .map(([field, desc]) => `**${field}**: ${desc}`)
  .join('\n\n')}

**重要要求：**
1. 所有描述都应该从开发者的角度出发，说明代码的实际用途
2. 避免为单个属性、字段或配置项生成 overview
3. 重点关注可复用的代码实体：类、接口、重要函数等
4. 使用清晰、专业的技术语言
5. 包含足够的上下文信息，让其他开发者能快速理解代码用途

**输出格式要求：**
- 请将结果包装在 overviews 数组中
- 每个代码实体生成一个独立的 overview 对象
- 确保所有必填字段都有内容，且内容有意义
`;
}

/**
 * 使用 LLM 將檔案整理成 overview 格式
 * @param apiKey OpenAI API 密鑰
 * @param projectName 專案名稱
 * @param filePath 檔案路徑
 * @returns Overview 對象
 */
export async function generateFileOverview(
  apiKey: string,
  projectName: string,
  filePath: string
): Promise<Overview[]> {
  try {
    // Initialize OpenAI LLM
    const llm = initializeOpenAIModel(apiKey, 'gpt-4.1-nano');

    // Read file content
    const fileContent = fs.readFileSync(filePath, 'utf8');

    logger.info(`正在分析檔案: ${filePath}`);

    // 創建 Zod schema 對象
    const zodSchema = z.object({ overviews: z.array(z.object(OVERVIEW_SCHEMA)) });
    const jsonSchema = zodToJsonSchema(zodSchema); // <- 重要

    const prompt = ` 
請分析以下檔案內容，並將其整理成結構化的 overviews 格式。 
檔案路徑: ${filePath}
專案名稱: ${projectName}
檔案內容:
${fileContent.trim()}

${generateOverviewPrompt()}
`;
    logger.info(`LLM prompt: ${prompt}`);

    const response = await llm.withStructuredOutput(jsonSchema).invoke(prompt);

    logger.info(`LLM 響應: ${JSON.stringify(response)}`);

    // 使用 Zod schema 驗證解析的結果
    const validatedSchema = zodSchema.parse(response);

    // 創建並返回 Overview 對象

    return validatedSchema.overviews.map(schema => {
      const overview = new Overview(
        schema.name,
        schema.text,
        projectName,
        schema.references || [],
        schema.type as OverviewType,
        schema.filePath,
        schema.summary
      );

      logger.info(`成功生成 overview 對象: ${overview.id}`);
      return overview;
    });
  } catch (error: any) {
    logger.error('生成檔案 overview 時出錯:', error);
    return [];
  }
}

export async function generateProjectOverview(
  projectDir: string,
  targetDir: string,
  apiKey: string,
  projectName: string
): Promise<void> {
  try {
    // Resolve target directory as absolute path
    const absoluteTargetDir = path.resolve(projectDir, targetDir);

    // Load all files from the target directory
    const allDocs = await loadFilesFromDirectory(absoluteTargetDir);

    // Group documents by source file
    const docsBySource = groupDocumentsBySource(allDocs);

    // Generate summaries for each file in parallel
    logger.info(`Summarizing each file in parallel for overview...`);
    const summaryPromises = Object.entries(docsBySource).map(async ([src, docs]) => {
      return await generateFileOverview(apiKey, projectName, src);
    });

    // Wait for all summaries to complete
    const overviewResponse = await Promise.all(summaryPromises);

    // 初始化 CodeOverviewCtx
    const ctx = await CodeOverviewCtx.from(projectName, apiKey);

    // 将 Overview 对象添加到 ctx 中
    for (const overviewList of overviewResponse) {
      if (overviewList.length === 0) {
        continue;
      }
      ctx.addOverview(overviewList);
    }

    // 执行 UpdateChromaProcess 将 Overview 对象存储到 Chroma 中
    const pro = Procedure.new(ctx);
    await pro.execute(new UpdateChromaProcess());
    if (pro.isErr()) {
      logger.error('Error storing file summaries in Chroma:', pro.getErr());
    } else {
      logger.info(`Successfully stored ${overviewResponse.length} file summaries in Chroma`);
    }

    logger.info('Finish storing file summaries in Chroma...');
  } catch (error: any) {
    logger.error('生成项目概览时出错:', error);
    throw error;
  }
}
