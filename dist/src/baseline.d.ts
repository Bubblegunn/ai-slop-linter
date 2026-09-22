import type { LintResult } from "./index.js";
/**
 * A baseline records the findings a repository already has, so a large repository can
 * adopt the linter and fail only on new ones. Entries are keyed by file, rule and the
 * normalised excerpt, not by line number, so an edit above a finding does not make it new.
 */
export interface Baseline {
    version: 1;
    findings: BaselineEntry[];
}
export interface BaselineEntry {
    file: string;
    rule: string;
    excerpt: string;
}
export declare const normaliseExcerpt: (excerpt: string) => string;
export declare function createBaseline(results: LintResult[]): Baseline;
export declare function parseBaseline(text: string): Baseline;
/**
 * Drop the findings the baseline already lists. A baseline entry is consumed once, so two
 * identical tells in one file need two entries; the third one is new. Scores and grades are
 * recomputed over what remains, and `baselined` says how many were set aside.
 */
export declare function applyBaseline(results: LintResult[], baseline: Baseline): {
    results: (LintResult & {
        baselined: number;
    })[];
    baselined: number;
};
