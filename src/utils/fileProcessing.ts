import * as fs from 'fs';
import * as path from 'path';
import { Document } from '@langchain/core/documents';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { DirectoryLoader } from 'langchain/document_loaders/fs/directory';
import { TextLoader } from 'langchain/document_loaders/fs/text';
import { loadSummarizationChain } from 'langchain/chains';
import { ChatOpenAI } from '@langchain/openai';
import logger from './logger';

// Load all files from a directory
export async function loadFilesFromDirectory(
  targetDir: string,
  globPattern: string = '**/*.{md,ts,js,go,cs}'
): Promise<Document[]> {
  logger.info(`Loading files from ${targetDir}...`);

  const loader = new DirectoryLoader(targetDir, {
    '.md': path => new TextLoader(path),
    '.ts': path => new TextLoader(path),
    '.js': path => new TextLoader(path),
    '.go': path => new TextLoader(path),
    '.cs': path => new TextLoader(path),
  });

  return await loader.load();
}

// Group documents by source file
export function groupDocumentsBySource(documents: Document[]): Record<string, Document[]> {
  return documents.reduce<Record<string, Document[]>>((acc, doc) => {
    const src = doc.metadata.source as string;
    acc[src] = acc[src] || [];
    acc[src].push(doc);
    return acc;
  }, {});
}

// Split documents into chunks
export async function splitDocuments(
  documents: Document[],
  chunkSize: number = 1000,
  chunkOverlap: number = 200
): Promise<Document[]> {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize,
    chunkOverlap,
  });
  return await splitter.splitDocuments(documents);
}

// Generate summary for a file
export async function generateFileSummary(documents: Document[], llm: ChatOpenAI): Promise<string> {
  const chunks = await splitDocuments(documents);
  const summaryChain = loadSummarizationChain(llm, { type: 'map_reduce' });

  const { text } = await summaryChain.call({
    input_documents: chunks,
    map_prompt: '请提炼下列内容的关键要点：\n\n{text}',
    combine_prompt: '请将上述要点整合成文件概要：\n\n{text}',
  });

  return text.trim();
}

// Read existing overview file
export function readExistingOverview(overviewPath: string): string {
  return fs.existsSync(overviewPath) ? fs.readFileSync(overviewPath, 'utf8') : '';
}

// Write updated overview to file
export function writeOverviewToFile(overviewPath: string, content: string): void {
  fs.writeFileSync(overviewPath, content, 'utf8');
}
