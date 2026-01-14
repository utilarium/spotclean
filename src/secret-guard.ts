import { SecretGuardConfig, SecretPattern } from './types';

/**
 * Default patterns for detecting common secrets
 */
const DEFAULT_SECRET_PATTERNS: SecretPattern[] = [
    {
        name: 'api-key',
        pattern: /\b(api[_-]?key|apikey)[=:]\s*['"]?([a-zA-Z0-9_-]{20,})['"]?/gi,
        description: 'API keys in various formats',
    },
    {
        name: 'bearer-token',
        pattern: /\b(bearer)\s+([a-zA-Z0-9_\-.]{20,})/gi,
        description: 'Bearer tokens in authorization headers',
    },
    {
        name: 'aws-key',
        pattern: /\b(AKIA[0-9A-Z]{16})\b/g,
        description: 'AWS Access Key IDs',
    },
    {
        name: 'aws-secret',
        pattern: /\b([a-zA-Z0-9+/]{40})\b/g,
        description: 'Potential AWS Secret Access Keys',
    },
    {
        name: 'password',
        pattern: /\b(password|passwd|pwd)[=:]\s*['"]?([^\s'"]{4,})['"]?/gi,
        description: 'Password values',
    },
    {
        name: 'secret',
        pattern: /\b(secret|token|credential)[=:]\s*['"]?([^\s'"]{8,})['"]?/gi,
        description: 'Generic secrets and tokens',
    },
    {
        name: 'private-key',
        pattern: /-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----[\s\S]*?-----END\s+(RSA\s+)?PRIVATE\s+KEY-----/g,
        description: 'Private keys in PEM format',
    },
    {
        name: 'jwt',
        pattern: /\beyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/g,
        description: 'JSON Web Tokens',
    },
    {
        name: 'connection-string',
        pattern: /\b(mongodb|postgres|mysql|redis):\/\/[^\s]+/gi,
        description: 'Database connection strings',
    },
    {
        name: 'generic-secret-env',
        pattern: /\b([A-Z_]+(?:KEY|SECRET|TOKEN|PASSWORD|CREDENTIAL))[=:]\s*['"]?([^\s'"]{8,})['"]?/g,
        description: 'Environment variable style secrets',
    },
];

/**
 * Default configuration for SecretGuard
 */
const DEFAULT_CONFIG: SecretGuardConfig = {
    enabled: true,
    customPatterns: [],
    redactionText: '[REDACTED]',
    preservePartial: false,
    preserveLength: 4,
};

/**
 * SecretGuard detects and redacts sensitive information from strings
 */
export class SecretGuard {
    private config: SecretGuardConfig;
    private patterns: SecretPattern[];

    constructor(config: Partial<SecretGuardConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.patterns = [...DEFAULT_SECRET_PATTERNS, ...this.config.customPatterns];
    }

    /**
     * Redact secrets from a string
     * @param input - The string to redact secrets from
     * @param context - Optional context identifier for logging
     * @returns The string with secrets redacted
     */
    redact(input: string, _context?: string): string {
        if (!this.config.enabled || !input) {
            return input;
        }

        let result = input;

        for (const { pattern } of this.patterns) {
            // Reset regex lastIndex for global patterns
            pattern.lastIndex = 0;
            result = result.replace(pattern, (match) => this.createRedaction(match));
        }

        return result;
    }

    /**
     * Check if a string contains any secrets
     * @param input - The string to check
     * @returns True if secrets were detected
     */
    containsSecrets(input: string): boolean {
        if (!this.config.enabled || !input) {
            return false;
        }

        for (const { pattern } of this.patterns) {
            pattern.lastIndex = 0;
            if (pattern.test(input)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Get list of detected secret types in a string
     * @param input - The string to analyze
     * @returns Array of pattern names that matched
     */
    detectSecretTypes(input: string): string[] {
        if (!this.config.enabled || !input) {
            return [];
        }

        const detectedTypes: string[] = [];

        for (const { name, pattern } of this.patterns) {
            pattern.lastIndex = 0;
            if (pattern.test(input)) {
                detectedTypes.push(name);
            }
        }

        return detectedTypes;
    }

    /**
     * Add a custom pattern to detect
     * @param pattern - The pattern to add
     */
    addPattern(pattern: SecretPattern): void {
        this.patterns.push(pattern);
    }

    /**
     * Remove a pattern by name
     * @param name - The name of the pattern to remove
     * @returns True if a pattern was removed
     */
    removePattern(name: string): boolean {
        const initialLength = this.patterns.length;
        this.patterns = this.patterns.filter((p) => p.name !== name);
        return this.patterns.length < initialLength;
    }

    /**
     * Get current patterns
     * @returns Copy of current patterns array
     */
    getPatterns(): SecretPattern[] {
        return [...this.patterns];
    }

    /**
     * Create redaction text, optionally preserving partial content
     */
    private createRedaction(match: string): string {
        if (this.config.preservePartial && match.length > this.config.preserveLength) {
            const suffix = match.slice(-this.config.preserveLength);
            return `${this.config.redactionText}...${suffix}`;
        }
        return this.config.redactionText;
    }
}

// Global instance
let globalSecretGuard: SecretGuard | null = null;

/**
 * Get the global SecretGuard instance
 */
export function getSecretGuard(): SecretGuard {
    if (!globalSecretGuard) {
        globalSecretGuard = new SecretGuard();
    }
    return globalSecretGuard;
}

/**
 * Configure the global SecretGuard instance
 */
export function configureSecretGuard(config: Partial<SecretGuardConfig>): void {
    globalSecretGuard = new SecretGuard(config);
}

/**
 * Get default secret patterns (for extending)
 */
export function getDefaultSecretPatterns(): SecretPattern[] {
    return [...DEFAULT_SECRET_PATTERNS];
}

