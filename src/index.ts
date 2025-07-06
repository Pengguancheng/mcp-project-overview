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

// Get OpenAI API key from environment variable
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
if (!OPENAI_API_KEY) {
  console.warn(
    'Warning: OPENAI_API_KEY not provided. Use --openai-api-key parameter. LangChain features will not work properly.'
  );
}

// 1. 建立 MCP Server
const server = new McpServer({
  name: 'project-overview-server',
  version: '1.0.0',
});

// 3. 註冊一個使用 LangChain 的 Tool
server.registerTool(
  'langchain-demo',
  {
    title: 'LangChain Demo',
    description: 'Demonstrates LangChain integration',
    inputSchema: { prompt: z.string() },
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

      // Initialize OpenAI model
      const model = initializeOpenAIModel(OPENAI_API_KEY);

      // Generate a response using LangChain
      const response = await model.invoke(param.prompt);

      return {
        content: [{ type: 'text', text: `LangChain response: ${JSON.stringify(response)}` }],
      };
    } catch (error: any) {
      console.error('LangChain error:', error);
      return {
        content: [{ type: 'text', text: `Error: ${error?.message || 'Unknown error occurred'}` }],
      };
    }
  }
);

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

      // Initialize OpenAI embeddings
      const embeddings = initializeOpenAIEmbeddings(OPENAI_API_KEY);

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
      await addDocumentsToChroma(chromaStore, [document]);

      return {
        content: [{ type: 'text', text: 'Document added to vector database successfully.' }],
      };
    } catch (error: any) {
      console.error('Chroma add error:', error);
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

      // Initialize OpenAI embeddings
      const embeddings = initializeOpenAIEmbeddings(OPENAI_API_KEY);

      // Initialize Chroma store with project name as collection name
      const chromaStore = await initializeChromaStore(embeddings, param.projectName);

      // Search for similar documents
      const results = await searchSimilarDocuments(chromaStore, param.query);

      return {
        content: [
          { type: 'text', text: 'Search results:' },
          { type: 'text', text: JSON.stringify(results, null, 2) },
        ],
      };
    } catch (error: any) {
      console.error('Chroma search error:', error);
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
  console.error('伺服器啟動失敗：', err);
  process.exit(1);
});
