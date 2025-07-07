# Project Guidelines for Junie

## Project Overview
This project, `mcp-project-overview`, is a Model Context Protocol (MCP) server that provides tools for analyzing code projects, generating documentation, and managing vector databases. It uses OpenAI's language models and LangChain for semantic analysis and document summarization.

## Project Structure
- **src/**: Main source code directory
  - **cmd/**: Command implementations
    - `generateOverview.ts`: Generates project overview documents
  - **utils/**: Utility functions
    - `chroma.ts`: Handles interactions with ChromaDB vector database
    - `fileProcessing.ts`: File reading/writing and processing utilities
    - `langchain.ts`: OpenAI model initialization
    - `logger.ts`: Logging configuration
  - `index.ts`: Main entry point, sets up the MCP server

## Key Features
1. **Vector Database Management**: Add and search code documentation in a vector database
2. **Project Overview Generation**: Analyze source code to generate project overviews
3. **Developer Guidelines Generation**: Create developer guidelines from source code

## Running the Project
1. **Build the project**:
   ```
   npm run build
   ```

2. **Start the server**:
   ```
   npm run start
   ```

   Or with parameters:
   ```
   npm run start:with-params
   ```

3. **Development mode**:
   ```
   npm run dev
   ```

## Testing
Run tests using:
```
npm run test
```

For test coverage:
```
npm run test:coverage
```

## Code Style
The project uses Prettier for code formatting. Format code using:
```
npm run format
```

Check formatting:
```
npm run format:check
```

## Environment Variables
- `OPENAI_API_KEY`: Required for OpenAI API access (can also be provided via command line)

## Guidelines for Junie
When working with this project, Junie should:

1. **Run tests** to verify changes don't break existing functionality
2. **Format code** using Prettier before submitting changes
3. **Check for OpenAI API key requirements** when testing functionality that uses AI models
4. **Build the project** before submitting to ensure TypeScript compilation succeeds
5. **Consider language preferences** - the project uses both English and Chinese in comments and documentation

## Common Issues
- Missing OpenAI API key will cause AI-related features to fail
- ChromaDB connection issues may occur if the vector database is not properly set up
