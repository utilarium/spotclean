# Spotclean

A robust TypeScript library for error message sanitization to prevent information disclosure and secret leakage in production applications.

## What is Spotclean?

Spotclean sanitizes error messages before they are exposed to users, preventing accidental disclosure of sensitive information like:

- **API keys and tokens** - Bearer tokens, JWTs, AWS credentials
- **Database credentials** - Connection strings, passwords
- **File system paths** - Home directories, project structure
- **Internal details** - Stack traces, server configurations

## Why Spotclean?

In production environments, error messages often contain sensitive information that could be exploited by attackers. Spotclean provides:

- **Automatic secret detection** - Built-in patterns for common secrets
- **Path redaction** - Prevents disclosure of directory structure
- **Environment-aware behavior** - Different handling for dev vs production
- **Correlation IDs** - Track errors without exposing details
- **Zero dependencies** - Lightweight and secure

## Installation

```bash
npm install @theunwalked/spotclean
# or
yarn add @theunwalked/spotclean
# or
pnpm add @theunwalked/spotclean
```

## Quick Start

```typescript
import { 
  sanitize, 
  createSafeError, 
  configureErrorSanitizer 
} from '@theunwalked/spotclean';

// Configure for production
configureErrorSanitizer({ 
  environment: 'production',
  includeCorrelationId: true 
});

try {
  // Your code that might throw
  await connectToDatabase();
} catch (error) {
  // Sanitize the error before showing to user
  const { external, internal } = sanitize(error);
  
  // Log full details internally
  logger.error('Database connection failed', {
    correlationId: internal.correlationId,
    message: internal.originalMessage,
    stack: internal.originalStack,
  });
  
  // Show safe message to user
  res.status(500).json({
    error: external.message,
    correlationId: external.correlationId,
  });
}
```

### Using createSafeError

```typescript
import { createSafeError } from '@theunwalked/spotclean';

try {
  throw new Error('Failed to connect to postgres://admin:secret@db.internal:5432');
} catch (error) {
  // Creates a new Error with sanitized message
  const safe = createSafeError(error);
  throw safe; // Safe to propagate
}
```

### Using withErrorHandling wrapper

```typescript
import { withErrorHandling } from '@theunwalked/spotclean';

const logger = {
  error: (msg, ctx) => console.error(msg, ctx),
  // ... other methods
};

// Wrap async functions automatically
const safeFetch = withErrorHandling(
  async (url: string) => {
    const response = await fetch(url);
    return response.json();
  },
  { logger }
);

// Errors are automatically sanitized and logged
const data = await safeFetch('https://api.example.com/data');
```

## API Reference

### ErrorSanitizer

The main class for sanitizing errors.

```typescript
import { ErrorSanitizer } from '@theunwalked/spotclean';

const sanitizer = new ErrorSanitizer({
  enabled: true,                    // Enable sanitization
  environment: 'production',        // 'production' | 'development' | 'test'
  includeCorrelationId: true,       // Add correlation IDs
  maxMessageLength: 500,            // Truncate long messages
  sanitizeStackTraces: true,        // Remove stack traces in production
});

const { external, internal } = sanitizer.sanitize(error);
```

### SecretGuard

Detects and redacts secrets from strings.

```typescript
import { SecretGuard } from '@theunwalked/spotclean';

const guard = new SecretGuard({
  enabled: true,
  redactionText: '[REDACTED]',
  preservePartial: false,           // Show last N characters
  preserveLength: 4,
  customPatterns: [
    {
      name: 'custom-id',
      pattern: /CUSTOM-[A-Z0-9]{10}/g,
      description: 'Custom ID format',
    },
  ],
});

const safe = guard.redact('api_key=sk_live_1234567890abcdef');
// Result: 'api_key=[REDACTED]'
```

### PathSanitizer

Redacts file system paths.

```typescript
import { PathSanitizer } from '@theunwalked/spotclean';

const sanitizer = new PathSanitizer({
  enabled: true,
  basePaths: ['/app/project'],      // Paths to redact
  basePathReplacement: '[PATH]',
  redactSystemPaths: true,          // Auto-detect common paths
});

const safe = sanitizer.redact('Error at /home/user/secret/file.ts');
// Result: 'Error at /home/[USER]/secret/file.ts'
```

## Global Configuration

Configure once at application startup:

```typescript
import { 
  configureErrorSanitizer,
  configureSecretGuard,
  configurePathSanitizer,
} from '@theunwalked/spotclean';

// Configure all components
configureErrorSanitizer({
  environment: process.env.NODE_ENV === 'production' ? 'production' : 'development',
  includeCorrelationId: true,
});

configureSecretGuard({
  customPatterns: [
    { name: 'internal-key', pattern: /INTERNAL-[A-Z]{20}/g },
  ],
});

configurePathSanitizer({
  basePaths: [process.cwd()],
});
```

## Built-in Secret Patterns

Spotclean detects these secret types by default:

- API keys (`api_key=...`, `apikey:...`)
- Bearer tokens (`Bearer ...`)
- AWS credentials (`AKIA...`)
- Passwords (`password=...`, `pwd=...`)
- JWTs (`eyJ...`)
- Connection strings (`postgres://...`, `mongodb://...`)
- Private keys (`-----BEGIN PRIVATE KEY-----`)
- Environment-style secrets (`DATABASE_PASSWORD=...`)

## Error Message Mapping

In production mode, Spotclean maps errors to generic messages:

| Error Type/Content | Generic Message |
|-------------------|-----------------|
| TimeoutError | The operation timed out. Please try again. |
| Not found, ENOENT | The requested resource was not found. |
| Permission, EACCES | You do not have permission to perform this action. |
| Invalid, validation | The provided data is invalid. |
| Network, connection | A network error occurred. Please check your connection. |
| Authentication | Authentication failed. |
| Rate limit | Too many requests. Please slow down. |

## Best Practices

### 1. Configure Early

Set up Spotclean at application startup before any errors can occur:

```typescript
// app.ts
import { configureErrorSanitizer } from '@theunwalked/spotclean';

configureErrorSanitizer({
  environment: process.env.NODE_ENV as any,
});
```

### 2. Log Internal Details

Always log full error details internally while showing safe messages externally:

```typescript
const { external, internal } = sanitize(error);

// Internal logging with correlation ID
logger.error('Error occurred', {
  correlationId: internal.correlationId,
  message: internal.originalMessage,
  stack: internal.originalStack,
});

// External response
return { error: external.message, correlationId: external.correlationId };
```

### 3. Use Correlation IDs

Help users report issues without exposing details:

```typescript
// User sees: "An error occurred. Reference: err-abc123-0001-xyz"
// Support can look up full details using correlation ID
```

### 4. Test in Development

Enable development mode locally to see detailed errors during development:

```typescript
configureErrorSanitizer({
  environment: process.env.NODE_ENV === 'production' ? 'production' : 'development',
});
```

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## License

Apache-2.0 - see [LICENSE](LICENSE) file for details.

## Why "Spotclean"?

Like spot-cleaning a stain before it spreads, Spotclean removes sensitive information from error messages before they can leak to unauthorized parties.

TEST
