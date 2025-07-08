import { BaseProcedureContext, BaseProcess, IProcess } from '../procedure';
import { CodeOverviewCtx } from './codeOverviewCtx';
import { Document } from '@langchain/core/documents';
import { addDocumentsToChroma } from '../../utils/chroma';

export interface IProUpdateChroma extends IProcess<CodeOverviewCtx> {}

export class UpdateChromaProcess extends BaseProcess implements IProUpdateChroma {
  public constructor() {
    super(UpdateChromaProcess.name);
  }

  async process(ctx: CodeOverviewCtx): Promise<void> {
    try {
      ctx.getLogger().info('开始更新 Chroma 向量数据库');

      if (!ctx.chroma) {
        ctx.getLogger().error('Chroma 实例未初始化');
        throw new Error('Chroma 实例未初始化');
      }

      if (!ctx.overviews || ctx.overviews.length === 0) {
        ctx.getLogger().info('没有概览数据需要更新到 Chroma');
        return;
      }

      // 将 Overview 对象转换为 Document 对象
      const documents = ctx.overviews.map(overview => {
        return new Document({
          pageContent: overview.content,
          metadata: {
            id: overview.id,
            name: overview.name,
            projectName: overview.projectName,
            filePath: overview.filePath,
            type: overview.contentType,
            references: overview.references.join(','),
            summary: overview.summary,
          },
        });
      });

      ctx.getLogger().info(`准备向 Chroma 添加 ${documents.length} 个文档`);

      // 批量添加文档到 Chroma
      // 使用 filePath 作为 document ID 来支持更新操作
      const ids = ctx.overviews.map(overview => overview.id);

      await addDocumentsToChroma(ctx.chroma, documents, { ids });

      ctx.getLogger().info(`成功向 Chroma 添加/更新了 ${documents.length} 个文档`);
    } catch (error: any) {
      ctx.getLogger().error('更新 Chroma 过程中发生错误:', error);
      throw new Error(`更新 Chroma 失败: ${error.message}`);
    }
  }
}
