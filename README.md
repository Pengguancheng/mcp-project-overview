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

## Development

### Build the project

```bash
npm run build
```

This will compile TypeScript files from the `src` directory to JavaScript files in the `dist` directory.

### Code Formatting

This project uses [Prettier](https://prettier.io/) for code formatting. The configuration is defined in `.prettierrc` file.

To format all files:

```bash
npm run format
```

To check if files are formatted correctly without modifying them:

```bash
npm run format:check
```

The code will be automatically formatted when you install the project dependencies (via the `prepare` script).

### Command Line Parameters

For LangChain and Chroma functionality, you need to provide the following parameters when running the application:

```bash
# Required for LangChain and Chroma vector embeddings
--openai-api-key YOUR_API_KEY

# Optional, defaults to http://localhost:8000
--chroma-server-url YOUR_CHROMA_SERVER_URL
```

#### Authentication Parameters

The server supports token-based authentication. You must either provide an authentication token or explicitly disable authentication:

```bash
# Option 1: Use token-based authentication (recommended)
--auth-token YOUR_AUTH_TOKEN

# Option 2: Disable authentication (not recommended for production)
--DANGEROUSLY_OMIT_AUTH
```

You can also set these options using environment variables:
- `AUTH_TOKEN`: Set to your authentication token
- `DANGEROUSLY_OMIT_AUTH`: Set to "true" to disable authentication

When authentication is enabled, clients must include the `auth_token` parameter in their requests:

```json
{
  "jsonrpc": "2.0",
  "method": "your-method",
  "params": {
    "auth_token": "YOUR_AUTH_TOKEN",
    // other parameters...
  },
  "id": 1
}
```

You can pass these parameters directly to the command when running the application:

```bash
# Example for running the built application
npm run start -- --openai-api-key YOUR_API_KEY --chroma-server-url http://localhost:8000 --auth-token YOUR_AUTH_TOKEN

# Or with authentication disabled (not recommended for production)
npm run start -- --openai-api-key YOUR_API_KEY --chroma-server-url http://localhost:8000 --DANGEROUSLY_OMIT_AUTH

# Or use the convenience script (you'll need to update it to include authentication parameters)
npm run start:with-params
```

For development mode:

```bash
# Example for running in development mode
npm run dev -- --openai-api-key YOUR_API_KEY --chroma-server-url http://localhost:8000 --auth-token YOUR_AUTH_TOKEN

# Or with authentication disabled (not recommended for production)
npm run dev -- --openai-api-key YOUR_API_KEY --chroma-server-url http://localhost:8000 --DANGEROUSLY_OMIT_AUTH

# Or use the convenience script (you'll need to update it to include authentication parameters)
npm run dev:with-params
```

### Chroma DB Setup

For the vector database functionality, you need a running Chroma DB server. You can run it using Docker:

```bash
docker run -p 8000:8000 chromadb/chroma
```

Alternatively, you can install and run Chroma locally following the [official documentation](https://docs.trychroma.com/getting-started).

### Run the application

```bash
npm start
```

### Development mode

To run the application in development mode with automatic restarting:

```bash
npm run dev
```

Or with file watching:

```bash
npm run watch
```

### Testing

This project uses Jest for testing. Run all tests with:

```bash
npm test
```

#### Chroma Vector Database Testing

我们提供了两种不同的测试方法来测试Chroma向量数据库功能：

1. **实际连接测试** (chroma.test.ts):
```bash
npm run test:chroma
```
此测试使用实际的Chroma数据库连接和OpenAI API进行测试，确保在真实环境中功能正常工作。
运行此测试需要：
   - 设置`OPENAI_API_KEY`环境变量
   - 本地运行Chroma服务器 (默认：http://localhost:8000)

   ```bash
   # 设置环境变量并运行测试
   OPENAI_API_KEY=your_api_key npm run test:chroma
   ```

2. **模拟测试** (chroma.spec.ts):
```bash
npm run test:chroma:spec
```
此测试使用模拟(mock)实现而不需要实际的数据库连接或API密钥，适合快速验证和CI/CD环境。

## Using the MCP Server

The MCP server exposes the following resources and tools:

### Resources

- **Project Structure** (`project://{projectPath}`): Get the file structure of a project, respecting .gitignore patterns
  - Parameters:
    - `projectPath`: Path to the project root directory

### Tools

- **Analyze File**: Analyze the content and purpose of a file
  - Parameters:
    - `filePath`: Path to the file to analyze

- **Summarize Project**: Generate a summary of the project structure and key files, respecting .gitignore patterns
  - Parameters:
    - `projectPath`: Path to the project root
    - `maxDepth` (optional): Maximum depth to traverse (default: 3)

- **LangChain Demo**: Demonstrates LangChain integration for text generation
  - Parameters:
    - `prompt`: The text prompt to send to the language model
  - Requirements:
    - OpenAI API key must be provided via the `--openai-api-key` parameter

  - **Vector Database Tools**: Store and search code documentation using semantic vector search
  - **Vector Add** (`vector-add`): Add class or function documentation to the vector database
    - Parameters:
      - `type`: Document type (`class` or `function`)
      - `name`: The full name of the class or function
      - `namespace` (optional): The namespace or path of the class or function
      - `text`: The documentation content (should include summary and usage examples)
      - `projectName`: The project name (used as collection name)
      - `metadata` (optional): Additional metadata for the document
    - Example:
      ```json
      {
        "type": "class",
        "name": "UserRepository",
        "namespace": "app.repositories",
        "text": "負責用戶數據的CRUD操作。使用範例：const userRepo = new UserRepository(); const user = await userRepo.findById(123);",
        "projectName": "my-project"
      }
      ```
  - **Vector Search** (`vector-search`): Search for documentation using semantic search
    - Parameters:
      - `query`: The search query text
      - `projectName`: The project name to search in
      - `type` (optional): Filter by document type (`class` or `function`)
      - `name` (optional): Filter by class or function name
      - `namespace` (optional): Filter by namespace or path
    - Examples:
      ```json
      // Basic search
      {
        "query": "如何處理用戶驗證",
        "projectName": "my-project"
      }

      // Filtered search
      {
        "query": "數據庫操作",
        "type": "class",
        "namespace": "app.repositories",
        "projectName": "my-project"
      }
      ```
  - Requirements:
    - OpenAI API key must be provided via the `--openai-api-key` parameter
    - Chroma DB server running (can be specified via the `--chroma-server-url` parameter, defaults to http://localhost:8000)

## Connecting to the Server

The server uses the stdio transport by default, which means it communicates through standard input and output. You can connect to it using any MCP client that supports stdio transport.

Example using the MCP Inspector:

```bash
# Basic connection
npx -- @modelcontextprotocol/inspector connect --stdio "node dist/index.js"

# With parameters
npx -- @modelcontextprotocol/inspector connect --stdio "node dist/index.js --openai-api-key YOUR_API_KEY --chroma-server-url http://localhost:8000 --auth-token YOUR_AUTH_TOKEN"
```

You can also use the test:inspector script which is already set up in package.json:

```bash
npm run test:inspector -- --openai-api-key YOUR_API_KEY --chroma-server-url http://localhost:8000 --auth-token YOUR_AUTH_TOKEN
```

## Project Structure

```
mcp-project-overview/
├── dist/                  # Compiled JavaScript files
├── src/                   # TypeScript source files
│   ├── index.ts           # Main entry point with MCP server implementation
│   └── utils/             # Utility functions
│       ├── gitignore.ts   # Utilities for handling .gitignore patterns
│       ├── projectStructure.ts # Project structure analysis utilities
│       ├── langchain.ts   # LangChain integration utilities
│       └── chroma.ts      # Chroma vector database utilities
├── .gitignore             # Git ignore patterns for files to exclude from version control
├── .prettierrc            # Prettier configuration
├── .prettierignore        # Files to be ignored by Prettier
├── package.json           # Project dependencies and scripts
├── tsconfig.json          # TypeScript configuration
└── README.md              # Project documentation
```

## Dependencies

- [@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/typescript-sdk): SDK for implementing MCP servers and clients
- [LangChain.js](https://js.langchain.com/): Framework for developing applications powered by language models
- [@langchain/openai](https://js.langchain.com/docs/integrations/chat/openai): OpenAI integration for LangChain
- [@langchain/community](https://js.langchain.com/docs/integrations/vectorstores/chroma): Community integrations for LangChain
- [Chroma](https://www.trychroma.com/): Vector database for storing and retrieving embeddings
- TypeScript: For type-safe JavaScript development
- Other standard Node.js libraries

## License

ISC
