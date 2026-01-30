# Path Sanitizer

PathSanitizer redacts file system paths that could reveal system structure, user information, or project organization.

## Basic Usage

```typescript
import { PathSanitizer } from '@utilarium/spotclean';

const sanitizer = new PathSanitizer({
  enabled: true,
  basePaths: ['/app/project'],
  basePathReplacement: '[PATH]',
  redactSystemPaths: true,
});

const safe = sanitizer.redact('Error at /home/user/secret/file.ts');
// Result: 'Error at /home/[USER]/secret/file.ts'
```

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | boolean | `true` | Master switch |
| `basePaths` | string[] | `[]` | Paths to redact |
| `basePathReplacement` | string | `'[PATH]'` | Replacement text for base paths |
| `redactSystemPaths` | boolean | `true` | Auto-detect common system paths |
| `customPatterns` | Array | `[]` | Custom path patterns |

## Automatic Path Detection

PathSanitizer automatically detects and redacts:

### Home Directory
The user's home directory is automatically detected from:
- `HOME` environment variable (Unix)
- `USERPROFILE` environment variable (Windows)

```typescript
// Input: Error at /Users/jsmith/projects/app/src/index.ts
// Output: Error at /Users/[USER]/projects/app/src/index.ts
```

### System Paths
When `redactSystemPaths` is enabled:

| Path | Replacement |
|------|-------------|
| `/proc/...` | `[SYSTEM]` |
| `/tmp/...` | `[TMP]` |
| `/var/log/...` | `[LOG]` |
| Windows temp | `[TMP]` |

## Base Path Redaction

Configure application-specific paths:

```typescript
const sanitizer = new PathSanitizer({
  basePaths: [
    process.cwd(),           // Current working directory
    '/app',                  // Docker container path
    '/var/www/myapp',        // Deployment path
  ],
  basePathReplacement: '[APP]',
});

const safe = sanitizer.redact('Error in /var/www/myapp/src/db.ts');
// Result: 'Error in [APP]/src/db.ts'
```

## Custom Patterns

Add patterns for application-specific paths:

```typescript
const sanitizer = new PathSanitizer({
  customPatterns: [
    {
      pattern: /\/internal\/[a-z]+/g,
      replacement: '/internal/[SERVICE]',
    },
    {
      pattern: /\/secrets\/[^/]+/g,
      replacement: '/secrets/[FILE]',
    },
  ],
});
```

## Global Configuration

```typescript
import { 
  getPathSanitizer, 
  configurePathSanitizer 
} from '@utilarium/spotclean';

configurePathSanitizer({
  basePaths: [process.cwd()],
  redactSystemPaths: true,
});

const sanitizer = getPathSanitizer();
const safe = sanitizer.redact(errorMessage);
```

## Cross-Platform Support

PathSanitizer handles both Unix and Windows paths:

```typescript
// Unix
'/home/user/project/src/index.ts'
// Windows
'C:\\Users\\User\\project\\src\\index.ts'

// Both are properly detected and redacted
```

## Stack Trace Paths

PathSanitizer is especially useful for sanitizing stack traces:

```typescript
const error = new Error('Something went wrong');
const safeStack = sanitizer.redact(error.stack);

// Before: at Function.process (/home/dev/app/src/process.ts:42:15)
// After: at Function.process ([PATH]/src/process.ts:42:15)
```

## Best Practices

### 1. Configure Early

Set up path sanitization at application startup:

```typescript
// app.ts
import { configurePathSanitizer } from '@utilarium/spotclean';

configurePathSanitizer({
  basePaths: [process.cwd()],
  redactSystemPaths: true,
});
```

### 2. Include Deployment Paths

Add all paths where your application might be deployed:

```typescript
configurePathSanitizer({
  basePaths: [
    process.cwd(),           // Local development
    '/app',                  // Docker
    '/var/www/myapp',        // Traditional deployment
    process.env.APP_ROOT,    // Environment-based
  ].filter(Boolean),
});
```

### 3. Don't Over-Redact

Be careful not to make paths completely useless for debugging:

```typescript
// Too aggressive - loses all context
'/[PATH]'

// Better - preserves relative structure
'[APP]/src/services/auth.ts:42'
```

