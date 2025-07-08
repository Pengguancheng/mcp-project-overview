import { ChatOpenAI, OpenAIChatModelId } from '@langchain/openai';
import { OpenAIEmbeddings } from '@langchain/openai';

// Initialize OpenAI chat model
export const initializeOpenAIModel = (
  apiKey: string,
  model: OpenAIChatModelId = 'gpt-3.5-turbo'
) => {
  return new ChatOpenAI({
    openAIApiKey: apiKey,
    model: model,
    temperature: 0.1,
    timeout: 60000,
  });
};

// Initialize OpenAI embeddings
export const initializeOpenAIEmbeddings = (apiKey: string) => {
  return new OpenAIEmbeddings({
    openAIApiKey: apiKey,
    model: 'text-embedding-ada-002',
  });
};
