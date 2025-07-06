import { Chroma } from '@langchain/community/vectorstores/chroma';
import { Document } from '@langchain/core/documents';
import { OpenAIEmbeddings } from '@langchain/openai';
import { addDocumentsToChroma, initializeChromaStore, searchSimilarDocuments } from './chroma';
import { initializeOpenAIEmbeddings } from './langchain';
import { ChromaClient } from 'chromadb';
import { name } from 'ts-jest/dist/transformers/hoist-jest';

// 设置测试环境变量
process.env.OPENAI_API_KEY = 'your-openai-api-key';

describe('Chroma Utilities', () => {
  let embeddings: OpenAIEmbeddings;
  const testCollectionName = `test_collection_${Date.now()}`;

  // 测试数据
  const testDocuments = [
    new Document({
      pageContent: '测试文档1 - Chroma数据库连接测试',
      metadata: { source: 'test1' },
    }),
    new Document({
      pageContent: '测试文档2 - 向量数据库操作测试',
      metadata: { source: 'test2' },
    }),
  ];

  beforeAll(async () => {
    expect(process.env.OPENAI_API_KEY).toBeDefined();

    embeddings = initializeOpenAIEmbeddings(process.env.OPENAI_API_KEY!);
  }, 30000);

  describe('initializeOpenAIEmbeddings', () => {
    it('test embeddings', async () => {
      expect(embeddings).toBeDefined();
      const rs = await embeddings.embedDocuments(testDocuments.map(x => x.pageContent));
      expect(rs).toBeDefined();
      console.log(rs);
    });
  });

  describe('initializeChromaStore', () => {
    it('should create collection', async () => {
      const url = process.env.CHROMA_URL || 'http://localhost:8000';
      await Chroma.fromDocuments(testDocuments, embeddings, {
        url: url,
        collectionName: testCollectionName,
      });
    });

    it('应该成功创建 Chroma 向量存储', async () => {
      if (!process.env.OPENAI_API_KEY) {
        console.log('跳过测试: 未设置OPENAI_API_KEY');
        return;
      }
      const chromaStore = await initializeChromaStore(embeddings, testCollectionName);

      expect(chromaStore).toBeDefined();
      expect(chromaStore instanceof Chroma).toBe(true);
    }, 15000);
  });

  describe('addDocumentsToChroma', () => {
    it('应该将文档添加到Chroma存储中', async () => {
      try {
        const chromaStore = await initializeChromaStore(embeddings, testCollectionName);
        const result = await addDocumentsToChroma(chromaStore, testDocuments);
        expect(result).toBeDefined();
        expect(Array.isArray(result)).toBe(true);
      } catch (error) {
        expect(error).toBeNull();
      }
    }, 20000);
  });

  describe('searchSimilarDocuments', () => {
    it('应该在Chroma存储中搜索相似文档', async () => {
      try {
        const chromaStore = await initializeChromaStore(embeddings, testCollectionName);
        await addDocumentsToChroma(chromaStore, testDocuments);
        const results = await searchSimilarDocuments(chromaStore, '向量数据库', 1);

        expect(results).toBeDefined();
        expect(Array.isArray(results)).toBe(true);
        expect(results.length).toBeGreaterThan(0);
      } catch (error) {
        expect(error).toBeNull();
      }
    }, 20000);
  });
});
