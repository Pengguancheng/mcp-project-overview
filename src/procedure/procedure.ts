// types.ts
import { Logger } from 'winston';

export interface IProcedureContext {
  getContextString(): string;
  getContextId(): string;
  getLogger(): Logger;
}

export interface IProcess<TCtx extends IProcedureContext> {
  getProcessId(): string;
  process(ctx: TCtx): Promise<void> | void;
}

export abstract class BaseProcess implements IProcess<IProcedureContext> {
  public processId: string;

  protected constructor(processId: string) {
    this.processId = processId;
  }

  public getProcessId(): string {
    return this.processId;
  }

  abstract process(ctx: IProcedureContext): Promise<void> | void;
}

// procedure.ts
export class BaseProcedureContext {
  public err: Error | null = null;
  public logger: Logger;
  public stack: string[] = [];

  constructor(logger: Logger) {
    this.logger = logger;
  }
}

export class Procedure<TCtx extends IProcedureContext> {
  public ctx: TCtx;
  public contextProcedure: BaseProcedureContext;

  constructor(ctx: TCtx) {
    this.ctx = ctx;
    this.contextProcedure = new BaseProcedureContext(ctx.getLogger());
  }

  public static new<TCtx extends IProcedureContext>(ctx: TCtx): Procedure<TCtx> {
    return new Procedure(ctx);
  }

  public async execute(process: IProcess<TCtx>): Promise<Procedure<TCtx>> {
    if (this.contextProcedure.err) {
      return this;
    }

    this.contextProcedure.logger.debug('start process', {
      process: process.getProcessId(),
    });

    this.contextProcedure.stack.push(process.getProcessId());

    try {
      const result = process.process(this.ctx);

      // Handle both sync and async processes
      if (result instanceof Promise) {
        await result;
      }
    } catch (error) {
      const errorMessage = `process failed in '${process.getProcessId()}' [ctx: ${this.ctx.getContextString()}] [stack: ${JSON.stringify(this.contextProcedure.stack)}]`;

      if (error instanceof Error) {
        this.contextProcedure.err = new Error(`${errorMessage}: ${error.message}`);
        this.contextProcedure.err.stack = error.stack;
      } else {
        this.contextProcedure.err = new Error(`${errorMessage}: ${String(error)}`);
      }
    }

    return this;
  }

  public isErr(): boolean {
    return !!this.contextProcedure.err;
  }

  public getErr(): Error | null {
    return this.contextProcedure.err;
  }
}
