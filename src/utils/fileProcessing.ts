import * as fs from 'fs';
import * as path from 'path';
import { Document } from '@langchain/core/documents';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { loadSummarizationChain } from 'langchain/chains';
import { ChatOpenAI } from '@langchain/openai';
import logger from './logger';
import { glob } from 'glob';

// Load all files from a directory
export async function loadFilesFromDirectory(
  targetDir: string,
  pattern: string = '**/*.{md,ts,tsx,js,jsx,go,cs,java}',
  ignore: string[] = ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**']
): Promise<string[]> {
  logger.info(`Loading files from ${targetDir}...`);

  try {
    // Use glob to find files matching the pattern
    const files = await glob(pattern, {
      cwd: targetDir,
      absolute: true,
      ignore: ignore,
    });

    // Filter out directories and ensure we only have files
    const validFiles = files.filter(file => {
      try {
        const stats = fs.statSync(file);
        return stats.isFile();
      } catch (error) {
        logger.warn(`Cannot access file: ${file}`);
        return false;
      }
    });

    logger.info(`Found ${validFiles.length} files matching pattern ${pattern}`);
    return validFiles;
  } catch (error) {
    logger.error(`Error loading files from ${targetDir}:`, error);
    throw error;
  }
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

// 用于自定义提示词的接口
export interface SummaryPrompts {
  mapPrompt?: string;
  combinePrompt?: string;
}

// Generate summary for a file
export async function generateFileSummary(
  documents: Document[],
  llm: ChatOpenAI,
  customPrompts?: SummaryPrompts
): Promise<string> {
  const chunks = await splitDocuments(documents);
  const summaryChain = loadSummarizationChain(llm, { type: 'map_reduce' });

  const { text } = await summaryChain.call({
    input_documents: chunks,
    map_prompt: customPrompts?.mapPrompt || '请提炼下列内容的关键要点：\n\n{text}',
    combine_prompt: customPrompts?.combinePrompt || '请将上述要点整合成文件概要：\n\n{text}',
  });

  return text.trim();
}

// Create documents from file paths
export function createDocumentsFromFilePaths(filePaths: string[]): Document[] {
  const documents: Document[] = [];

  for (const filePath of filePaths) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const document = new Document({
        pageContent: content,
        metadata: {
          source: filePath,
          extension: path.extname(filePath),
          basename: path.basename(filePath),
          dirname: path.dirname(filePath),
        },
      });
      documents.push(document);
    } catch (error) {
      logger.warn(`Cannot read file: ${filePath}`, error);
    }
  }

  return documents;
}

// Read existing overview file
export function readExistingOverview(overviewPath: string): string {
  return fs.existsSync(overviewPath) ? fs.readFileSync(overviewPath, 'utf8') : '';
}

// Write updated overview to file
export function writeOverviewToFile(overviewPath: string, content: string): void {
  fs.writeFileSync(overviewPath, content, 'utf8');
}
