/**
 * Configuration for the ErrorSanitizer
 */
export interface ErrorSanitizerConfig {
    /** Whether sanitization is enabled */
    enabled: boolean;
    /** Current environment */
    environment: 'production' | 'development' | 'test';
    /** Whether to include correlation IDs in external errors */
    includeCorrelationId: boolean;
    /** Maximum length for external error messages */
    maxMessageLength: number;
    /** Whether to remove stack traces in production */
    sanitizeStackTraces: boolean;
}

/**
 * Configuration for the SecretGuard
 */
export interface SecretGuardConfig {
    /** Whether secret detection is enabled */
    enabled: boolean;
    /** Custom patterns to detect as secrets */
    customPatterns: SecretPattern[];
    /** Replacement text for redacted secrets */
    redactionText: string;
    /** Whether to preserve partial content (e.g., last 4 chars) */
    preservePartial: boolean;
    /** Number of characters to preserve when preservePartial is true */
    preserveLength: number;
}

/**
 * Pattern definition for secret detection
 */
export interface SecretPattern {
    /** Unique name for this pattern */
    name: string;
    /** Regular expression to match the secret */
    pattern: RegExp;
    /** Optional description of what this pattern detects */
    description?: string;
}

/**
 * Internal error details (for logging)
 */
export interface InternalErrorDetails {
    /** Unique correlation ID for tracking */
    correlationId: string;
    /** Original error message (may contain sensitive info) */
    originalMessage: string;
    /** Original stack trace */
    originalStack?: string;
    /** Additional context for debugging */
    context?: Record<string, unknown>;
    /** When the error occurred */
    timestamp: Date;
}

/**
 * External error (safe for users)
 */
export interface ExternalError {
    /** Sanitized error message */
    message: string;
    /** Correlation ID for support requests (optional) */
    correlationId?: string;
    /** Error type/name */
    type: string;
}

/**
 * Result of sanitizing an error
 */
export interface SanitizedErrorResult {
    /** Safe error for external exposure */
    external: ExternalError;
    /** Full error details for internal logging */
    internal: InternalErrorDetails;
}

/**
 * Logger interface for error handling wrapper
 */
export interface Logger {
    error(message: string, context?: Record<string, unknown>): void;
    warn(message: string, context?: Record<string, unknown>): void;
    info(message: string, context?: Record<string, unknown>): void;
    debug(message: string, context?: Record<string, unknown>): void;
}

/**
 * Options for the withErrorHandling wrapper
 */
export interface ErrorHandlingOptions {
    /** Logger to use for internal error logging */
    logger?: Logger;
    /** Additional context to include with errors */
    context?: Record<string, unknown>;
    /** Whether to rethrow the sanitized error (default: true) */
    rethrow?: boolean;
}

