import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { initializeOpenAIEmbeddings } from './utils/langchain';
import {
  clearChromaCollection,
  initializeChromaStore,
  searchSimilarDocuments,
} from './utils/chroma';
import logger from './utils/logger';
import { generateProjectOverview, OVERVIEW_SCHEMA } from './cmd/generateOverview';
import * as path from 'path';
import { Overview, OverviewType } from './domain/model/overview';
import { CodeOverviewCtx } from './procedure/code-overview/codeOverviewCtx';
import { Procedure } from './procedure/procedure';
import { UpdateChromaProcess } from './procedure/code-overview/updateChromaProcess';
import * as querystring from 'node:querystring';
import { buildVectorSearchFilter, formatSearchResults } from './query/vector-search';

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
    inputSchema: OVERVIEW_SCHEMA,
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
      ctx.addOverview([overview]);

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
      '執行語意搜尋，可依型別、名稱、命名空間與引用關係過濾結果。支持自然语言查询来搜索相关的类、函数、接口等代码实体。可以按以下方式使用：\n' +
      '1. 自然语言查询：{"query":"用户认证相关的代码", "projectName":"my-project"}\n' +
      '2. 功能性查询：{"query":"数据库操作", "projectName":"my-project"}\n' +
      '3. 特定类型查询：{"query":"视频处理", "type":"class", "projectName":"my-project"}\n' +
      '4. 命名空间过滤：{"query":"仓储模式", "namespace":"repository", "projectName":"my-project"}\n' +
      '5. 引用關係過濾：{"query":"用戶管理", "references":["src/models/User.ts", "app.services.Database"], "projectName":"my-project"}\n' +
      '支持的查询类型包括：功能描述、设计模式、技术实现、业务逻辑等。',
    inputSchema: {
      query: z.string().describe('自然语言搜索查询，可以是功能描述、技术关键词或业务需求'),
      type: z
        .string()
        .optional()
        .describe('过滤代码实体类型：class(类)、interface(接口)、function(函数)'),
      name: z.string().optional().describe('过滤特定的类名或函数名'),
      namespace: z.string().optional().describe('过滤特定的命名空间、包名或目录路径'),
      references: z
        .array(z.string())
        .optional()
        .describe('引用關係過濾，可指定多個引用元素，例如檔案路徑、命名空間、類別名稱或導入路徑'),
      limit: z.number().optional().default(5).describe('返回結果數量限制，預設為 5'),
    },
  },
  async param => {
    try {
      logger.info(`vector-search: received params: ${JSON.stringify(param)}`);
      const { query, type, name, namespace, references, limit = 5 } = param;
      const projectName = PROJECT_NAME;

      // 初始化 ChromaDB 連接
      const ctx = await CodeOverviewCtx.from(projectName, OPENAI_API_KEY);

      if (!ctx.chroma) {
        return {
          content: [
            {
              type: 'text',
              text: 'ChromaDB 連接失敗，請確認服務是否啟動',
            },
          ],
        };
      }

      // 構建查詢過濾器
      const filter = buildVectorSearchFilter({
        type,
        name,
        namespace,
        references,
        projectName,
      });

      // 執行語意搜尋
      const results = await searchSimilarDocuments(ctx.chroma, query, limit, filter);

      // 格式化結果
      const formattedResults = formatSearchResults(results);

      return {
        content: [
          {
            type: 'text',
            text: `找到 ${results.length} 個相關結果：\n\n${formattedResults}`,
          },
        ],
      };
    } catch (error) {
      logger.error('向量搜尋錯誤:', (error as any).message);
      return {
        content: [
          {
            type: 'text',
            text: `搜尋失敗: ${(error as any).message}`,
          },
        ],
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
        .enum(['overview'])
        .default('overview')
        .describe('摘要类型：overview（项目概览）'),
      ignoreDirs: z
        .array(z.string())
        .optional()
        .describe('要忽略的目录或文件模式列表，例如 ["**/node_modules/**", "**/*.pb.go"]'),
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

      // 生成项目概览
      const ignoreDirs = [
        ...(param.ignoreDirs ?? []),
        '**/node_modules/**',
        '**/dist/**',
        '**/build/**',
        '**/.git/**',
        '**/*.pb.go',
      ];
      await generateProjectOverview(
        projectDir,
        param.targetDir,
        OPENAI_API_KEY,
        PROJECT_NAME,
        ignoreDirs
      ).catch(error => {
        logger.error('Generate overview error:', error);
      });

      return {
        content: [
          {
            type: 'text',
            text: `项目概览文档生成成功，已保存至 ${outputFile}`,
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

server.registerResource(
  'query-project-vector-resource',
  new ResourceTemplate('chroma://query/{queryString}', { list: undefined }),
  {
    title: '项目代码智能查询资源',
    description:
      '使用自然语言查询项目中的代码实体和文档。支持查询示例：\n' +
      '• "视频模型相关的代码" - 查找视频相关的模型类\n' +
      '• "用户仓储实现" - 查找用户数据访问层代码\n' +
      '• "认证服务" - 查找认证相关的服务类\n' +
      '• "数据库连接" - 查找数据库相关的代码\n' +
      '• "API 控制器" - 查找控制器相关代码\n' +
      '支持中文和英文查询，返回相关的代码片段、文档说明和使用示例。',
  },
  async (uri: any, extra) => {
    try {
      // 解析查询参数
      const url = new URL(uri);
      const query: string = extra.queryString as string;

      logger.info(`chroma-query resource: query="${query}", projectName="${PROJECT_NAME}"`);

      if (!query) {
        return {
          contents: [
            {
              uri: uri,
              mimeType: 'text/plain',
              text: 'Error: Query parameter is required',
            },
          ],
        };
      }

      // 初始化 OpenAI embeddings
      const embeddings = initializeOpenAIEmbeddings(OPENAI_API_KEY);

      // 初始化 Chroma store
      const chromaStore = await initializeChromaStore(embeddings, PROJECT_NAME);

      // 搜索相似文档
      const results = await searchSimilarDocuments(chromaStore, query);

      return {
        contents: [
          {
            uri: uri,
            mimeType: 'text/plain',
            text: JSON.stringify(results),
          },
        ],
      };
    } catch (error: any) {
      logger.error('Chroma query resource error:', error);
      return {
        contents: [
          {
            uri: uri,
            mimeType: 'text/plain',
            text: `Error: ${error?.message || 'Unknown error occurred'}`,
          },
        ],
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
