// src/index.ts
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { initializeOpenAIModel, initializeOpenAIEmbeddings } from './utils/langchain';
import {
  initializeChromaStore,
  addDocumentsToChroma,
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
});

// 4. 註冊一個用於添加文檔到 Chroma 的 Tool
server.registerTool(
  'vector-add',
  {
    title: 'Vector Add',
    description: 'Add documents to Chroma vector database',
    inputSchema: {
      text: z.string(),
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

// 5. 註冊一個用於搜索 Chroma 的 Tool
server.registerTool(
  'vector-search',
  {
    title: 'Vector Search',
    description: 'Search documents in Chroma vector database',
    inputSchema: {
      query: z.string(),
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
