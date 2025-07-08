import { Overview } from '../../domain/model/overview';
import { BaseProcedureContext, IProcedureContext } from '../procedure';
import winston from 'winston';
import logger from '../../utils/logger';
import { Chroma } from '@langchain/community/vectorstores/chroma';
import { initializeChromaStore } from '../../utils/chroma';
import { OpenAIEmbeddings } from '@langchain/openai';
import { initializeOpenAIEmbeddings } from '../../utils/langchain';

export class CodeOverviewCtx extends BaseProcedureContext {
  public projectName: string;
  public overviews: Overview[] = [];
  public chroma: Chroma;
  public openAiKey: string;

  constructor(projectName: string, chroma: Chroma, openAiKey: string) {
    super(logger);
    this.projectName = projectName;
    this.openAiKey = openAiKey;
    this.chroma = chroma;
  }

  public static async from(projectName: string, openAiKey: string): Promise<CodeOverviewCtx> {
    const embeddings = initializeOpenAIEmbeddings(openAiKey);
    const chroma = await initializeChromaStore(embeddings, projectName);
    return new CodeOverviewCtx(projectName, chroma, openAiKey);
  }

  getContextId(): string {
    return this.projectName;
  }

  getContextString(): string {
    return JSON.stringify({ projectName: this.projectName, overviews: this.overviews });
  }

  getLogger(): winston.Logger {
    return logger;
  }

  public addOverview(overview: Overview[]): void {
    this.overviews.push(...overview);
  }
}
