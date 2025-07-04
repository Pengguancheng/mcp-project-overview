import * as path from 'path';
import * as fsSync from 'fs';
import { log } from 'console';

/**
 * 解析 .gitignore 文件并返回忽略模式列表
 * 
 * @param {string} projectPath - 项目根目录路径
 * @returns {string[]} 忽略模式列表
 */
export function parseGitignore(projectPath: string): string[] {
  const gitignorePath = path.join(projectPath, '.gitignore');
  // Common patterns to ignore in project structure
  const defaultIgnores = [
    'node_modules',
    '.git',
    'dist',
    'build',
    'out',
    'obj',
    'bin',
    'coverage',
    '.DS_Store',
    'Thumbs.db',
    '*.log',
    'npm-debug.log*',
    'yarn-debug.log*',
    'yarn-error.log*',
    '.env',
    '.env.*',
    '.idea',
    '.vscode',
    '*.swp',
    '*.swo'
  ];

  try {
    if (fsSync.existsSync(gitignorePath)) {
      const content = fsSync.readFileSync(gitignorePath, 'utf-8');
      const patterns = content
        .split('\n')
        .map(line => line.trim())
        // Filter out empty lines, comments, and negated patterns
        .filter(line => line && !line.startsWith('#') && !line.startsWith('!'))
        .map(pattern => {
          // Remove trailing slashes for directory patterns
          if (pattern.endsWith('/')) {
            return pattern.slice(0, -1);
          }
          return pattern;
        });

      // Combine default ignores with patterns from .gitignore, removing duplicates
      return [...new Set([...defaultIgnores, ...patterns])];
    }
  } catch (error) {
    log(`Error reading .gitignore: ${error}`);
  }

  return defaultIgnores;
}

/**
 * 检查文件或目录是否应该被忽略
 * 
 * @param {string} filePath - 文件或目录的路径
 * @param {string} projectRoot - 项目根目录路径
 * @param {string[]} ignorePatterns - 忽略模式列表
 * @returns {boolean} 如果应该忽略则返回 true，否则返回 false
 */
export function shouldIgnore(filePath: string, projectRoot: string, ignorePatterns: string[]): boolean {
  const relativePath = path.relative(projectRoot, filePath);
  const fileName = path.basename(filePath);

  // Always ignore hidden files (starting with .)
  if (fileName.startsWith('.') && fileName !== '.gitignore') {
    return true;
  }

  // Skip checking for the project root itself
  if (!relativePath) {
    return false;
  }

  for (const pattern of ignorePatterns) {
    // Exact match
    if (relativePath === pattern || fileName === pattern) {
      return true;
    }

    // Directory match (pattern without trailing slash can match both files and directories)
    if (relativePath.startsWith(pattern + path.sep) || relativePath.startsWith(pattern + '/')) {
      return true;
    }

    // Wildcard match (simple implementation for * wildcard)
    if (pattern.includes('*')) {
      try {
        const regexPattern = '^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$';
        const regex = new RegExp(regexPattern);
        if (regex.test(relativePath) || regex.test(fileName)) {
          return true;
        }
      } catch (error) {
        // Skip invalid regex patterns
        log(`Invalid pattern in .gitignore: ${pattern}`);
      }
    }
  }

  return false;
}