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
      '將代碼文檔添加到向量數據庫。使用此工具存儲類和函數的文檔信息，包括其名稱、命名空間、類型(class/function)以及使用方法描述。範例：{"type":"class", "name":"UserRepository", "namespace":"app.repositories", "text":"負責用戶數據的CRUD操作...", "projectName":"my-project"}',
    inputSchema: {
      text: z.string().describe('文檔內容，應包含類或函數的摘要和使用方式'),
      type: z.enum(['class', 'function']).describe('文檔類型，可以是類或函數'),
      name: z.string().describe('類或函數的完整名稱'),
      namespace: z.string().optional().describe('類或函數的命名空間或路徑'),
      metadata: z.record(z.any()).optional(),
      projectName: z.string().default('default_collection').describe('專案名稱'),
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
        },
      });

      logger.info(
        `vector-add: adding document to Chroma with metadata: ${JSON.stringify(document.metadata)}`
      );

      await addDocumentsToChroma(chromaStore, [document]);

      logger.info(`vector-add: document added to collection "${param.projectName}" successfully`);

      return {
        content: [{ type: 'text', text: 'Document added to vector database successfully.' }],
      };
    } catch (error: any) {
      logger.error('Chroma add error:', error);
      return {
        content: [{ type: 'text', text: `Error: ${error?.message || 'Unknown error occurred'}` }],
      };
    }
  }
);

// 註冊向量文檔查詢資源
server.registerResource(
  'vector',
  new ResourceTemplate('vector://projects/{projectName}/documents', {
    list: undefined,
    complete: undefined,
  }),
  {
    title: '向量文檔資源',
    description:
      '通過資源路徑查詢向量數據庫中存儲的代碼文檔。支持通過類型、名稱和命名空間進行過濾。示例：vector://projects/my-project/documents?type=class&namespace=app.repositories',
    urlSchema: {
      projectName: z.string().describe('專案名稱，對應Chroma數據庫集合名稱'),
    },
    querySchema: {
      type: z.enum(['class', 'function']).optional().describe('文檔類型過濾'),
      name: z.string().optional().describe('類或函數名稱過濾'),
      namespace: z.string().optional().describe('命名空間或路徑過濾'),
      query: z.string().optional().describe('文本搜索查詢'),
      limit: z.number().optional().default(10).describe('結果數量限制'),
    },
  },
  async (uri, urlParams) => {
    try {
      if (!OPENAI_API_KEY) {
        return {
          contents: [
            {
              uri: uri.href,
              text: 'Error: OpenAI API key not set. Please set the OPENAI_API_KEY environment variable.',
            },
          ],
        };
      }

      // 从 URL 参数中提取 projectName
      const { projectName } = (urlParams as any).projectName;

      // 从查询参数中提取过滤条件
      const urlObj = new URL(uri.href);
      const type = urlObj.searchParams.get('type') as 'class' | 'function' | null;
      const name = urlObj.searchParams.get('name');
      const namespace = urlObj.searchParams.get('namespace');
      const query = urlObj.searchParams.get('query');
      const limit = parseInt(urlObj.searchParams.get('limit') || '10');

      logger.info(
        `vector-resource: accessing project: ${projectName} with filters: ${JSON.stringify({
          type,
          name,
          namespace,
          query,
        })}`
      );

      // Initialize OpenAI embeddings
      const embeddings = initializeOpenAIEmbeddings(OPENAI_API_KEY);

      // Initialize Chroma store with project name as collection name
      const chromaStore = await initializeChromaStore(embeddings, projectName);

      // 準備過濾條件
      const filterConditions: Record<string, any> = {};
      if (type) filterConditions.type = type;
      if (name) filterConditions.name = name;
      if (namespace) filterConditions.namespace = namespace;

      let results: Document[] = [];

      if (query) {
        // 如果有查詢文本，執行相似度搜索
        logger.info(`vector-resource: performing similarity search for: "${query}"`);
        results = await searchSimilarDocuments(
          chromaStore,
          query,
          limit || 10,
          Object.keys(filterConditions).length > 0 ? filterConditions : undefined
        );
      } else {
        // 否則從 ChromaDB 獲取所有匹配過濾條件的文檔
        // 由於 Chroma 沒有直接的 getAll 方法，這裡我們使用一個通用查詢
        logger.info(`vector-resource: retrieving all documents with filters`);
        const genericQuery = 'code documentation';
        results = await searchSimilarDocuments(
          chromaStore,
          genericQuery,
          limit || 100, // 使用較大的限制以獲取更多結果
          Object.keys(filterConditions).length > 0 ? filterConditions : undefined
        );
      }

      logger.info(`vector-resource: found ${results.length} documents`);

      // 將結果轉換為更友好的格式
      const formattedResults = results.map(doc => ({
        content: doc.pageContent,
        type: doc.metadata.type || 'unknown',
        name: doc.metadata.name || 'unnamed',
        namespace: doc.metadata.namespace || '',
        similarity: doc.metadata.score
          ? Math.round((doc.metadata.score as number) * 100) / 100
          : null,
      }));

      return {
        contents: [
          {
            uri: uri.href,
            text: `找到 ${formattedResults.length} 個文檔：\n${JSON.stringify(formattedResults, null, 2)}`,
            mimeType: 'application/json',
          },
        ],
      };
    } catch (error: any) {
      logger.error('Vector resource error:', error);
      return {
        contents: [
          {
            uri: uri.href,
            text: `Error: ${error?.message || 'Unknown error occurred'}`,
          },
        ],
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

// 6. 使用 stdio transport 接收與回應，並添加認證
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(err => {
  logger.error('伺服器啟動失敗：', err);
  process.exit(1);
});
