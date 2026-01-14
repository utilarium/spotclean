import { describe, it, expect } from 'vitest';
import {
    // Main exports
    sanitize,
    createSafeError,
    // Classes
    ErrorSanitizer,
    SecretGuard,
    PathSanitizer,
    // Global functions
    getErrorSanitizer,
    getSecretGuard,
    getPathSanitizer,
    configureErrorSanitizer,
    configureSecretGuard,
    configurePathSanitizer,
    // Utilities
    withErrorHandling,
    sanitizeUnknownError,
    getDefaultSecretPatterns,
} from '../src/spotclean';

describe('spotclean exports', () => {
    describe('convenience functions', () => {
        it('sanitize should work', () => {
            const error = new Error('Test error');
            const result = sanitize(error);

            expect(result.external).toBeDefined();
            expect(result.internal).toBeDefined();
            expect(result.external.message).toBeDefined();
            expect(result.internal.correlationId).toBeDefined();
        });

        it('createSafeError should work', () => {
            const error = new Error('Test error');
            const safe = createSafeError(error);

            expect(safe).toBeInstanceOf(Error);
            expect(safe.correlationId).toBeDefined();
        });
    });

    describe('class exports', () => {
        it('should export ErrorSanitizer', () => {
            expect(ErrorSanitizer).toBeDefined();
            const instance = new ErrorSanitizer();
            expect(instance).toBeInstanceOf(ErrorSanitizer);
        });

        it('should export SecretGuard', () => {
            expect(SecretGuard).toBeDefined();
            const instance = new SecretGuard();
            expect(instance).toBeInstanceOf(SecretGuard);
        });

        it('should export PathSanitizer', () => {
            expect(PathSanitizer).toBeDefined();
            const instance = new PathSanitizer();
            expect(instance).toBeInstanceOf(PathSanitizer);
        });
    });

    describe('global function exports', () => {
        it('should export getErrorSanitizer', () => {
            expect(getErrorSanitizer).toBeDefined();
            expect(typeof getErrorSanitizer).toBe('function');
        });

        it('should export getSecretGuard', () => {
            expect(getSecretGuard).toBeDefined();
            expect(typeof getSecretGuard).toBe('function');
        });

        it('should export getPathSanitizer', () => {
            expect(getPathSanitizer).toBeDefined();
            expect(typeof getPathSanitizer).toBe('function');
        });

        it('should export configureErrorSanitizer', () => {
            expect(configureErrorSanitizer).toBeDefined();
            expect(typeof configureErrorSanitizer).toBe('function');
        });

        it('should export configureSecretGuard', () => {
            expect(configureSecretGuard).toBeDefined();
            expect(typeof configureSecretGuard).toBe('function');
        });

        it('should export configurePathSanitizer', () => {
            expect(configurePathSanitizer).toBeDefined();
            expect(typeof configurePathSanitizer).toBe('function');
        });
    });

    describe('utility exports', () => {
        it('should export withErrorHandling', () => {
            expect(withErrorHandling).toBeDefined();
            expect(typeof withErrorHandling).toBe('function');
        });

        it('should export sanitizeUnknownError', () => {
            expect(sanitizeUnknownError).toBeDefined();
            expect(typeof sanitizeUnknownError).toBe('function');
        });

        it('should export getDefaultSecretPatterns', () => {
            expect(getDefaultSecretPatterns).toBeDefined();
            expect(typeof getDefaultSecretPatterns).toBe('function');
        });
    });

    describe('integration', () => {
        it('should sanitize error with secrets and paths', () => {
            configureErrorSanitizer({ environment: 'development' });
            
            const error = new Error(
                'Failed to connect to postgres://admin:secret123@localhost:5432 ' +
                'from /home/johndoe/project/src/db.ts'
            );

            const safe = createSafeError(error);

            // Should redact password
            expect(safe.message).not.toContain('secret123');
            // Connection string should be redacted
            expect(safe.message).toContain('[REDACTED]');
        });

        it('should provide correlation ID for tracking', () => {
            const error = new Error('Database error');
            const { external, internal } = sanitize(error);

            expect(external.correlationId).toBe(internal.correlationId);
            expect(external.correlationId).toMatch(/^err-/);
        });

        it('should handle async functions with withErrorHandling', async () => {
            const successFn = async (x: number) => x * 2;
            const wrapped = withErrorHandling(successFn);

            const result = await wrapped(21);
            expect(result).toBe(42);
        });
    });
});

