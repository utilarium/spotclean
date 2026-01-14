import { describe, it, expect, beforeEach } from 'vitest';
import {
    SecretGuard,
    getSecretGuard,
    configureSecretGuard,
    getDefaultSecretPatterns,
} from '../src/secret-guard';

describe('SecretGuard', () => {
    describe('redact', () => {
        it('should redact API keys', () => {
            const guard = new SecretGuard();
            const input = 'Error connecting with api_key=sk_live_1234567890abcdefghij';

            const result = guard.redact(input);

            expect(result).not.toContain('sk_live_1234567890abcdefghij');
            expect(result).toContain('[REDACTED]');
        });

        it('should redact bearer tokens', () => {
            const guard = new SecretGuard();
            const input = 'Authorization header: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9';

            const result = guard.redact(input);

            expect(result).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
            expect(result).toContain('[REDACTED]');
        });

        it('should redact AWS access key IDs', () => {
            const guard = new SecretGuard();
            const input = 'AWS credentials: AKIAIOSFODNN7EXAMPLE';

            const result = guard.redact(input);

            expect(result).not.toContain('AKIAIOSFODNN7EXAMPLE');
            expect(result).toContain('[REDACTED]');
        });

        it('should redact passwords', () => {
            const guard = new SecretGuard();
            const input = 'Login failed with password=SuperSecret123!';

            const result = guard.redact(input);

            expect(result).not.toContain('SuperSecret123!');
            expect(result).toContain('[REDACTED]');
        });

        it('should redact connection strings', () => {
            const guard = new SecretGuard();
            const input = 'Connection to mongodb://admin:secret@localhost:27017/db failed';

            const result = guard.redact(input);

            expect(result).not.toContain('mongodb://admin:secret@localhost:27017/db');
            expect(result).toContain('[REDACTED]');
        });

        it('should redact JWTs', () => {
            const guard = new SecretGuard();
            const input = 'Token: eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';

            const result = guard.redact(input);

            expect(result).not.toContain('eyJhbGciOiJIUzI1NiJ9');
            expect(result).toContain('[REDACTED]');
        });

        it('should redact private keys', () => {
            const guard = new SecretGuard();
            const input = `Error loading key:
-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC
-----END PRIVATE KEY-----`;

            const result = guard.redact(input);

            expect(result).not.toContain('MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC');
            expect(result).toContain('[REDACTED]');
        });

        it('should redact environment variable style secrets', () => {
            const guard = new SecretGuard();
            const input = 'Config: DATABASE_PASSWORD=mysecretpassword123';

            const result = guard.redact(input);

            expect(result).not.toContain('mysecretpassword123');
            expect(result).toContain('[REDACTED]');
        });

        it('should handle empty input', () => {
            const guard = new SecretGuard();

            expect(guard.redact('')).toBe('');
        });

        it('should handle input without secrets', () => {
            const guard = new SecretGuard();
            const input = 'This is a normal error message without any secrets';

            const result = guard.redact(input);

            expect(result).toBe(input);
        });

        it('should not redact when disabled', () => {
            const guard = new SecretGuard({ enabled: false });
            const input = 'password=secret123';

            const result = guard.redact(input);

            expect(result).toBe(input);
        });

        it('should preserve partial content when configured', () => {
            const guard = new SecretGuard({ 
                preservePartial: true,
                preserveLength: 4 
            });
            const input = 'api_key=abcdefghijklmnopqrstuvwxyz';

            const result = guard.redact(input);

            expect(result).toContain('...wxyz');
        });

        it('should use custom redaction text', () => {
            const guard = new SecretGuard({ redactionText: '***HIDDEN***' });
            const input = 'password=secret123456789';

            const result = guard.redact(input);

            expect(result).toContain('***HIDDEN***');
        });
    });

    describe('containsSecrets', () => {
        it('should return true when secrets are present', () => {
            const guard = new SecretGuard();
            const input = 'api_key=mysecretkey12345678901234567890';

            expect(guard.containsSecrets(input)).toBe(true);
        });

        it('should return false when no secrets are present', () => {
            const guard = new SecretGuard();
            const input = 'This is a normal message';

            expect(guard.containsSecrets(input)).toBe(false);
        });

        it('should return false for empty input', () => {
            const guard = new SecretGuard();

            expect(guard.containsSecrets('')).toBe(false);
        });

        it('should return false when disabled', () => {
            const guard = new SecretGuard({ enabled: false });
            const input = 'password=secret123456789';

            expect(guard.containsSecrets(input)).toBe(false);
        });
    });

    describe('detectSecretTypes', () => {
        it('should return matching pattern names', () => {
            const guard = new SecretGuard();
            const input = 'Error: password=secret123456789 and api_key=abcdefghijklmnopqrstuvwxyz';

            const types = guard.detectSecretTypes(input);

            expect(types).toContain('password');
            expect(types).toContain('api-key');
        });

        it('should return empty array for no secrets', () => {
            const guard = new SecretGuard();
            const input = 'Normal message';

            const types = guard.detectSecretTypes(input);

            expect(types).toEqual([]);
        });

        it('should return empty array for empty input', () => {
            const guard = new SecretGuard();

            expect(guard.detectSecretTypes('')).toEqual([]);
        });
    });

    describe('custom patterns', () => {
        it('should use custom patterns', () => {
            const guard = new SecretGuard({
                customPatterns: [
                    {
                        name: 'custom-id',
                        pattern: /CUSTOM-[A-Z0-9]{10}/g,
                        description: 'Custom ID format',
                    },
                ],
            });
            const input = 'ID: CUSTOM-ABCD123456';

            const result = guard.redact(input);

            expect(result).not.toContain('CUSTOM-ABCD123456');
            expect(result).toContain('[REDACTED]');
        });

        it('should add pattern dynamically', () => {
            const guard = new SecretGuard();
            guard.addPattern({
                name: 'dynamic',
                pattern: /DYNAMIC-\d{5}/g,
            });
            const input = 'Code: DYNAMIC-12345';

            const result = guard.redact(input);

            expect(result).not.toContain('DYNAMIC-12345');
        });

        it('should remove pattern', () => {
            const guard = new SecretGuard();
            const initialCount = guard.getPatterns().length;

            const removed = guard.removePattern('api-key');

            expect(removed).toBe(true);
            expect(guard.getPatterns().length).toBe(initialCount - 1);
        });

        it('should return false when removing non-existent pattern', () => {
            const guard = new SecretGuard();

            const removed = guard.removePattern('non-existent');

            expect(removed).toBe(false);
        });

        it('should return copy of patterns', () => {
            const guard = new SecretGuard();
            const patterns = guard.getPatterns();
            const initialLength = patterns.length;

            patterns.push({ name: 'fake', pattern: /fake/g });

            expect(guard.getPatterns().length).toBe(initialLength);
        });
    });
});

