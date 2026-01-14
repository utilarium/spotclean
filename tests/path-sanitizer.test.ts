import { describe, it, expect, beforeEach } from 'vitest';
import {
    PathSanitizer,
    getPathSanitizer,
    configurePathSanitizer,
} from '../src/path-sanitizer';

describe('PathSanitizer', () => {
    describe('redact', () => {
        it('should redact Unix home directories', () => {
            const sanitizer = new PathSanitizer({ basePaths: [] });
            const input = 'File not found: /home/username/secret/file.txt';

            const result = sanitizer.redact(input);

            expect(result).not.toContain('/home/username');
            expect(result).toContain('/home/[USER]');
        });

        it('should redact macOS home directories', () => {
            const sanitizer = new PathSanitizer({ basePaths: [] });
            const input = 'Error reading /Users/johndoe/Documents/private.key';

            const result = sanitizer.redact(input);

            expect(result).not.toContain('/Users/johndoe');
            expect(result).toContain('/Users/[USER]');
        });

        it('should redact Windows user directories', () => {
            const sanitizer = new PathSanitizer({ basePaths: [] });
            const input = 'Cannot access C:\\Users\\Administrator\\secret.txt';

            const result = sanitizer.redact(input);

            expect(result).not.toContain('C:\\Users\\Administrator');
            expect(result).toContain('C:\\Users\\[USER]');
        });

        it('should redact temp directories', () => {
            const sanitizer = new PathSanitizer({ basePaths: [] });
            const input = 'Temp file created at /tmp/abc123xyz';

            const result = sanitizer.redact(input);

            expect(result).not.toContain('/tmp/abc123xyz');
            expect(result).toContain('/tmp/[TEMP]');
        });

        it('should redact node_modules paths', () => {
            const sanitizer = new PathSanitizer({ basePaths: [] });
            const input = 'Error in /node_modules/@secret/package/lib/index.js';

            const result = sanitizer.redact(input);

            expect(result).not.toContain('@secret/package');
            expect(result).toContain('/node_modules/[MODULE]');
        });

        it('should redact configured base paths', () => {
            const sanitizer = new PathSanitizer({
                basePaths: ['/app/project'],
                basePathReplacement: '[PROJECT]',
            });
            const input = 'Error at /app/project/src/secret.ts:42';

            const result = sanitizer.redact(input);

            expect(result).not.toContain('/app/project');
            expect(result).toContain('[PROJECT]');
        });

        it('should handle multiple paths in same string', () => {
            const sanitizer = new PathSanitizer({ basePaths: [] });
            const input = 'Copying from /home/user1/file to /home/user2/file';

            const result = sanitizer.redact(input);

            expect(result).not.toContain('/home/user1');
            expect(result).not.toContain('/home/user2');
            expect(result.match(/\[USER\]/g)?.length).toBe(2);
        });

        it('should handle empty input', () => {
            const sanitizer = new PathSanitizer();

            expect(sanitizer.redact('')).toBe('');
        });

        it('should not redact when disabled', () => {
            const sanitizer = new PathSanitizer({ enabled: false });
            const input = '/home/secret/file.txt';

            const result = sanitizer.redact(input);

            expect(result).toBe(input);
        });

        it('should apply custom patterns', () => {
            const sanitizer = new PathSanitizer({
                basePaths: [],
                customPatterns: [
                    { pattern: /\/custom\/[a-z]+/g, replacement: '/custom/[HIDDEN]' },
                ],
            });
            const input = 'Path: /custom/secret';

            const result = sanitizer.redact(input);

            expect(result).toContain('/custom/[HIDDEN]');
        });

        it('should redact process ID paths', () => {
            const sanitizer = new PathSanitizer({ basePaths: [] });
            const input = 'Reading /proc/12345/status';

            const result = sanitizer.redact(input);

            expect(result).not.toContain('/proc/12345');
            expect(result).toContain('/proc/[PID]');
        });
    });

    describe('containsPaths', () => {
        it('should detect Unix-style paths', () => {
            const sanitizer = new PathSanitizer();

            expect(sanitizer.containsPaths('/usr/local/bin/app')).toBe(true);
        });

        it('should detect Windows-style paths', () => {
            const sanitizer = new PathSanitizer();

            expect(sanitizer.containsPaths('C:\\Program Files\\App')).toBe(true);
        });

        it('should return false for no paths', () => {
            const sanitizer = new PathSanitizer();

            expect(sanitizer.containsPaths('No paths here')).toBe(false);
        });

        it('should return false for empty input', () => {
            const sanitizer = new PathSanitizer();

            expect(sanitizer.containsPaths('')).toBe(false);
        });
    });

    describe('base path management', () => {
        it('should add base path', () => {
            const sanitizer = new PathSanitizer({ basePaths: [] });
            
            sanitizer.addBasePath('/new/path');

            expect(sanitizer.getConfig().basePaths).toContain('/new/path');
        });

        it('should not add duplicate base path', () => {
            const sanitizer = new PathSanitizer({ basePaths: ['/existing'] });
            
            sanitizer.addBasePath('/existing');

            expect(sanitizer.getConfig().basePaths.filter((p) => p === '/existing').length).toBe(1);
        });

        it('should not add empty base path', () => {
            const sanitizer = new PathSanitizer({ basePaths: [] });
            const initialCount = sanitizer.getConfig().basePaths.length;
            
            sanitizer.addBasePath('');

            expect(sanitizer.getConfig().basePaths.length).toBe(initialCount);
        });

        it('should remove base path', () => {
            const sanitizer = new PathSanitizer({ basePaths: ['/to/remove'] });
            
            const removed = sanitizer.removeBasePath('/to/remove');

            expect(removed).toBe(true);
            expect(sanitizer.getConfig().basePaths).not.toContain('/to/remove');
        });

        it('should return false when removing non-existent path', () => {
            const sanitizer = new PathSanitizer({ basePaths: [] });
            
            const removed = sanitizer.removeBasePath('/non/existent');

            expect(removed).toBe(false);
        });
    });

    describe('getConfig', () => {
        it('should return current configuration', () => {
            const sanitizer = new PathSanitizer({
                enabled: true,
                basePaths: ['/test'],
                basePathReplacement: '[TEST]',
            });

            const config = sanitizer.getConfig();

            expect(config.enabled).toBe(true);
            expect(config.basePaths).toContain('/test');
            expect(config.basePathReplacement).toBe('[TEST]');
        });

        it('should return a copy of basePaths', () => {
            const sanitizer = new PathSanitizer({ basePaths: ['/original'] });
            
            const config = sanitizer.getConfig();
            config.basePaths.push('/modified');

            expect(sanitizer.getConfig().basePaths).not.toContain('/modified');
        });
    });

    describe('auto-detection', () => {
        it('should auto-detect home directory when no base paths provided', () => {
            const originalHome = process.env.HOME;
            process.env.HOME = '/test/home/user';

            const sanitizer = new PathSanitizer({ basePaths: [] });
            
            // Constructor calls detectBasePaths which adds HOME
            const config = sanitizer.getConfig();
            
            process.env.HOME = originalHome;

            expect(config.basePaths.some((p) => p.includes('home') || p.includes('Users'))).toBe(true);
        });
    });
});

describe('Global PathSanitizer', () => {
    beforeEach(() => {
        // Reset global sanitizer
        configurePathSanitizer({});
    });

    it('should return same instance from getPathSanitizer', () => {
        const sanitizer1 = getPathSanitizer();
        const sanitizer2 = getPathSanitizer();

        expect(sanitizer1).toBe(sanitizer2);
    });

    it('should create new instance when configured', () => {
        const sanitizer1 = getPathSanitizer();
        configurePathSanitizer({ basePathReplacement: '[NEW]' });
        const sanitizer2 = getPathSanitizer();

        expect(sanitizer1).not.toBe(sanitizer2);
    });
});

