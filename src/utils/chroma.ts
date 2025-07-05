import { Chroma } from "@langchain/community/vectorstores/chroma";
import { Document } from "langchain/document";
import { OpenAIEmbeddings } from "@langchain/openai";

// Initialize Chroma client with a collection
export const initializeChromaStore = async (
  embeddings: OpenAIEmbeddings,
  collectionName: string = "default_collection",
  url?: string
) => {
  // Use the provided URL, or the environment variable, or the default
  const chromaUrl = url || process.env.CHROMA_SERVER_URL || "http://localhost:8000";

  return await Chroma.fromExistingCollection(embeddings, {
    collectionName,
    url: chromaUrl,
  });
};

// Add documents to Chroma
export const addDocumentsToChroma = async (
  chromaStore: Chroma,
  documents: Document[]
) => {
  return await chromaStore.addDocuments(documents);
};

// Search similar documents in Chroma
export const searchSimilarDocuments = async (
  chromaStore: Chroma,
  query: string,
  k: number = 5
) => {
  return await chromaStore.similaritySearch(query, k);
};

// Create a document from text
export const createDocument = (
  text: string,
  metadata: Record<string, any> = {}
) => {
  return new Document({ pageContent: text, metadata });
};
