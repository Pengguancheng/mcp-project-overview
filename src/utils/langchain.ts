import { ChatOpenAI } from "@langchain/openai";
import { OpenAIEmbeddings } from "@langchain/openai";

// Initialize OpenAI chat model
export const initializeOpenAIModel = (apiKey: string, modelName: string = "gpt-3.5-turbo") => {
  return new ChatOpenAI({
    openAIApiKey: apiKey,
    modelName: modelName,
    temperature: 0.7,
  });
};

// Initialize OpenAI embeddings
export const initializeOpenAIEmbeddings = (apiKey: string) => {
  return new OpenAIEmbeddings({
    openAIApiKey: apiKey,
    modelName: "text-embedding-3-small", // Default embedding model
  });
};