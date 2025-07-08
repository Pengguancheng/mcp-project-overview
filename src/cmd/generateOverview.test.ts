import { initializeOpenAIModel } from '../utils/langchain';
import { generateFileOverview } from './generateOverview';
import path from 'path';

describe('generateOverview Test', () => {
  describe('test generateFileOverview', () => {
    const apiKey = process.env.OPENAI_API_KEY || '';
    const projectDir = process.env.PROJECT_DIR || '';
    const projectName = 'mcp-project-overview';
    const filePath = 'src/cmd/generateOverview.ts';

    it('should get overview', async () => {
      const fileOverview = await generateFileOverview(
        apiKey,
        projectName,
        path.resolve(projectDir, filePath)
      );
      console.log(fileOverview);
    }, 60000);
  });
});
