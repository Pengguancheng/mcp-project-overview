// src/index.ts
import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { initializeOpenAIEmbeddings } from './utils/langchain';
import {
  addDocumentsToChroma,
  initializeChromaStore,
  searchSimilarDocuments,
} from './utils/chroma';
import { Document } from '@langchain/core/documents';
import logger from './utils/logger';
import { generateProjectOverview } from './cmd/generateOverview';
import * as path from 'path';

// Get OpenAI API key from environment variable
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
if (!OPENAI_API_KEY) {
  logger.warn(
    'Warning: OPENAI_API_KEY not provided. Use --openai-api-key parameter. LangChain features will not work properly.'
  );
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
      '將代碼文檔添加到向量數據庫。使用此工具存儲類和函數的文檔信息，包括其名稱、命名空間、類型(class/function)以及使用方法描述。範例：{"type":"class", "name":"UserRepository", "namespace":"app.repositories", "text":"負責用戶數據的CRUD操作...", "projectName":"my-project", "filePath":"/path/to/file.ts"}',
    inputSchema: {
      text: z.string().describe('文檔內容，應包含類或函數的摘要和使用方式'),
      type: z.enum(['class', 'function']).describe('文檔類型，可以是類或函數'),
      name: z.string().describe('類或函數的完整名稱'),
      namespace: z.string().optional().describe('類或函數的命名空間或路徑'),
      metadata: z.record(z.any()).optional(),
      projectName: z.string().default('default_collection').describe('專案名稱'),
      filePath: z.string().optional().describe('檔案路徑，作為文檔的唯一標識符，如果提供則會覆蓋同路徑的文檔'),
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
      logger.info(`vector-add: received params: ${JSON.stringify(param)}`);

      // Initialize OpenAI embeddings
      const embeddings = initializeOpenAIEmbeddings(OPENAI_API_KEY);

      logger.info(`vector-add: initializing Chroma store for project: ${param.projectName}`);

      // Initialize Chroma store with project name as collection name
      const chromaStore = await initializeChromaStore(embeddings, param.projectName);

      // Create a document and add it to Chroma
      const document = new Document({
        pageContent: param.text,
        metadata: {
          ...param.metadata,
          type: param.type,
          name: param.name,
          namespace: param.namespace || '',
          projectName: param.projectName,
          filePath: param.filePath, // Store filePath in metadata as well
        },
      });

      logger.info(
        `vector-add: adding document to Chroma with metadata: ${JSON.stringify(document.metadata)}`
      );

      // If filePath is provided, use it as the document ID for upsert
      const options = param.filePath ? { ids: [param.filePath] } : undefined;
      await addDocumentsToChroma(chromaStore, [document], options);

      logger.info(`vector-add: document ${param.filePath ? 'upserted' : 'added'} to collection "${param.projectName}" successfully`);

      return {
        content: [{ 
          type: 'text', 
          text: `Document ${param.filePath ? 'upserted' : 'added'} to vector database successfully.` 
        }],
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
      '通過語義搜索查找代碼文檔。您可以使用文本查詢搜索相似文檔，也可以按類型(class/function)、名稱和命名空間進行過濾。範例1(基本搜索)：{"query":"如何處理用戶驗證", "projectName":"my-project"}。範例2(過濾搜索)：{"query":"數據庫操作", "type":"class", "namespace":"app.repositories", "projectName":"my-project"}',
    inputSchema: {
      query: z.string().describe('搜索查詢'),
      projectName: z.string().describe('專案名稱'),
      type: z.enum(['class', 'function']).optional().describe('過濾文檔類型'),
      name: z.string().optional().describe('過濾類或函數名稱'),
      namespace: z.string().optional().describe('過濾命名空間或路徑'),
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

      logger.info(`vector-search: received params: ${JSON.stringify(param)}`);

      // Initialize OpenAI embeddings
      const embeddings = initializeOpenAIEmbeddings(OPENAI_API_KEY);

      logger.info(`vector-search: initializing Chroma store for project: ${param.projectName}`);

      // Initialize Chroma store with project name as collection name
      const chromaStore = await initializeChromaStore(embeddings, param.projectName);

      logger.info(`vector-search: searching similar documents for query: "${param.query}"`);
      // Search for similar documents
      const results = await searchSimilarDocuments(chromaStore, param.query);

      logger.info(
        `vector-search: found ${results.length} results in collection "${param.projectName}"`
      );

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
  'generate-overview',
  {
    title: 'Generate Project Overview',
    description:
      '生成项目概览文档。此工具会分析指定目录下的所有源代码文件，为每个文件生成摘要，并将这些摘要整合到一个overview.md文件中。例如：{"targetDir":"./src", "overviewPath":"./docs/overview.md"}',
    inputSchema: {
      targetDir: z.string().describe('要分析的目标目录路径'),
      overviewPath: z.string().optional().describe('概览文档的输出路径，默认为项目根目录下的overview.md'),
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

      const targetDir = path.resolve(param.targetDir);
      const overviewPath = param.overviewPath ? path.resolve(param.overviewPath) : path.resolve('overview.md');

      logger.info(`generate-overview: analyzing directory ${targetDir}, output to ${overviewPath}`);

      const result = await generateProjectOverview(targetDir, overviewPath, OPENAI_API_KEY);

      return {
        content: [
          { 
            type: 'text', 
            text: `Project overview generated successfully and saved to ${overviewPath}` 
          },
          {
            type: 'text',
            text: '概览内容预览:\n\n' + result.substring(0, 500) + '...'
          }
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

// 7. 使用 stdio transport 接收與回應，並添加認證
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(err => {
  logger.error('伺服器啟動失敗：', err);
  process.exit(1);
});
