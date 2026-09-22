/** Minimal glob: ** crosses directories, * stays inside a segment, ? is one character. */
export declare function globToRegExp(glob: string): RegExp;
/** Files under `root` matching any of the globs, relative paths with forward slashes, skipping build and dependency directories. */
export declare function expand(root: string, globs: string[]): string[];
/** True when a path was reached by a glob and should be skipped unless named explicitly. */
export declare function skippedByDefault(rel: string): boolean;
