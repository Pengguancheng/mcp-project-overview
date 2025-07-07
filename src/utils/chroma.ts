import { Chroma } from '@langchain/community/vectorstores/chroma';
import { Document } from '@langchain/core/documents';
import { OpenAIEmbeddings } from '@langchain/openai';
import { ChromaClient, OpenAIEmbeddingFunction } from 'chromadb';
import logger from './logger';

// Initialize Chroma vector store with simplified approach
export const initializeChromaStore = async (
  embeddings: OpenAIEmbeddings,
  collectionName: string = 'default_collection'
): Promise<Chroma> => {
  try {
    const url = process.env.CHROMA_URL || 'http://localhost:8000';

    // 使用簡化的 Chroma 初始化方式
    return new Chroma(embeddings, {
      collectionName,
      url: url,
      collectionMetadata: {
        'hnsw:space': 'cosine',
      },
    });
  } catch (error) {
    throw error;
  }
};

// Add documents to Chroma
export const addDocumentsToChroma = async (
  chromaStore: Chroma,
  documents: Document[],
  options?: { ids?: string[] }
): Promise<string[]> => {
  return await chromaStore.addDocuments(documents, options);
};

// Search similar documents in Chroma
export const searchSimilarDocuments = async (
  chromaStore: Chroma,
  query: string,
  k: number = 5,
  filter?: Record<string, any>
): Promise<Document[]> => {
  return await chromaStore.similaritySearch(query, k, filter);
};

// 添加到 src/utils/chroma.ts
export async function clearChromaCollection(projectName: string): Promise<void> {
  const client = new ChromaClient({
    path: process.env.CHROMA_SERVER_URL || 'http://localhost:8000',
  });

  try {
    await client.deleteCollection({ name: projectName });
    logger.info(`Collection "${projectName}" cleared successfully`);
  } catch (error) {
    logger.error('Error clearing collection:', error);
    throw error;
  }
}
