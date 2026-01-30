# AI Agent Guide: spotclean

**Role**: You are an AI assistant tasked with understanding, integrating, or extending `spotclean` error message sanitization in applications.

**Goal**: Provide a comprehensive understanding of `spotclean`'s capabilities, architecture, and usage patterns to facilitate correct implementation and extension.

## Core Capabilities

`spotclean` is an error message sanitization library for TypeScript/Node.js applications. It prevents information disclosure by sanitizing error messages before external exposure.

*   **Secret Detection**: Built-in patterns detect API keys, tokens, passwords, JWTs, and connection strings
*   **Path Redaction**: Automatically redacts file system paths that could reveal system structure
*   **Environment-Aware**: Different behavior for production vs development environments
*   **Correlation IDs**: Unique identifiers for tracking errors without exposing details
*   **Zero Dependencies**: Lightweight library with no external dependencies

## Quick Start Context

When analyzing or generating code using `spotclean`, keep these patterns in mind:

1.  **Configure Early**: Set up sanitization at application startup
2.  **Sanitize on Boundary**: Apply sanitization before errors leave the system
3.  **Log Internally**: Always preserve full error details for internal logging
4.  **Use Correlation IDs**: Enable error tracking without exposing details

```typescript
import { configureErrorSanitizer, sanitize } from '@utilarium/spotclean';

// Configure at startup
configureErrorSanitizer({
  environment: process.env.NODE_ENV === 'production' ? 'production' : 'development',
  includeCorrelationId: true,
});

// Use in error handlers
try {
  await riskyOperation();
} catch (error) {
  const { external, internal } = sanitize(error);
  
  // Log full details internally
  logger.error('Operation failed', { correlationId: internal.correlationId, ...internal });
  
  // Return safe message externally
  throw new Error(external.message);
}
```

## Architecture Overview

### Component Structure

```
spotclean/
├── src/
│   ├── spotclean.ts      # Main entry point and exports
│   ├── types.ts          # TypeScript interfaces
│   ├── sanitizer.ts      # ErrorSanitizer class
│   ├── secret-guard.ts   # SecretGuard for secret detection
│   └── path-sanitizer.ts # PathSanitizer for path redaction
└── tests/
    ├── sanitizer.test.ts
    ├── secret-guard.test.ts
    └── path-sanitizer.test.ts
```

### Key Classes

1.  **ErrorSanitizer**: Main class for error sanitization
    - Produces safe external messages
    - Generates correlation IDs
    - Environment-aware behavior
    
2.  **SecretGuard**: Detects and redacts secrets
    - Built-in patterns for common secrets
    - Custom pattern support
    - Configurable redaction text
    
3.  **PathSanitizer**: Redacts file system paths
    - Auto-detects home directory
    - Configurable base paths
    - System path redaction

### Data Flow

```
Error → ErrorSanitizer → SecretGuard (redact secrets) → PathSanitizer (redact paths)
                      ↓
              SanitizedErrorResult
                      ↓
            ├── external: Safe for users
            └── internal: Full details for logging
```

## Documentation Structure

This guide directory contains specialized documentation for different aspects of the system:

*   [Configuration](./configuration.md): Configuration options and customization
*   [Usage Patterns](./usage.md): Common integration patterns
*   [Architecture](./architecture.md): Internal design and module structure
*   [Development](./development.md): Guide for contributing to spotclean

## Common Integration Patterns

### Express/Koa Error Handler

```typescript
import { getErrorSanitizer } from '@utilarium/spotclean';

app.use((err, req, res, next) => {
  const { external, internal } = getErrorSanitizer().sanitize(err);
  
  req.log.error('Request failed', { correlationId: internal.correlationId, ...internal });
  
  res.status(500).json({
    error: external.message,
    correlationId: external.correlationId,
  });
});
```

### Async Function Wrapper

```typescript
import { withErrorHandling } from '@utilarium/spotclean';

const safeDbQuery = withErrorHandling(
  async (sql: string) => database.query(sql),
  { logger, context: { component: 'database' } }
);
```

### CLI Error Handler

```typescript
import { sanitizeUnknownError } from '@utilarium/spotclean';

try {
  await runCommand();
} catch (error) {
  const safe = sanitizeUnknownError(error);
  console.error(`Error: ${safe.message}`);
  if (safe.correlationId) {
    console.error(`Reference: ${safe.correlationId}`);
  }
  process.exit(1);
}
```

## Security Considerations

1.  **Production Mode**: Always use `environment: 'production'` in production
2.  **Custom Patterns**: Add patterns for application-specific secrets
3.  **Base Paths**: Configure base paths to redact project structure
4.  **Correlation IDs**: Enable for error tracking without detail exposure
5.  **Stack Traces**: Sanitize stack traces in production

## Testing Patterns

```typescript
import { ErrorSanitizer, SecretGuard } from '@utilarium/spotclean';

describe('Error handling', () => {
  it('should not leak secrets', () => {
    const sanitizer = new ErrorSanitizer({ environment: 'production' });
    const error = new Error('DB error: postgres://user:password@host/db');
    
    const { external } = sanitizer.sanitize(error);
    
    expect(external.message).not.toContain('password');
    expect(external.message).not.toContain('postgres://');
  });
});
```

