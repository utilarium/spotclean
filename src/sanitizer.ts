import {
    ErrorSanitizerConfig,
    InternalErrorDetails,
    ExternalError,
    SanitizedErrorResult,
    ErrorHandlingOptions,
} from './types';
import { SecretGuard, getSecretGuard } from './secret-guard';

/**
 * Default configuration for ErrorSanitizer
 */
const DEFAULT_CONFIG: ErrorSanitizerConfig = {
    enabled: true,
    environment: (process.env.NODE_ENV as 'production' | 'development' | 'test') || 'development',
    includeCorrelationId: true,
    maxMessageLength: 500,
    sanitizeStackTraces: true,
};

/**
 * Generic error messages mapped by error type/name
 */
const GENERIC_MESSAGES: Record<string, string> = {
    TimeoutError: 'The operation timed out. Please try again.',
    ValidationError: 'The provided data is invalid.',
    AuthenticationError: 'Authentication failed.',
    AuthorizationError: 'You do not have permission to perform this action.',
    NotFoundError: 'The requested resource was not found.',
    RateLimitError: 'Too many requests. Please slow down.',
    NetworkError: 'A network error occurred. Please check your connection.',
    DatabaseError: 'A database error occurred. Please try again.',
    ConfigurationError: 'A configuration error occurred.',
};

/**
 * Keywords in error messages that map to generic responses
 */
const MESSAGE_KEYWORDS: Array<{ keywords: string[]; message: string }> = [
    {
        keywords: ['timeout', 'timed out', 'deadline exceeded'],
        message: 'The operation timed out. Please try again.',
    },
    {
        keywords: ['not found', 'does not exist', 'no such file', 'enoent'],
        message: 'The requested resource was not found.',
    },
    {
        keywords: ['permission', 'access denied', 'forbidden', 'eacces', 'eperm'],
        message: 'You do not have permission to perform this action.',
    },
    {
        keywords: ['invalid', 'validation', 'malformed'],
        message: 'The provided data is invalid.',
    },
    {
        keywords: ['network', 'connection', 'socket', 'econnrefused', 'econnreset'],
        message: 'A network error occurred. Please check your connection.',
    },
    {
        keywords: ['authentication', 'unauthorized', 'unauthenticated', 'login'],
        message: 'Authentication failed.',
    },
    {
        keywords: ['rate limit', 'too many requests', 'throttle'],
        message: 'Too many requests. Please slow down.',
    },
    {
        keywords: ['database', 'query', 'sql', 'db error'],
        message: 'A database error occurred. Please try again.',
    },
];

/**
 * ErrorSanitizer sanitizes error messages for safe external exposure
 */
export class ErrorSanitizer {
    private config: ErrorSanitizerConfig;
    private secretGuard: SecretGuard;
    private correlationCounter: number = 0;

