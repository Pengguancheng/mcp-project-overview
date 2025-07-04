import * as fs from 'fs/promises';
import * as path from 'path';
import { parseGitignore, shouldIgnore } from './gitignore';

/**
 * 递归获取项目目录结构，根据 .gitignore 文件忽略指定的文件和目录
 *
 * @param {string} dirPath - 要扫描的目录路径
 * @param {number} maxDepth - 最大递归深度，默认为 3
 * @param {number} currentDepth - 当前递归深度，默认为 0
 * @param {string[]} ignorePatterns - 忽略模式列表，默认为空数组
 * @param {string} projectRoot - 项目根目录路径，用于解析相对路径，默认为 dirPath
 * @returns {Promise<string>} 返回格式化的目录结构字符串
 *
 * @example
 * const structure = await getProjectStructure('./myProject', 2);
 * // 返回类似:
 * // - src/
 * //   - index.ts
 * //   - utils/
 * //     - helper.ts
 */
export async function getProjectStructure(
  dirPath: string,
  maxDepth: number = 3,
  currentDepth: number = 0,
  ignorePatterns?: string[],
  projectRoot?: string
): Promise<string> {
  if (currentDepth > maxDepth) {
    return '...';
  }

  try {
    // Store the project root on the first call
    if (currentDepth === 0) {
      projectRoot = dirPath;

      // Parse .gitignore on the first call
      if (!ignorePatterns) {
        ignorePatterns = parseGitignore(projectRoot);
      }
    }

    // Ensure projectRoot is defined
    const rootPath = projectRoot || dirPath;

    const files = await fs.readdir(dirPath);
    let result = '';

    for (const file of files) {
      const filePath = path.join(dirPath, file);

      // Skip files that should be ignored based on .gitignore patterns
      if (ignorePatterns && shouldIgnore(filePath, rootPath, ignorePatterns)) {
        continue;
      }

      const stats = await fs.stat(filePath);
      const indent = '  '.repeat(currentDepth);

      if (stats.isDirectory()) {
        result += `${indent}- ${file}/\n`;
        const subDirContent = await getProjectStructure(
          filePath, 
          maxDepth, 
          currentDepth + 1, 
          ignorePatterns,
          rootPath
        );
        result += subDirContent;
      } else {
        result += `${indent}- ${file}\n`;
      }
    }

    return result;
  } catch (error) {
    return `Error reading directory: ${error instanceof Error ? error.message : String(error)}\n`;
  }
}