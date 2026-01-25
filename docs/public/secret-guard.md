# Secret Guard

SecretGuard detects and redacts secrets from strings using regex patterns. It's used internally by ErrorSanitizer but can also be used directly.

## Basic Usage

```typescript
import { SecretGuard } from '@theunwalked/spotclean';

const guard = new SecretGuard({
  enabled: true,
  redactionText: '[REDACTED]',
});

const safe = guard.redact('api_key=sk_live_1234567890abcdef');
// Result: 'api_key=[REDACTED]'
```

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | boolean | `true` | Master switch |
| `redactionText` | string | `'[REDACTED]'` | Replacement text |
| `preservePartial` | boolean | `false` | Show last N characters |
| `preserveLength` | number | `4` | N for partial preservation |
| `customPatterns` | SecretPattern[] | `[]` | Additional patterns |

## Built-in Patterns

SecretGuard detects these secret types by default:

| Pattern Name | Description | Example |
|-------------|-------------|---------|
| `api-key` | API keys in various formats | `api_key=...`, `apikey:...` |
| `bearer-token` | Bearer authorization tokens | `Bearer ...` |
| `aws-key` | AWS Access Key IDs | `AKIA...` |
| `password` | Password values | `password=...`, `pwd=...` |
| `secret` | Generic secrets and tokens | `secret=...`, `token=...` |
| `private-key` | PEM-format private keys | `-----BEGIN PRIVATE KEY-----` |
| `jwt` | JSON Web Tokens | `eyJ...` |
| `connection-string` | Database connection strings | `postgres://...`, `mongodb://...` |
| `generic-secret-env` | Environment variable style secrets | `DATABASE_PASSWORD=...` |

## Custom Patterns

Add patterns for application-specific secrets:

```typescript
import { SecretGuard } from '@theunwalked/spotclean';

const guard = new SecretGuard({
  enabled: true,
  customPatterns: [
    {
      name: 'custom-id',
      pattern: /CUSTOM-[A-Z0-9]{10}/g,
      description: 'Custom ID format',
    },
    {
      name: 'internal-token',
      pattern: /INTERNAL-[a-f0-9]{32}/gi,
      description: 'Internal service tokens',
    },
  ],
});

const safe = guard.redact('Token: INTERNAL-abc123def456...');
// Result: 'Token: [REDACTED]'
```

### Pattern Definition

```typescript
interface SecretPattern {
  name: string;        // Unique identifier
  pattern: RegExp;     // Regex pattern (use global flag)
  description?: string; // Human-readable description
}
```

## Partial Preservation

For debugging, you can preserve the last few characters:

```typescript
const guard = new SecretGuard({
  preservePartial: true,
  preserveLength: 4,
});

const safe = guard.redact('api_key=sk_live_1234567890abcdef');
// Result: 'api_key=[REDACTED...cdef]'
```

## Global vs Instance

Use the global instance:

```typescript
import { 
  getSecretGuard, 
  configureSecretGuard 
} from '@theunwalked/spotclean';

configureSecretGuard({
  customPatterns: [
    { name: 'internal-key', pattern: /INTERNAL-[A-Z]{20}/g },
  ],
});

const guard = getSecretGuard();
const safe = guard.redact(message);
```

Or create isolated instances for different contexts:

```typescript
import { SecretGuard } from '@theunwalked/spotclean';

// Stricter patterns for public-facing APIs
const publicGuard = new SecretGuard({
  customPatterns: [...strictPatterns],
});

// More permissive for internal services
const internalGuard = new SecretGuard({
  customPatterns: [...basicPatterns],
});
```

## Detection Without Redaction

Check if secrets exist without modifying:

```typescript
const result = guard.detect('api_key=secret123');

if (result.hasSecrets) {
  console.log('Found secrets:', result.matches.map(m => m.name));
}
```

## Security Considerations

1. **Pattern order** - More specific patterns should come before generic ones
2. **Regex safety** - All patterns reset lastIndex before use
3. **Immutability** - `getPatterns()` returns copies, not originals
4. **No eval** - No dynamic code execution or user-supplied regex

