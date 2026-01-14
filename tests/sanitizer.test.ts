import { describe, it, expect, beforeEach } from 'vitest';
import {
    ErrorSanitizer,
    getErrorSanitizer,
    configureErrorSanitizer,
    withErrorHandling,
    sanitizeUnknownError,
} from '../src/sanitizer';
import { SecretGuard } from '../src/secret-guard';

describe('ErrorSanitizer', () => {
    describe('sanitize', () => {
        it('should sanitize error messages in production', () => {
            const sanitizer = new ErrorSanitizer({ environment: 'production' });
            const error = new Error('Failed to read /etc/passwd: EACCES');

            const { external } = sanitizer.sanitize(error);

            expect(external.message).not.toContain('/etc/passwd');
            expect(external.message).not.toContain('EACCES');
            expect(external.correlationId).toBeDefined();
        });

        it('should preserve details in development', () => {
            const sanitizer = new ErrorSanitizer({ environment: 'development' });
            const error = new Error('Specific error details');

            const { external } = sanitizer.sanitize(error);

            expect(external.message).toContain('Specific error details');
        });

        it('should generate unique correlation IDs', () => {
            const sanitizer = new ErrorSanitizer();
            const ids = new Set<string>();

            for (let i = 0; i < 100; i++) {
                const { internal } = sanitizer.sanitize(new Error('test'));
                ids.add(internal.correlationId);
            }

            expect(ids.size).toBe(100);
        });

        it('should return generic message for timeout errors in production', () => {
            const sanitizer = new ErrorSanitizer({ environment: 'production' });
            const error = new Error('Request timed out after 5000ms');

            const { external } = sanitizer.sanitize(error);

            expect(external.message).toBe('The operation timed out. Please try again.');
        });

        it('should return generic message for not found errors in production', () => {
            const sanitizer = new ErrorSanitizer({ environment: 'production' });
            const error = new Error('File does not exist: /secret/path/file.txt');

            const { external } = sanitizer.sanitize(error);

            expect(external.message).toBe('The requested resource was not found.');
        });

        it('should return generic message for permission errors in production', () => {
            const sanitizer = new ErrorSanitizer({ environment: 'production' });
            const error = new Error('Access denied to /admin/secrets');

            const { external } = sanitizer.sanitize(error);

            expect(external.message).toBe('You do not have permission to perform this action.');
        });

        it('should return generic message for validation errors in production', () => {
            const sanitizer = new ErrorSanitizer({ environment: 'production' });
            const error = new Error('Invalid user input: SQL injection detected');

            const { external } = sanitizer.sanitize(error);

            expect(external.message).toBe('The provided data is invalid.');
        });

        it('should return generic message for network errors in production', () => {
            const sanitizer = new ErrorSanitizer({ environment: 'production' });
            const error = new Error('ECONNREFUSED: Connection refused to internal.server.local:5432');

            const { external } = sanitizer.sanitize(error);

            expect(external.message).toBe('A network error occurred. Please check your connection.');
        });

        it('should use error name for generic messages', () => {
            const sanitizer = new ErrorSanitizer({ environment: 'production' });
            const error = new Error('Custom auth failure');
            error.name = 'AuthenticationError';

            const { external } = sanitizer.sanitize(error);

            expect(external.message).toBe('Authentication failed.');
        });

        it('should truncate long messages', () => {
            const sanitizer = new ErrorSanitizer({ 
                environment: 'development',
                maxMessageLength: 50 
            });
            const error = new Error('A'.repeat(100));

            const { external } = sanitizer.sanitize(error);

            expect(external.message.length).toBeLessThanOrEqual(53); // 50 + '...'
            expect(external.message.endsWith('...')).toBe(true);
        });

        it('should include context in internal details', () => {
            const sanitizer = new ErrorSanitizer();
            const error = new Error('test error');
            const context = { userId: '123', action: 'login' };

            const { internal } = sanitizer.sanitize(error, context);

            expect(internal.context).toEqual(context);
        });

        it('should include timestamp in internal details', () => {
            const sanitizer = new ErrorSanitizer();
            const before = new Date();
            const error = new Error('test error');

            const { internal } = sanitizer.sanitize(error);
            const after = new Date();

            expect(internal.timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
            expect(internal.timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
        });

        it('should not include correlation ID when disabled', () => {
            const sanitizer = new ErrorSanitizer({ includeCorrelationId: false });
            const error = new Error('test error');

            const { external } = sanitizer.sanitize(error);

            expect(external.correlationId).toBeUndefined();
        });

        it('should use SecretGuard to redact secrets in development', () => {
            const secretGuard = new SecretGuard();
            const sanitizer = new ErrorSanitizer({ environment: 'development' }, secretGuard);
            const error = new Error('API error: api_key=sk_live_abcdefghijklmnopqrstuvwxyz');

            const { external } = sanitizer.sanitize(error);

            expect(external.message).not.toContain('sk_live_abcdefghijklmnopqrstuvwxyz');
            expect(external.message).toContain('[REDACTED]');
        });
    });

    describe('createSafeError', () => {
        it('should create a new Error with sanitized message', () => {
            const sanitizer = new ErrorSanitizer({ environment: 'production' });
            const original = new Error('Database connection failed to postgres://user:password@localhost:5432');

            const safe = sanitizer.createSafeError(original);

            expect(safe.message).not.toContain('postgres://');
            expect(safe.message).not.toContain('password');
        });

        it('should attach correlation ID to safe error', () => {
            const sanitizer = new ErrorSanitizer();
            const original = new Error('test');

            const safe = sanitizer.createSafeError(original);

            expect(safe.correlationId).toBeDefined();
            expect(safe.correlationId).toMatch(/^err-/);
        });

        it('should remove stack trace in production', () => {
            const sanitizer = new ErrorSanitizer({ 
                environment: 'production',
                sanitizeStackTraces: true 
            });
            const original = new Error('test');

            const safe = sanitizer.createSafeError(original);

            expect(safe.stack).toBeUndefined();
        });

        it('should preserve stack trace in development', () => {
            const sanitizer = new ErrorSanitizer({ 
                environment: 'development',
                sanitizeStackTraces: true 
            });
            const original = new Error('test');

            const safe = sanitizer.createSafeError(original);

            expect(safe.stack).toBeDefined();
        });

        it('should preserve error name/type', () => {
            const sanitizer = new ErrorSanitizer({ environment: 'production' });
            const original = new TypeError('invalid type');

            const safe = sanitizer.createSafeError(original);

            expect(safe.name).toBe('TypeError');
        });
    });

    describe('sanitizeMessage', () => {
        it('should sanitize a plain string', () => {
            const sanitizer = new ErrorSanitizer();
            const message = 'Connection to postgres://admin:secret123@db.internal:5432 failed';

            const result = sanitizer.sanitizeMessage(message);

            expect(result).not.toContain('secret123');
            expect(result).toContain('[REDACTED]');
        });

        it('should return original when disabled', () => {
            const sanitizer = new ErrorSanitizer({ enabled: false });
            const message = 'password=secret';

            const result = sanitizer.sanitizeMessage(message);

            expect(result).toBe(message);
        });
    });

    describe('getConfig and configure', () => {
        it('should return current configuration', () => {
            const sanitizer = new ErrorSanitizer({
                environment: 'production',
                maxMessageLength: 100,
            });

            const config = sanitizer.getConfig();

            expect(config.environment).toBe('production');
            expect(config.maxMessageLength).toBe(100);
        });

        it('should update configuration', () => {
            const sanitizer = new ErrorSanitizer({ environment: 'development' });
            
            sanitizer.configure({ environment: 'production' });

            expect(sanitizer.getConfig().environment).toBe('production');
        });
    });
});

describe('Global ErrorSanitizer', () => {
    beforeEach(() => {
        // Reset global sanitizer
        configureErrorSanitizer({});
    });

    it('should return same instance from getErrorSanitizer', () => {
        const sanitizer1 = getErrorSanitizer();
        const sanitizer2 = getErrorSanitizer();

        expect(sanitizer1).toBe(sanitizer2);
    });

    it('should create new instance when configured', () => {
        const sanitizer1 = getErrorSanitizer();
        configureErrorSanitizer({ environment: 'production' });
        const sanitizer2 = getErrorSanitizer();

        expect(sanitizer1).not.toBe(sanitizer2);
    });
});

describe('withErrorHandling', () => {
    it('should pass through successful results', async () => {
        const fn = async (x: number) => x * 2;
        const wrapped = withErrorHandling(fn);

        const result = await wrapped(5);

        expect(result).toBe(10);
    });

    it('should sanitize and rethrow errors', async () => {
        const fn = async () => {
            throw new Error('Database error at postgres://localhost');
        };
        const wrapped = withErrorHandling(fn);

        await expect(wrapped()).rejects.toThrow();
    });

    it('should log errors when logger provided', async () => {
        const logs: any[] = [];
        const logger = {
            error: (msg: string, ctx?: Record<string, unknown>) => logs.push({ msg, ctx }),
            warn: () => {},
            info: () => {},
            debug: () => {},
        };
        const fn = async () => {
            throw new Error('test error');
        };
        const wrapped = withErrorHandling(fn, { logger });

        try {
            await wrapped();
        } catch {
            // Expected
        }

        expect(logs.length).toBe(1);
        expect(logs[0].msg).toBe('Error occurred');
        expect(logs[0].ctx.correlationId).toBeDefined();
    });

    it('should not rethrow when rethrow is false', async () => {
        const fn = async () => {
            throw new Error('test error');
        };
        const wrapped = withErrorHandling(fn, { rethrow: false });

        const result = await wrapped();

        expect(result).toBeUndefined();
    });

    it('should include context in logged errors', async () => {
        const logs: any[] = [];
        const logger = {
            error: (msg: string, ctx?: Record<string, unknown>) => logs.push({ msg, ctx }),
            warn: () => {},
            info: () => {},
            debug: () => {},
        };
        const fn = async () => {
            throw new Error('test');
        };
        const wrapped = withErrorHandling(fn, { 
            logger, 
            context: { userId: '123' } 
        });

        try {
            await wrapped();
        } catch {
            // Expected
        }

        expect(logs[0].ctx.userId).toBe('123');
    });
});

describe('sanitizeUnknownError', () => {
    it('should handle Error instances', () => {
        const error = new Error('test message');
        
        const safe = sanitizeUnknownError(error);

        expect(safe).toBeInstanceOf(Error);
        expect(safe.correlationId).toBeDefined();
    });

    it('should handle string errors', () => {
        const error = 'string error message';
        
        const safe = sanitizeUnknownError(error);

        expect(safe).toBeInstanceOf(Error);
        expect(safe.name).toBe('UnknownError');
    });

    it('should handle non-string non-Error values', () => {
        const error = { code: 500 };
        
        const safe = sanitizeUnknownError(error);

        expect(safe).toBeInstanceOf(Error);
        expect(safe.name).toBe('UnknownError');
    });

    it('should include context', () => {
        const error = new Error('test');
        const context = { requestId: 'abc' };
        
        const safe = sanitizeUnknownError(error, context);

        expect(safe.correlationId).toBeDefined();
    });
});

