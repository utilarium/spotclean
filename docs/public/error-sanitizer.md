# Error Sanitizer

The ErrorSanitizer is the main component that coordinates sanitization of error messages. It combines secret detection, path redaction, and environment-aware message mapping.

## Basic Usage

```typescript
import { ErrorSanitizer } from '@theunwalked/spotclean';

const sanitizer = new ErrorSanitizer({
  enabled: true,
  environment: 'production',
  includeCorrelationId: true,
  maxMessageLength: 500,
  sanitizeStackTraces: true,
});

const { external, internal } = sanitizer.sanitize(error);
```

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | boolean | `true` | Master switch for sanitization |
| `environment` | string | `'development'` | `'production'`, `'development'`, or `'test'` |
| `includeCorrelationId` | boolean | `false` | Add correlation IDs to errors |
| `maxMessageLength` | number | `500` | Truncate messages longer than this |
| `sanitizeStackTraces` | boolean | `true` | Remove stack traces in production |

## Sanitization Result

The `sanitize()` method returns both external and internal representations:

```typescript
interface SanitizedErrorResult {
  external: {
    message: string;           // Safe for users
    correlationId?: string;    // For error tracking
  };
  internal: {
    originalMessage: string;   // Full original message
    originalStack?: string;    // Full stack trace
    correlationId?: string;    // Same correlation ID
    sanitizedMessage: string;  // Message with secrets redacted
  };
}
```

## Global vs Instance

Use the global instance for application-wide configuration:

```typescript
import { 
  getErrorSanitizer, 
  configureErrorSanitizer 
} from '@theunwalked/spotclean';

// Configure once at startup
configureErrorSanitizer({
  environment: 'production',
  includeCorrelationId: true,
});

// Use global instance anywhere
const { external } = getErrorSanitizer().sanitize(error);
```

Or create isolated instances:

```typescript
import { ErrorSanitizer } from '@theunwalked/spotclean';

const apiSanitizer = new ErrorSanitizer({
  environment: 'production',
  maxMessageLength: 200, // Shorter for API responses
});
```

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

## Correlation IDs

Correlation IDs help track errors without exposing details:

```typescript
configureErrorSanitizer({
  includeCorrelationId: true,
});

const { external } = sanitize(error);
// external.correlationId: "err-abc123-0001-xyz"

// User sees: "An error occurred. Reference: err-abc123-0001-xyz"
// Support can look up full details using correlation ID
```

## Using withErrorHandling Wrapper

Wrap functions to automatically sanitize errors:

```typescript
import { withErrorHandling } from '@theunwalked/spotclean';

const logger = {
  error: (msg, ctx) => console.error(msg, ctx),
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

## Data Flow

```
Error received
     │
Generate correlation ID
     │
Store original message and stack (internal)
     │
Check environment
     │
     ├─ Development: Apply SecretGuard redaction only
     │
     └─ Production: Map to generic message
     │
Truncate if exceeds maxMessageLength
     │
Return { external, internal }
```

