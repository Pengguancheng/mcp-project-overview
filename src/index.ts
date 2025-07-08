import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { initializeOpenAIEmbeddings } from './utils/langchain';
import {
  clearChromaCollection,
  initializeChromaStore,
  searchSimilarDocuments,
} from './utils/chroma';
import logger from './utils/logger';
import { generateProjectOverview } from './cmd/generateOverview';
import * as path from 'path';
import { generateProjectGuidelines } from './cmd/generateProjectGuidelines';
import { Overview, OverviewType } from './domain/model/overview';
import { CodeOverviewCtx } from './procedure/code-overview/codeOverviewCtx';
import { Procedure } from './procedure/procedure';
import { UpdateChromaProcess } from './procedure/code-overview/updateChromaProcess';

// Get OpenAI API key from environment variable
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
if (!OPENAI_API_KEY) {
  logger.warn(
    'Warning: OPENAI_API_KEY not provided. Use --openai-api-key parameter. LangChain features will not work properly.'
  );
}

const PROJECT_NAME = process.env.PROJECT_NAME || '';
if (!PROJECT_NAME) {
  logger.warn('Warning: PROJECT_NAME not provided.');
}

// 1. 建立 MCP Server
const server = new McpServer({
  name: 'project-overview-server',
  version: '1.0.0',
  title: '项目概览与分析服务器',
  description:
    '基于Model Context Protocol (MCP)的代码项目分析工具，支持项目结构分析、文件内容分析以及通过Chroma向量数据库进行语义搜索',
});
// 4. 註冊一個用於添加文檔到 Chroma 的 Tool
server.registerTool(
  'vector-add',
  {
    title: 'Vector Add',
    description:
      '將代碼文檔添加到向量數據庫。使用此工具存儲類和函數的文檔信息，包括其名稱、命名空間、類型(class/interface/function)以及使用方法描述。references 參數用於記錄被該檔案引用的其他檔案、類別或路徑。範例：{"type":"class", "name":"UserRepository", "namespace":"app.repositories", "text":"負責用戶數據的CRUD操作...", "projectName":"my-project", "filePath":"/path/to/file.ts", "references":["src/models/User.ts", "app.services.Database", "@langchain/core"]}',
    inputSchema: {
      text: z.string().describe('文檔內容，應包含類或函數的摘要和使用方式'),
      type: z.enum(['class', 'interface', 'function']).describe('文檔類型，可以是類、接口或函數'),
      name: z
        .string()
        .describe(
          '類或函數的完整名稱 ex: model.Video, VideoSystem.Domain.Repository.UserRepository'
        ),
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
    },
  },
  async param => {
    try {
      logger.info(`vector-add: received params: ${JSON.stringify(param)}`);

      // Initialize OpenAI embeddings
      const embeddings = initializeOpenAIEmbeddings(OPENAI_API_KEY);

      logger.info(`vector-add: initializing Chroma store for project: ${PROJECT_NAME}`);

      // Create an Overview instance
      const overview = new Overview(
        param.name,
        param.text,
        PROJECT_NAME,
        param.references || [],
        param.type as OverviewType,
        param.filePath,
        param.summary
      );

      const ctx = await CodeOverviewCtx.from(PROJECT_NAME, OPENAI_API_KEY);
      ctx.addOverview(overview);

      const pro = Procedure.new(ctx);
      await pro.execute(new UpdateChromaProcess());
      if (pro.isErr()) {
        throw pro.getErr()!;
      }

      return {
        content: [
          {
            type: 'text',
            text: `Overview ${param.filePath ? 'upserted' : 'added'} to vector database successfully. ID: ${overview.id}`,
          },
        ],
      };
    } catch (error: any) {
      logger.error('Chroma add error:', error);
      return {
        content: [{ type: 'text', text: `Error: ${error?.message || 'Unknown error occurred'}` }],
      };
    }
  }
);

// 5. 註冊一個用於搜索 Chroma 的 Tool
server.registerTool(
  'vector-search',
  {
    title: 'Vector Search',
    description:
      '通過語義搜索查找代碼文檔。您可以使用文本查詢搜索相似文檔，也可以按類型(class/interface/function)、名稱和命名空間進行過濾。範例1(基本搜索)：{"query":"如何處理用戶驗證", "projectName":"my-project"}。範例2(過濾搜索)：{"query":"數據庫操作", "type":"class", "namespace":"app.repositories", "projectName":"my-project"}',
    inputSchema: {
      query: z.string().describe('搜索查詢'),
      type: z.enum(['class', 'interface', 'function']).optional().describe('過濾文檔類型'),
      name: z.string().optional().describe('過濾類或函數名稱'),
      namespace: z.string().optional().describe('過濾命名空間或路徑'),
    },
  },
  async param => {
    try {
      logger.info(`vector-search: received params: ${JSON.stringify(param)}`);

      // Initialize OpenAI embeddings
      const embeddings = initializeOpenAIEmbeddings(OPENAI_API_KEY);

      logger.info(`vector-search: initializing Chroma store for project: ${PROJECT_NAME}`);

      // Initialize Chroma store with project name as collection name
      const chromaStore = await initializeChromaStore(embeddings, PROJECT_NAME);

      logger.info(`vector-search: searching similar documents for query: "${param.query}"`);
      // Search for similar documents
      const results = await searchSimilarDocuments(chromaStore, param.query);

      logger.info(`vector-search: found ${results.length} results in collection "${PROJECT_NAME}"`);

      return {
        content: [
          { type: 'text', text: 'Search results:' },
          { type: 'text', text: JSON.stringify(results, null, 2) },
        ],
      };
    } catch (error: any) {
      logger.error('Chroma search error:', error);
      return {
        content: [{ type: 'text', text: `Error: ${error?.message || 'Unknown error occurred'}` }],
      };
    }
  }
);

