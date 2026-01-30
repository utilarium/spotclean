# Getting Started

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
npm install @utilarium/spotclean
```

Or with your preferred package manager:

```bash
yarn add @utilarium/spotclean
pnpm add @utilarium/spotclean
```

## Quick Start

```typescript
import { 
  sanitize, 
  createSafeError, 
  configureErrorSanitizer 
} from '@utilarium/spotclean';

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

## Using createSafeError

```typescript
import { createSafeError } from '@utilarium/spotclean';

try {
  throw new Error('Failed to connect to postgres://admin:secret@db.internal:5432');
} catch (error) {
  // Creates a new Error with sanitized message
  const safe = createSafeError(error);
  throw safe; // Safe to propagate
}
```

## Environment-Aware Behavior

Spotclean behaves differently based on environment:

| Environment | Behavior |
|------------|----------|
| `production` | Generic messages, full redaction, no stack traces |
| `development` | Detailed messages with secrets redacted |
| `test` | Same as development |

## Next Steps

- Learn about [Error Sanitizer](./error-sanitizer.md) in detail
- Explore [Secret Guard](./secret-guard.md) for secret detection
- Set up [Path Sanitizer](./path-sanitizer.md) for path redaction
- Check [Integration Patterns](./integration.md) for common usage

