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
import { Overview, OverviewType } from '../domain/model/overview';
import { CodeOverviewCtx } from '../procedure/code-overview/codeOverviewCtx';
import { Procedure } from '../procedure/procedure';
import { UpdateChromaProcess } from '../procedure/code-overview/updateChromaProcess';
import * as fs from 'fs';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import {
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  PromptTemplate,
} from '@langchain/core/prompts';
import { HumanMessage } from '@langchain/core/messages';

// 定义 Overview schema
export const OVERVIEW_SCHEMA = {
  text: z.string().describe('文檔內容，應包含類或函數的摘要和使用方式'),
  type: z.enum(['class', 'interface', 'function']).describe('文檔類型，可以是類、接口或函數'),
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
  summary: z.string().describe('文檔的內文摘要'),
  references: z
    .array(z.string())
    .optional()
    .describe('被該檔案引用的元素列表，可包含檔案路徑、命名空間、類別名稱或導入路徑'),
};

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
): Promise<Overview> {
  try {
    // Initialize OpenAI LLM
    const llm = initializeOpenAIModel(apiKey, 'gpt-4.1-mini');

    // Read file content
    const fileContent = fs.readFileSync(filePath, 'utf8');

    logger.info(`正在分析檔案: ${filePath}`);

    // 創建 Zod schema 對象
    const zodSchema = z.object(OVERVIEW_SCHEMA);
    const jsonSchema = zodToJsonSchema(zodSchema); // <- 重要

    const response = await llm.withStructuredOutput(jsonSchema).invoke(` 
請分析以下檔案內容，並將其整理成結構化的 overview 格式。

檔案路徑: ${filePath}
專案名稱: ${projectName}
檔案內容:
${fileContent}
`);

    logger.info(`LLM 響應: ${response}`);

    // 使用 Zod schema 驗證解析的結果
    const validatedSchema = zodSchema.parse(response);

    // 創建並返回 Overview 對象
    const overview = new Overview(
      validatedSchema.name,
      validatedSchema.text,
      projectName,
      validatedSchema.references || [],
      validatedSchema.type as OverviewType,
      validatedSchema.filePath,
      validatedSchema.summary
    );

    logger.info(`成功生成 overview 對象: ${overview.id}`);

    return overview;
  } catch (error: any) {
    logger.error('生成檔案 overview 時出錯:', error);
    throw error;
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
    const overviews = await Promise.all(summaryPromises);

    // 初始化 CodeOverviewCtx
    const ctx = await CodeOverviewCtx.from(projectName, apiKey);

    // 将 Overview 对象添加到 ctx 中
    for (const overview of overviews) {
      ctx.addOverview(overview);
    }

    // 执行 UpdateChromaProcess 将 Overview 对象存储到 Chroma 中
    const pro = Procedure.new(ctx);
    await pro.execute(new UpdateChromaProcess());
    if (pro.isErr()) {
      logger.error('Error storing file summaries in Chroma:', pro.getErr());
    } else {
      logger.info(`Successfully stored ${overviews.length} file summaries in Chroma`);
    }

    logger.info('Finish storing file summaries in Chroma...');
  } catch (error: any) {
    logger.error('生成项目概览时出错:', error);
    throw error;
  }
}
