# MCP Project Overview

MCP Server for creating code project file architecture and summary using the Model Context Protocol (MCP).

## Description

This is a Node.js application built with TypeScript that implements an MCP server to help analyze and summarize code project architecture. It uses the [@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/typescript-sdk) to provide resources and tools for project analysis.

## Features

- **Project Structure Resource**: Get a structured view of a project's file hierarchy
- **File Analysis Tool**: Analyze the content and purpose of individual files
- **Project Summary Tool**: Generate a comprehensive summary of a project including its structure and package information
- **LangChain Integration**: Utilize LangChain for advanced language model capabilities
- **Chroma Vector Database**: Store and retrieve vector embeddings for semantic search

## Prerequisites

- Node.js (v18 or higher)
- npm (v6 or higher)
- OpenAI API key (for LangChain and vector embeddings)
- Chroma DB server (optional, defaults to http://localhost:8000)

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/Pengguancheng/mcp-project-overview.git
   cd mcp-project-overview
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

## MCP Server 配置

要在您的編輯器或開發環境中整合 MCP Server，請使用以下配置：

```json
{
  "mcpServers": {
    "chroma": {
      "command": "node",
      "args": [
        "dist/index.js"
      ],
      "env": {
        "OPENAI_API_KEY": "your-openai-api-key-here",
        "PROJECT_NAME": "your-project-name"
      }
    }
  }
}
```

### 環境變量說明

- `OPENAI_API_KEY`: 您的 OpenAI API 密鑰，用於生成嵌入和項目摘要
- `PROJECT_NAME`: 項目名稱，用作 Chroma 集合名稱
- `CHROMA_URL`: (可選) Chroma 數據庫服務器 URL，默認為 http://localhost:8000

## MCP 使用範例

### 添加代碼文檔到向量數據庫

```typescript
// 添加類文檔
await mcpClient.callTool("vector-add", {
  type: "class",
  name: "UserRepository",
  namespace: "app.repositories",
  text: "負責用戶數據的 CRUD 操作，包含創建、讀取、更新和刪除用戶的方法。",
  projectName: "my-project",
  filePath: "src/repositories/UserRepository.ts",
  summary: "用戶數據訪問層",
  references: ["src/models/User.ts", "typeorm"]
});
```

### 語義搜索代碼實體

```typescript
// 自然語言查詢
const results = await mcpClient.callTool("vector-search", {
  query: "用戶認證相關的代碼",
  projectName: "my-project",
  limit: 5
});

// 按類型過濾
const classResults = await mcpClient.callTool("vector-search", {
  query: "數據庫操作",
  type: "class",
  projectName: "my-project"
});

// 按引用關係過濾
const refResults = await mcpClient.callTool("vector-search", {
  query: "用戶管理",
  references: ["src/models/User.ts"],
  projectName: "my-project"
});
```

### 生成項目概覽

```typescript
await mcpClient.callTool("summary-code", {
  projectDir: "/path/to/your/project",
  targetDir: "src",
  outputFile: "docs/overview.md",
  summaryType: "overview"
});
```

### 清除向量數據庫

```typescript
await mcpClient.callTool("vector-clear", {
  projectName: "my-project"
});
```

### 使用資源查詢

```typescript
// 使用資源進行自然語言查詢
const resourceResult = await mcpClient.getResource("chroma://query/視頻處理相關的代碼");
```