describe('Global SecretGuard', () => {
    beforeEach(() => {
        // Reset global guard
        configureSecretGuard({});
    });

    it('should return same instance from getSecretGuard', () => {
        const guard1 = getSecretGuard();
        const guard2 = getSecretGuard();

        expect(guard1).toBe(guard2);
    });

    it('should create new instance when configured', () => {
        const guard1 = getSecretGuard();
        configureSecretGuard({ redactionText: 'HIDDEN' });
        const guard2 = getSecretGuard();

        expect(guard1).not.toBe(guard2);
    });
});

describe('getDefaultSecretPatterns', () => {
    it('should return array of patterns', () => {
        const patterns = getDefaultSecretPatterns();

        expect(Array.isArray(patterns)).toBe(true);
        expect(patterns.length).toBeGreaterThan(0);
    });

    it('should return a copy (not original)', () => {
        const patterns1 = getDefaultSecretPatterns();
        const patterns2 = getDefaultSecretPatterns();

        patterns1.push({ name: 'test', pattern: /test/g });

        expect(patterns1.length).not.toBe(patterns2.length);
    });

    it('should have required properties on each pattern', () => {
        const patterns = getDefaultSecretPatterns();

        for (const pattern of patterns) {
            expect(pattern.name).toBeDefined();
            expect(pattern.pattern).toBeInstanceOf(RegExp);
        }
    });
});

