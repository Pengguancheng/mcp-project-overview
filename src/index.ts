import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { log } from 'console';
import * as fs from 'fs/promises';
import * as path from 'path';
import { getProjectStructure } from './utils/projectStructure';

/**
 * 主入口函数
 * 初始化并启动 MCP 服务器，注册项目结构分析相关的资源和工具
 *
 * @returns {Promise<void>} 返回一个 Promise，表示服务器启动完成
 * @throws 如果服务器启动失败，将抛出错误
 */
async function main(): Promise<void> {
  log('Starting MCP Server for project overview...');

  // Create an MCP server
  const server = new McpServer({
    name: 'mcp-project-overview',
    version: '1.0.0',
  });

  // Register a resource to get project structure
  server.registerResource(
    'project-structure',
    new ResourceTemplate('project://{projectPath}', { list: undefined }),
    {
      title: 'Project Structure',
      description: 'Get the file structure of a project',
    },
    async (uri, { projectPath }) => {
      try {
        // Ensure projectPath is a string
        const projectPathStr = Array.isArray(projectPath) ? projectPath[0] : projectPath;
        const structure = await getProjectStructure(projectPathStr);
        return {
          contents: [
            {
              uri: uri.href,
              text: structure,
            },
          ],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          contents: [
            {
              uri: uri.href,
              text: `Error getting project structure: ${errorMessage}`,
            },
          ],
        };
      }
    }
  );

  // Register a tool to analyze a file
  server.registerTool(
    'analyze-file',
    {
      title: 'Analyze File',
      description: 'Analyze the content and purpose of a file',
      inputSchema: {
        filePath: z.string().describe('Path to the file to analyze'),
      },
    },
    async ({ filePath }) => {
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        return {
          content: [
            {
              type: 'text',
              text: `File analysis for: ${filePath}\n\nContent:\n${content.substring(0, 1000)}${content.length > 1000 ? '...' : ''}`,
            },
          ],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: 'text',
              text: `Error analyzing file: ${errorMessage}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Start the server with stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);
  log('MCP Server is running...');
}

// Execute the main function
main().catch(error => {
  console.error('Error running MCP server:', error);
  process.exit(1);
});
