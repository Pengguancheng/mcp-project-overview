# Strategy Summary Project Guidelines

This document provides guidelines and instructions for developing and maintaining the Strategy Summary project.

## Build and Configuration Instructions

### Local Development Setup

1. **Prerequisites**:
    - Go 1.24 or later
    - MongoDB running on localhost:27017
    - Redis running on localhost:6379
    - RabbitMQ running on localhost:5672 with admin:admin credentials

2. **Building the Application**:
   ```bash
   go build -o bin/app ./main.go
   ```

3. **Running the Application**:
   ```bash
   # For development environment
   ./bin/app -env develop

   # For production environment
   ./bin/app -env prod
   ```

### Docker Deployment

1. **Building the Docker Image**:
   ```bash
   ./build_image.sh
   # or
   docker build -t strategy-summary .
   ```

2. **Running the Docker Container**:
   ```bash
   docker run -p 7001:7001 strategy-summary
   ```

### Configuration

The application uses JSON configuration files based on the environment:
- `config.develop.json` for development
- `config.prod.json` for production

Configuration parameters:
- `logPath`: Path to store log files
- `redisUrl`: Redis connection URL
- `rmqUrl`: RabbitMQ connection URL
- `mongoUrl`: MongoDB connection URL
- `servicePort`: Port for the gRPC service
- `grpcUrl`: URLs for other gRPC services

## Testing Information

### Running Tests

To run all tests:
```bash
go test ./...
```

To run tests with verbose output:
```bash
go test -v ./...
```

To run tests in a specific package:
```bash
go test -v ./persistent/persistent_mongo
```

### Test Database Setup

Tests use a separate MongoDB database named `test_db`. The connection is established in `persistent/persistent_mongo/applibs_test.go`.

### Writing Tests

1. **Test File Naming**: Test files should be named with the `_test.go` suffix.

2. **Test Function Naming**: Test functions should be named with the `Test` prefix followed by the name of the function being tested.

3. **Test Structure**:
    - Use the `testing` package
    - Use `github.com/stretchr/testify/assert` for assertions
    - Create setup functions to prepare the test environment
    - Clean up resources after tests

### Example Test

```go
package utils_test

import (
	"testing"
	"github.com/stretchr/testify/assert"
)

// Function to test
func Sum(a, b int) int {
	return a + b
}

func TestSum(t *testing.T) {
	// Test case 1: Positive numbers
	result := Sum(2, 3)
	assert.Equal(t, 5, result, "Sum of 2 and 3 should be 5")

	// Test case 2: Negative numbers
	result = Sum(-2, -3)
	assert.Equal(t, -5, result, "Sum of -2 and -3 should be -5")

	// Test case 3: Mixed numbers
	result = Sum(-2, 3)
	assert.Equal(t, 1, result, "Sum of -2 and 3 should be 1")
}
```

To run this test:
```bash
go test -v
```

## Code Structure and Development Guidelines

### Project Structure

- `app/`: Application context and initialization
- `applibs/`: Application libraries and utilities
- `config/`: Configuration handling
- `domain/`: Domain models and repositories
    - `model/`: Data models
    - `repository/`: Repository interfaces
- `handler/`: Event handlers
- `persistent/`: Repository implementations
    - `persistent_mongo/`: MongoDB implementations
- `procedure/`: Business logic procedures
- `proto/`: Protocol buffer definitions and generated code
- `proto_service/`: gRPC service implementations

### Development Workflow

1. **Adding a New Feature**:
    - Define the protocol buffer messages and services in the `proto/` directory
    - Generate the Go code using the protobuf compiler
    - Implement the domain models in `domain/model/`
    - Define repository interfaces in `domain/repository/`
    - Implement repositories in `persistent/persistent_mongo/`
    - Implement business logic in `procedure/`
    - Implement gRPC service handlers in `proto_service/`
    - Write tests for each component

2. **Modifying Existing Features**:
    - Update the protocol buffer definitions if needed
    - Regenerate the Go code
    - Update the affected components
    - Update or add tests

### Coding Standards

- Follow standard Go coding conventions
- Use meaningful variable and function names
- Write comprehensive comments for public functions and complex logic
- Write tests for all new functionality
- Keep functions small and focused on a single responsibility

## Procedure Development

Procedures are the core business logic components of the application. They are designed to be modular, reusable, and testable.

### Procedure Structure

Each procedure follows a common structure:
1. A struct that may contain dependencies (repositories, clients, etc.)
2. A `GetProcessId()` method that returns a unique identifier for the procedure
3. A `Process(ctx, eventFunc)` method that implements the business logic

### Overview Summary Procedures

The `procedure/pro_overview_summary` package contains procedures for processing and summarizing overview data:

#### Context

The `ctx.go` file defines the context structure used by all procedures in this package:
- `Model`: Contains the task ID, overview summary data, and symbols
- `Context`: Wraps the model and provides logging capabilities

#### Available Procedures

1. **ProGetOverviewData**
    - Purpose: Retrieves overview data for a specific task ID from the agent service
    - Implementation: Uses gRPC to call the agent service and populates the context with the retrieved data
    - File: `pro_getOverviewData.go`

2. **ProSummary**
    - Purpose: Calculates summary statistics based on the overview data
    - Implementation: Computes weighted statistics (max, min, avg) for various metrics like profit percent, profit value, max drawdown, etc.
    - File: `pro_summary.go`

3. **ProFlush**
    - Purpose: Persists the overview and summary data to the database
    - Implementation: Uses repositories to upsert the data
    - File: `pro_flush.go`

4. **ProClearOverview**
    - Purpose: Clears all overview and summary data from the database
    - Implementation: Uses repositories to delete all data
    - File: `pro_clear.go`

### Using Procedures

Procedures are typically chained together to form a workflow. For example, a typical workflow for processing overview data might be:
1. Get overview data using `ProGetOverviewData`
2. Calculate summary statistics using `ProSummary`
3. Persist the data using `ProFlush`

Each procedure is executed in sequence, with the context being passed between them to maintain state.
