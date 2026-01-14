/**
 * Configuration for path sanitization
 */
export interface PathSanitizerConfig {
    /** Whether path sanitization is enabled */
    enabled: boolean;
    /** Base paths to redact (e.g., home directory, project root) */
    basePaths: string[];
    /** Replacement text for base paths */
    basePathReplacement: string;
    /** Whether to detect and redact common system paths */
    redactSystemPaths: boolean;
    /** Custom path patterns to redact */
    customPatterns: Array<{ pattern: RegExp; replacement: string }>;
}

/**
 * Default configuration for PathSanitizer
 */
const DEFAULT_CONFIG: PathSanitizerConfig = {
    enabled: true,
    basePaths: [],
    basePathReplacement: '[PATH]',
    redactSystemPaths: true,
    customPatterns: [],
};

/**
 * Common system path patterns to redact
 */
const SYSTEM_PATH_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
    // Unix home directories
    { pattern: /\/home\/[a-zA-Z0-9_-]+/g, replacement: '/home/[USER]' },
    { pattern: /\/Users\/[a-zA-Z0-9_-]+/g, replacement: '/Users/[USER]' },
    // Windows paths
    { pattern: /C:\\Users\\[a-zA-Z0-9_-]+/gi, replacement: 'C:\\Users\\[USER]' },
    // Temp directories
    { pattern: /\/tmp\/[a-zA-Z0-9_.-]+/g, replacement: '/tmp/[TEMP]' },
    { pattern: /\/var\/tmp\/[a-zA-Z0-9_.-]+/g, replacement: '/var/tmp/[TEMP]' },
    // Node modules paths (can reveal project structure)
    { pattern: /\/node_modules\/[^\s:]+/g, replacement: '/node_modules/[MODULE]' },
    // Process IDs in paths
    { pattern: /\/proc\/\d+/g, replacement: '/proc/[PID]' },
];

/**
 * PathSanitizer redacts file system paths from strings
 */
export class PathSanitizer {
    private config: PathSanitizerConfig;

    constructor(config: Partial<PathSanitizerConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        
        // Auto-detect some base paths if not provided
        if (this.config.basePaths.length === 0) {
            this.detectBasePaths();
        }
    }

    /**
     * Redact paths from a string
     * @param input - The string to redact paths from
     * @returns The string with paths redacted
     */
    redact(input: string): string {
        if (!this.config.enabled || !input) {
            return input;
        }

        let result = input;

        // Redact configured base paths first (more specific)
        for (const basePath of this.config.basePaths) {
            if (basePath) {
                // Escape special regex characters
                const escaped = basePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const pattern = new RegExp(escaped, 'g');
                result = result.replace(pattern, this.config.basePathReplacement);
            }
        }

        // Apply custom patterns
        for (const { pattern, replacement } of this.config.customPatterns) {
            pattern.lastIndex = 0;
            result = result.replace(pattern, replacement);
        }

        // Apply system path patterns
        if (this.config.redactSystemPaths) {
            for (const { pattern, replacement } of SYSTEM_PATH_PATTERNS) {
                pattern.lastIndex = 0;
                result = result.replace(pattern, replacement);
            }
        }

        return result;
    }

    /**
     * Check if a string contains file paths
     * @param input - The string to check
     * @returns True if paths were detected
     */
    containsPaths(input: string): boolean {
        if (!input) {
            return false;
        }

        // Check for common path patterns
        const pathPatterns = [
            /\/[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+/,  // Unix-style paths
            /[A-Z]:\\[a-zA-Z0-9_.-]+/i,             // Windows-style paths
        ];

        return pathPatterns.some((pattern) => pattern.test(input));
    }

    /**
     * Add a base path to redact
     * @param path - The path to add
     */
    addBasePath(path: string): void {
        if (path && !this.config.basePaths.includes(path)) {
            this.config.basePaths.push(path);
        }
    }

    /**
     * Remove a base path
     * @param path - The path to remove
     * @returns True if the path was removed
     */
    removeBasePath(path: string): boolean {
        const index = this.config.basePaths.indexOf(path);
        if (index > -1) {
            this.config.basePaths.splice(index, 1);
            return true;
        }
        return false;
    }

    /**
     * Get current configuration
     */
    getConfig(): PathSanitizerConfig {
        return { ...this.config, basePaths: [...this.config.basePaths] };
    }

    /**
     * Detect and add common base paths
     */
    private detectBasePaths(): void {
        // Try to detect home directory
        const homeDir = process.env.HOME || process.env.USERPROFILE;
        if (homeDir) {
            this.config.basePaths.push(homeDir);
        }

        // Try to detect current working directory
        try {
            const cwd = process.cwd();
            if (cwd && cwd !== '/') {
                this.config.basePaths.push(cwd);
            }
        } catch {
            // Ignore errors (e.g., if cwd was deleted)
        }
    }
}

// Global instance
let globalPathSanitizer: PathSanitizer | null = null;

/**
 * Get the global PathSanitizer instance
 */
export function getPathSanitizer(): PathSanitizer {
    if (!globalPathSanitizer) {
        globalPathSanitizer = new PathSanitizer();
    }
    return globalPathSanitizer;
}

/**
 * Configure the global PathSanitizer instance
 */
export function configurePathSanitizer(config: Partial<PathSanitizerConfig>): void {
    globalPathSanitizer = new PathSanitizer(config);
}

