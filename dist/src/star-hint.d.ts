export declare const STAR_HINT_LINE = "If this saved you a review comment, a star helps others find it: https://github.com/Bubblegunn/ai-slop-linter";
/** Variables that mean an AI agent is running the command, so nobody is there to read a hint. */
export declare const AGENT_ENV_VARS: readonly ["CLAUDECODE", "CLAUDE_CODE_ENTRYPOINT", "CODEX_SANDBOX", "CODEX_HOME", "CURSOR_AGENT", "GEMINI_CLI", "AGENT", "AI_AGENT", "OPENCODE", "AIDER_MODEL"];
/** Variables a git hook framework sets while it runs the linter; the hint would reach a terminal there. */
export declare const HOOK_ENV_VARS: readonly ["PRE_COMMIT", "GIT_INDEX_FILE", "HUSKY", "LEFTHOOK", "LINT_STAGED"];
/** What the run looked like, as the CLI knows it when it finishes. */
export interface StarHintArgs {
    format: "text" | "json" | "github" | "markdown" | "sarif";
    quiet: boolean;
    fix: boolean;
    commit: boolean;
    pr: boolean;
    explain: boolean;
    history: boolean;
    stdin: boolean;
    exitCode: number;
    findings: number;
}
export interface StarHintStdout {
    isTTY?: boolean;
    write: (chunk: string) => unknown;
}
export interface StarHintFs {
    existsSync: (path: string) => boolean;
    mkdirSync: (path: string) => void;
    writeFileSync: (path: string, data: string) => void;
}
export declare const realFs: StarHintFs;
/**
 * Prints the one-time star hint after a clean interactive text run, and writes the marker so it
 * never prints again on this machine. Every condition that suppresses it returns false without
 * output. Filesystem errors are swallowed; the hint still counts as shown for that run.
 */
export declare function maybeStarHint(env: Record<string, string | undefined>, stdout: StarHintStdout, args: StarHintArgs, fs: StarHintFs): boolean;