// 6. 註冊一個用於生成項目概覽的 Tool
server.registerTool(
  'summary-code',
  {
    title: 'Summary Project Code',
    description:
      '生成项目概览文档。此工具会分析指定目录下的所有源代码文件，为每个文件生成摘要，并将这些摘要整合到一个文档中。支持不同类型的摘要：overview（项目概览）、guidelines（开发指南）。例如：{"projectDir":"/path/to/project", "targetDir":"src", "outputFile":"docs/overview.md", "summaryType":"guidelines"}',
    inputSchema: {
      projectDir: z.string().describe('项目根目录的絕對路径'),
      targetDir: z.string().describe('要分析的目标目录（相对于项目根目录的路径）'),
      outputFile: z
        .string()
        .optional()
        .describe('概览文档的输出路径（相对于项目根目录的路径），默认为项目根目录下的overview.md'),
      summaryType: z
        .enum(['overview', 'guidelines'])
        .default('overview')
        .describe('摘要类型：overview（项目概览）、guidelines（开发指南）'),
    },
  },
  async param => {
    try {
      if (!OPENAI_API_KEY) {
        return {
          content: [
            {
              type: 'text',
              text: 'Error: OpenAI API key not set. Please set the OPENAI_API_KEY environment variable.',
            },
          ],
        };
      }

      logger.info(`generate-overview: received params: ${JSON.stringify(param)}`);

      // Resolve project directory as absolute path
      const projectDir = path.resolve(param.projectDir);

      // Resolve target directory relative to project directory
      const targetDir = path.resolve(projectDir, param.targetDir);

      // Resolve output file path relative to project directory
      const outputFile = param.outputFile
        ? path.resolve(projectDir, param.outputFile)
        : path.resolve(projectDir, 'overview.md');

      logger.info(`generate-overview: analyzing directory ${targetDir}, output to ${outputFile}`);

      // 根据摘要类型选择不同的生成函数
      if (param.summaryType === 'guidelines') {
        await generateProjectGuidelines(
          projectDir,
          param.targetDir,
          outputFile,
          OPENAI_API_KEY
        ).catch(error => {
          logger.error('Generate guidelines error:', error);
        });
      } else {
        await generateProjectOverview(
          projectDir,
          param.targetDir,
          OPENAI_API_KEY,
          PROJECT_NAME
        ).catch(error => {
          logger.error('Generate overview error:', error);
        });
      }

      return {
        content: [
          {
            type: 'text',
            text: `项目${param.summaryType === 'guidelines' ? '开发者指南' : '概览'}文档生成成功，已保存至 ${outputFile}`,
          },
        ],
      };
    } catch (error: any) {
      logger.error('Generate overview error:', error);
      return {
        content: [{ type: 'text', text: `Error: ${error?.message || 'Unknown error occurred'}` }],
      };
    }
  }
);

// 7. 註冊一個用於清除 Chroma 集合的 Tool
server.registerTool(
  'vector-clear',
  {
    title: 'Clear Vector Collection',
    description:
      '清除指定项目名称的向量数据库集合。此工具会删除与项目关联的所有向量数据。例如：{"projectName":"my-project"}',
    inputSchema: {
      projectName: z.string().optional().describe('要清除的项目名称（对应于Chroma集合名称）'),
    },
  },
  async param => {
    try {
      logger.info(`vector-clear: received params: ${JSON.stringify(param)}`);

      await clearChromaCollection(param.projectName ?? PROJECT_NAME);

      return {
        content: [
          {
            type: 'text',
            text: `成功清除项目 "${param.projectName}" 的向量数据库集合`,
          },
        ],
      };
    } catch (error: any) {
      logger.error('Chroma clear error:', error);
      return {
        content: [{ type: 'text', text: `Error: ${error?.message || 'Unknown error occurred'}` }],
      };
    }
  }
);

// 8. 使用 stdio transport 接收與回應，並添加認證
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(err => {
  logger.error('伺服器啟動失敗：', err);
  process.exit(1);
});
