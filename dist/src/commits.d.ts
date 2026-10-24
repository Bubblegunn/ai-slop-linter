import type { Rule } from "./doc.js";
import type { LintOptions, LintResult } from "./index.js";
/**
 * Tokens left out of a phrase list because they matched pre-2021 human commit messages in the tuning
 * sample (bench/COMMIT-RULES.md has the count for each). Keyed by rule id.
 */
export declare const EXCLUDED: Record<string, readonly string[]>;
/**
 * Candidate rules that measurement kept out, with the reason. A rule here is still written and
 * still measured, so the report can show why it is not used.
 */
export declare const NOT_ADOPTED: Record<string, string>;
/** Escape every regex metacharacter, so a token is always matched as the literal text it spells. */
export declare function escapeRegExp(text: string): string;
export declare function phrasePattern(id: string): RegExp;
/** Every rule adapted from the upstream style, adopted or not. The measurement script reads this. */
export declare const candidateRules: Rule[];
/** The rules that run on commit messages: the candidates that measurement did not rule out. */
export declare const commitRules: Rule[];
export declare function trailerLines(text: string): Set<number>;
/**
 * Lint a commit message or a pull request description: the prose rules, then the commit rules,
 * graded without the fifty-word floor because a message is short by nature and the question is
 * whether it carries a tell. Same options, suppression comments and scoring as `lintText`.
 */
export declare function lintCommitMessage(path: string, text: string, options?: LintOptions): LintResult;
