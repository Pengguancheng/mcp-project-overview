# MCP Project Overview

MCP Server for creating code project file architecture and summary using the Model Context Protocol (MCP).

## Description

This is a Node.js application built with TypeScript that implements an MCP server to help analyze and summarize code project architecture. It uses the [@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/typescript-sdk) to provide resources and tools for project analysis.

## Features

- **Project Structure Resource**: Get a structured view of a project's file hierarchy
- **File Analysis Tool**: Analyze the content and purpose of individual files
- **Project Summary Tool**: Generate a comprehensive summary of a project including its structure and package information

## Prerequisites

- Node.js (v18 or higher)
- npm (v6 or higher)

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

## Connecting to the Server

The server uses the stdio transport by default, which means it communicates through standard input and output. You can connect to it using any MCP client that supports stdio transport.

Example using the MCP Inspector:

```bash
npx @modelcontextprotocol/inspector connect --stdio "node dist/index.js"
```

## Project Structure

```
mcp-project-overview/
├── dist/                  # Compiled JavaScript files
├── src/                   # TypeScript source files
│   ├── index.ts           # Main entry point with MCP server implementation
│   └── utils/             # Utility functions
│       ├── gitignore.ts   # Utilities for handling .gitignore patterns
│       └── projectStructure.ts # Project structure analysis utilities
├── .gitignore             # Git ignore patterns for files to exclude from version control
├── .prettierrc            # Prettier configuration
├── .prettierignore        # Files to be ignored by Prettier
├── package.json           # Project dependencies and scripts
├── tsconfig.json          # TypeScript configuration
└── README.md              # Project documentation
```

## Dependencies

- [@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/typescript-sdk): SDK for implementing MCP servers and clients
- TypeScript: For type-safe JavaScript development
- Other standard Node.js libraries

## License

ISC
