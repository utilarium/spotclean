# API Reference

Complete API documentation for Spotclean.

## ErrorSanitizer

### ErrorSanitizer Class

```typescript
class ErrorSanitizer {
  constructor(config?: Partial<ErrorSanitizerConfig>);
  
  sanitize(error: unknown): SanitizedErrorResult;
}
```

### ErrorSanitizerConfig

```typescript
interface ErrorSanitizerConfig {
  enabled: boolean;           // Default: true
  environment: string;        // 'production' | 'development' | 'test'
  includeCorrelationId: boolean;  // Default: false
  maxMessageLength: number;   // Default: 500
  sanitizeStackTraces: boolean;   // Default: true
}
```

### SanitizedErrorResult

```typescript
interface SanitizedErrorResult {
  external: {
    message: string;
    correlationId?: string;
  };
  internal: {
    originalMessage: string;
    originalStack?: string;
    correlationId?: string;
    sanitizedMessage: string;
  };
}
```

### Global Functions

```typescript
function getErrorSanitizer(): ErrorSanitizer;
function configureErrorSanitizer(config: Partial<ErrorSanitizerConfig>): void;
function sanitize(error: unknown): SanitizedErrorResult;
function createSafeError(error: unknown): Error;
```

## SecretGuard

### SecretGuard Class

```typescript
class SecretGuard {
  constructor(config?: Partial<SecretGuardConfig>);
  
  redact(text: string): string;
  detect(text: string): DetectionResult;
  getPatterns(): SecretPattern[];
}
```

### SecretGuardConfig

```typescript
interface SecretGuardConfig {
  enabled: boolean;           // Default: true
  customPatterns: SecretPattern[];
  redactionText: string;      // Default: '[REDACTED]'
  preservePartial: boolean;   // Default: false
  preserveLength: number;     // Default: 4
}
```

### SecretPattern

```typescript
interface SecretPattern {
  name: string;
  pattern: RegExp;
  description?: string;
}
```

### DetectionResult

```typescript
interface DetectionResult {
  hasSecrets: boolean;
  matches: Array<{
    name: string;
    value: string;
    index: number;
  }>;
}
```

### Global Functions

```typescript
function getSecretGuard(): SecretGuard;
function configureSecretGuard(config: Partial<SecretGuardConfig>): void;
```

## PathSanitizer

### PathSanitizer Class

```typescript
class PathSanitizer {
  constructor(config?: Partial<PathSanitizerConfig>);
  
  redact(text: string): string;
}
```

### PathSanitizerConfig

```typescript
interface PathSanitizerConfig {
  enabled: boolean;           // Default: true
  basePaths: string[];        // Default: []
  basePathReplacement: string;  // Default: '[PATH]'
  redactSystemPaths: boolean;   // Default: true
  customPatterns: Array<{
    pattern: RegExp;
    replacement: string;
  }>;
}
```

### Global Functions

```typescript
function getPathSanitizer(): PathSanitizer;
function configurePathSanitizer(config: Partial<PathSanitizerConfig>): void;
```

## Error Handling Utilities

### withErrorHandling

Wrap a function to automatically sanitize errors.

```typescript
function withErrorHandling<T extends (...args: any[]) => any>(
  fn: T,
  options?: ErrorHandlingOptions
): T;

interface ErrorHandlingOptions {
  logger?: Logger;
  context?: Record<string, unknown>;
  rethrow?: boolean;  // Default: true
}

interface Logger {
  error: (message: string, context?: unknown) => void;
  warn?: (message: string) => void;
  info?: (message: string) => void;
}
```

### sanitizeUnknownError

Sanitize any thrown value.

```typescript
function sanitizeUnknownError(error: unknown): {
  message: string;
  correlationId?: string;
};
```

## Type Exports

All types are exported from the main module:

```typescript
import type {
  ErrorSanitizer,
  ErrorSanitizerConfig,
  SanitizedErrorResult,
  SecretGuard,
  SecretGuardConfig,
  SecretPattern,
  DetectionResult,
  PathSanitizer,
  PathSanitizerConfig,
  ErrorHandlingOptions,
  Logger,
} from '@utilarium/spotclean';
```

## Default Export

The package provides named exports:

```typescript
import {
  // Classes
  ErrorSanitizer,
  SecretGuard,
  PathSanitizer,
  
  // Global instance functions
  getErrorSanitizer,
  configureErrorSanitizer,
  getSecretGuard,
  configureSecretGuard,
  getPathSanitizer,
  configurePathSanitizer,
  
  // Convenience functions
  sanitize,
  createSafeError,
  withErrorHandling,
  sanitizeUnknownError,
} from '@utilarium/spotclean';
```

