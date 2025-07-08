# Project Guidelines for Junie

## Project Overview
This project, `mcp-project-overview`, is a Model Context Protocol (MCP) server that provides tools for analyzing code projects, generating documentation, and managing vector databases. It uses OpenAI's language models and LangChain for semantic analysis and document summarization.

## Project Structure
- **src/**: Main source code directory
  - **cmd/**: Command implementations
    - `generateOverview.ts`: Generates project overview documents
  - **domain/**: Domain models and repositories
    - **model/**: Domain model definitions
      - `overview.ts`: Defines Overview model for code entities
    - **repository/**: Repository implementations (currently empty)
  - **procedure/**: Procedure execution framework
    - **overview/**: Overview-specific procedures
      - `ctx.ts`: Context for overview procedures
    - `procedure.ts`: Core procedure execution framework
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
4. **Procedure Execution Framework**: Structured approach to executing processes with error handling
5. **Domain-Driven Design**: Clear separation of domain models and business logic

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

### Working with Procedure Module
The procedure module implements a structured approach to executing processes:
- Use the `Procedure` class to execute processes in sequence
- Implement the `IProcess` interface or extend the `BaseProcess` abstract class for new processes
- Extend `IProcedureContext` and `BaseProcedureContext` for custom contexts
- Use the error handling mechanism for graceful failure handling
- Check for errors using the `isErr()` and `getErr()` methods

### Working with Domain Models
The domain module contains models that represent core business entities:
- The `Overview` class represents code entities (classes, interfaces, functions)
- Use the appropriate `OverviewType` for different code entities
- Domain models should be kept clean of infrastructure concerns

### Working with Overview Generation
The project supports generating both overviews and guidelines:
- Use `generateProjectOverview` function with appropriate parameters
- Specify 'overview' or 'guidelines' as the summary type
- The function supports both English and Chinese output
- Existing overview files will be updated rather than overwritten

## Common Issues
- Missing OpenAI API key will cause AI-related features to fail
- ChromaDB connection issues may occur if the vector database is not properly set up
- Procedure execution may fail silently if error handling is not properly implemented
- Overview generation may produce unexpected results if file paths contain special characters

## Technical Details

### Procedure Execution Framework
The procedure module provides a structured way to execute processes:
- `IProcedureContext`: Interface for context objects with methods for getting context information and logger
- `IProcess<TCtx>`: Interface for processes that can be executed within a procedure with a specific context type
- `BaseProcess`: Abstract class that implements the IProcess interface and provides a base for process implementations
- `BaseProcedureContext`: Maintains state of procedure execution, including error tracking and execution stack
- `Procedure<TCtx>`: Main class that executes processes, handles errors, and manages execution flow

#### Example Usage:
```typescript
// Create a context
const ctx = await CodeOverviewCtx.from(projectName, openAiKey);

// Create a procedure with the context
const procedure = Procedure.new(ctx);

// Execute processes
await procedure
  .execute(new SomeProcess())
  .execute(new AnotherProcess());

// Check for errors
if (procedure.isErr()) {
  console.error('Procedure failed:', procedure.getErr());
}
```

### Overview Context
The overview context connects procedures with domain models and external services:
- Manages project overview information with properties like `projectName` and `overviews`
- Integrates with ChromaDB for vector storage
- Uses OpenAI embeddings for semantic analysis
- Provides a static `from` method to create a context with initialized services

### Domain Models
The domain models represent the core business entities:
- `OverviewType`: Represents the type of code entity ('class', 'interface', or 'function')
- `IOverview`: Defines the structure of an overview with properties like id, name, description
- `Overview`: Implements the `IOverview` interface and adds a `filePath` property
