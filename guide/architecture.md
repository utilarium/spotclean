# Architecture Guide: spotclean

This document describes the internal architecture and design decisions of the spotclean library.

## Overview

Spotclean is designed as a layered sanitization system where each component handles a specific type of sensitive information:

```
┌─────────────────────────────────────────────────────────────┐
│                     ErrorSanitizer                          │
│  - Coordinates sanitization                                 │
│  - Generates correlation IDs                                │
│  - Environment-aware message mapping                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      SecretGuard                            │
│  - Pattern-based secret detection                           │
│  - Configurable redaction                                   │
│  - Custom pattern support                                   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     PathSanitizer                           │
│  - File system path detection                               │
│  - User directory redaction                                 │
│  - Project structure protection                             │
└─────────────────────────────────────────────────────────────┘
```

## Component Details

### ErrorSanitizer

The main orchestrator that coordinates the sanitization process.

**Responsibilities:**
- Accept Error objects and optional context
- Generate unique correlation IDs
- Delegate to SecretGuard for secret redaction
- Apply generic message mapping in production
- Produce both external (safe) and internal (full) error representations

**Key Design Decisions:**
- Environment-aware: Detailed messages in development, generic in production
- Always preserves full details internally for debugging
- Correlation IDs use timestamp + counter + random for uniqueness

### SecretGuard

Detects and redacts secrets using regex patterns.

**Responsibilities:**
- Maintain a list of secret patterns
- Match and redact secrets from strings
- Support custom patterns for application-specific secrets

**Built-in Patterns:**
1. `api-key`: API keys in various formats
2. `bearer-token`: Bearer authorization tokens
3. `aws-key`: AWS Access Key IDs
4. `password`: Password values
5. `secret`: Generic secrets and tokens
6. `private-key`: PEM-format private keys
7. `jwt`: JSON Web Tokens
8. `connection-string`: Database connection strings
9. `generic-secret-env`: Environment variable style secrets

**Key Design Decisions:**
- Patterns use global flag for multiple matches
- Reset lastIndex before each use for regex safety
- Preserve partial content option for debugging

### PathSanitizer

Redacts file system paths that could reveal system structure.

**Responsibilities:**
- Detect and redact home directories
- Redact configured base paths
- Handle both Unix and Windows path formats
- Protect system paths (/proc, /tmp, etc.)

**Key Design Decisions:**
- Auto-detects HOME/USERPROFILE at initialization
- Base paths are escaped for safe regex usage
- Custom patterns applied before system patterns

## Data Flow

### Sanitization Process

```
1. Error received
   │
2. Generate correlation ID
   │
3. Store original message and stack (internal)
   │
4. Check environment
   │
   ├─ Development: Apply SecretGuard redaction only
   │
   └─ Production: Map to generic message
   │
5. Truncate if exceeds maxMessageLength
   │
6. Return { external, internal }
```

### withErrorHandling Wrapper

```
1. Wrap async function
   │
2. Execute wrapped function
   │
   ├─ Success: Return result unchanged
   │
   └─ Error:
      │
      ├─ Sanitize error
      │
      ├─ Log internal details (if logger provided)
      │
      └─ Throw sanitized error (if rethrow=true)
```

## Configuration

### ErrorSanitizerConfig

```typescript
interface ErrorSanitizerConfig {
  enabled: boolean;           // Master switch
  environment: string;        // 'production' | 'development' | 'test'
  includeCorrelationId: boolean;  // Add correlation IDs
  maxMessageLength: number;   // Truncate long messages
  sanitizeStackTraces: boolean;   // Remove stack in production
}
```

### SecretGuardConfig

```typescript
interface SecretGuardConfig {
  enabled: boolean;           // Master switch
  customPatterns: SecretPattern[];  // Additional patterns
  redactionText: string;      // Replacement text
  preservePartial: boolean;   // Show last N characters
  preserveLength: number;     // N for partial preservation
}
```

### PathSanitizerConfig

```typescript
interface PathSanitizerConfig {
  enabled: boolean;           // Master switch
  basePaths: string[];        // Paths to redact
  basePathReplacement: string;  // Replacement text
  redactSystemPaths: boolean;   // Auto-detect system paths
  customPatterns: Array<{pattern: RegExp, replacement: string}>;
}
```

## Global vs Instance

Each component supports both global singleton and instance usage:

```typescript
// Global usage
import { getErrorSanitizer, configureErrorSanitizer } from '@theunwalked/spotclean';

configureErrorSanitizer({ environment: 'production' });
const sanitizer = getErrorSanitizer();  // Returns global instance

// Instance usage
import { ErrorSanitizer } from '@theunwalked/spotclean';

const sanitizer = new ErrorSanitizer({ environment: 'production' });
```

The global pattern is recommended for application-wide configuration, while instances allow component-specific behavior.

## Extension Points

### Custom Secret Patterns

```typescript
const guard = new SecretGuard({
  customPatterns: [
    {
      name: 'my-app-token',
      pattern: /MYAPP-[A-Z0-9]{32}/g,
      description: 'MyApp internal tokens',
    },
  ],
});
```

### Custom Path Patterns

```typescript
const sanitizer = new PathSanitizer({
  customPatterns: [
    { pattern: /\/internal\/[a-z]+/g, replacement: '/internal/[SERVICE]' },
  ],
});
```

### Custom Error Handlers

The `withErrorHandling` wrapper accepts custom loggers:

```typescript
const wrapped = withErrorHandling(fn, {
  logger: customLogger,
  context: { component: 'myService' },
  rethrow: true,
});
```

## Security Considerations

1. **Pattern Order**: More specific patterns should come before generic ones
2. **Regex Safety**: All patterns reset lastIndex before use
3. **Immutability**: getPatterns() returns copies, not originals
4. **Environment Default**: Defaults to 'development' if NODE_ENV is not set
5. **No Eval**: No dynamic code execution or user-supplied regex