    constructor(config: Partial<ErrorSanitizerConfig> = {}, secretGuard?: SecretGuard) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.secretGuard = secretGuard || getSecretGuard();
    }

    /**
     * Sanitize an error for external exposure
     * @param error - The error to sanitize
     * @param context - Optional context for debugging
     * @returns Object containing both external (safe) and internal (full) error details
     */
    sanitize(error: Error, context?: Record<string, unknown>): SanitizedErrorResult {
        const correlationId = this.generateCorrelationId();

        // Internal details (for logging)
        const internal: InternalErrorDetails = {
            correlationId,
            originalMessage: error.message,
            originalStack: error.stack,
            context,
            timestamp: new Date(),
        };

        // External message
        let externalMessage: string;

        if (!this.config.enabled || this.config.environment === 'development') {
            // In development, show more details but still redact secrets
            externalMessage = this.secretGuard.redact(error.message, 'error');
        } else {
            // In production, show generic messages
            externalMessage = this.getGenericMessage(error);
        }

        // Truncate if needed
        if (externalMessage.length > this.config.maxMessageLength) {
            externalMessage = externalMessage.substring(0, this.config.maxMessageLength) + '...';
        }

        const external: ExternalError = {
            message: externalMessage,
            type: error.name,
        };

        if (this.config.includeCorrelationId) {
            external.correlationId = correlationId;
        }

        return { external, internal };
    }

    /**
     * Create a sanitized Error object
     * @param error - The original error
     * @param context - Optional context for debugging
     * @returns A new Error with sanitized message
     */
    createSafeError(error: Error, context?: Record<string, unknown>): Error & { correlationId?: string } {
        const { external, internal } = this.sanitize(error, context);

        const safeError = new Error(external.message) as Error & { correlationId?: string };
        safeError.name = external.type;

        // Attach correlation ID for debugging
        safeError.correlationId = internal.correlationId;

        // Remove stack trace in production
        if (this.config.sanitizeStackTraces && this.config.environment === 'production') {
            safeError.stack = undefined;
        }

        return safeError;
    }

    /**
     * Sanitize a string that might contain sensitive information
     * @param message - The message to sanitize
     * @returns Sanitized message
     */
    sanitizeMessage(message: string): string {
        if (!this.config.enabled) {
            return message;
        }

        let result = this.secretGuard.redact(message, 'message');

        // Truncate if needed
        if (result.length > this.config.maxMessageLength) {
            result = result.substring(0, this.config.maxMessageLength) + '...';
        }

        return result;
    }

    /**
     * Get generic error message based on error type
     */
    private getGenericMessage(error: Error): string {
        // Check if we have a generic message for this error type
        if (error.name in GENERIC_MESSAGES) {
            return GENERIC_MESSAGES[error.name];
        }

        // Check message content for specific error types
        const message = error.message.toLowerCase();

        for (const { keywords, message: genericMessage } of MESSAGE_KEYWORDS) {
            if (keywords.some((keyword) => message.includes(keyword))) {
                return genericMessage;
            }
        }

        // Default generic message
        return 'An unexpected error occurred. Please try again.';
    }

    /**
     * Generate a unique correlation ID
     */
    private generateCorrelationId(): string {
        const timestamp = Date.now().toString(36);
        const counter = (++this.correlationCounter).toString(36).padStart(4, '0');
        const random = Math.random().toString(36).substring(2, 6);
        return `err-${timestamp}-${counter}-${random}`;
    }

    /**
     * Get the current configuration
     */
    getConfig(): ErrorSanitizerConfig {
        return { ...this.config };
    }

    /**
     * Update configuration
     */
    configure(config: Partial<ErrorSanitizerConfig>): void {
        this.config = { ...this.config, ...config };
    }
}

// Global instance
let globalErrorSanitizer: ErrorSanitizer | null = null;

/**
 * Get the global ErrorSanitizer instance
 */
export function getErrorSanitizer(): ErrorSanitizer {
    if (!globalErrorSanitizer) {
        globalErrorSanitizer = new ErrorSanitizer();
    }
    return globalErrorSanitizer;
}

/**
 * Configure the global ErrorSanitizer instance
 */
export function configureErrorSanitizer(config: Partial<ErrorSanitizerConfig>): void {
    globalErrorSanitizer = new ErrorSanitizer(config);
}

/**
 * Wrap an async function with error sanitization
 * @param fn - The async function to wrap
 * @param options - Options for error handling
 * @returns Wrapped function that sanitizes errors
 */
export function withErrorHandling<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    options: ErrorHandlingOptions = {}
): T {
    const sanitizer = getErrorSanitizer();
    const { logger, context, rethrow = true } = options;

    return (async (...args: Parameters<T>): Promise<ReturnType<T>> => {
        try {
            return await fn(...args);
        } catch (error) {
            const { internal } = sanitizer.sanitize(error as Error, context);

            // Log internal details
            logger?.error('Error occurred', {
                correlationId: internal.correlationId,
                message: internal.originalMessage,
                stack: internal.originalStack,
                ...context,
            });

            if (rethrow) {
                // Throw sanitized error
                throw sanitizer.createSafeError(error as Error, context);
            }

            // Return undefined if not rethrowing (caller should handle this)
            return undefined as ReturnType<T>;
        }
    }) as T;
}

/**
 * Create a sanitized error from any value (useful for catch blocks)
 */
export function sanitizeUnknownError(
    error: unknown,
    context?: Record<string, unknown>
): Error & { correlationId?: string } {
    const sanitizer = getErrorSanitizer();

    if (error instanceof Error) {
        return sanitizer.createSafeError(error, context);
    }

    // Convert non-Error values to Error
    const errorMessage = typeof error === 'string' ? error : 'An unknown error occurred';
    const wrappedError = new Error(errorMessage);
    wrappedError.name = 'UnknownError';

    return sanitizer.createSafeError(wrappedError, context);
}

