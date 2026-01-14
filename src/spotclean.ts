/**
 * Spotclean - Error message sanitization library
 * 
 * Spotclean helps prevent information disclosure by sanitizing error messages
 * before they are exposed to users. It provides:
 * 
 * - Secret detection and redaction
 * - Path sanitization
 * - Generic error message mapping
 * - Correlation IDs for debugging
 * - Environment-aware behavior (dev vs production)
 */

// Export all types
export type {
    ErrorSanitizerConfig,
    SecretGuardConfig,
    SecretPattern,
    InternalErrorDetails,
    ExternalError,
    SanitizedErrorResult,
    Logger,
    ErrorHandlingOptions,
} from './types';

// Export sanitizer classes and functions
export {
    ErrorSanitizer,
    getErrorSanitizer,
    configureErrorSanitizer,
    withErrorHandling,
    sanitizeUnknownError,
} from './sanitizer';

// Export secret guard classes and functions
export {
    SecretGuard,
    getSecretGuard,
    configureSecretGuard,
    getDefaultSecretPatterns,
} from './secret-guard';

// Export path sanitizer classes and functions
export {
    PathSanitizer,
    getPathSanitizer,
    configurePathSanitizer,
} from './path-sanitizer';
export type { PathSanitizerConfig } from './path-sanitizer';

// Re-export a convenience function for quick sanitization
import { getErrorSanitizer } from './sanitizer';

/**
 * Quick sanitization of an error
 * @param error - The error to sanitize
 * @param context - Optional context for debugging
 * @returns Sanitized error safe for external exposure
 */
export function sanitize(error: Error, context?: Record<string, unknown>) {
    return getErrorSanitizer().sanitize(error, context);
}

/**
 * Quick creation of a safe error
 * @param error - The error to make safe
 * @param context - Optional context for debugging
 * @returns New Error with sanitized message
 */
export function createSafeError(error: Error, context?: Record<string, unknown>) {
    return getErrorSanitizer().createSafeError(error, context);
}

