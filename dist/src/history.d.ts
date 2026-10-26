import type { LintOptions } from "./index.js";
/**
 * Your own commit messages, read over time.
 *
 * This is deliberately a mirror and not a telescope. It defaults to the identity in the
 * repository's own git config, it reports a repository's periods rather than a league table
 * of people, it prints no letter grade, and it never fails a build. A number that decides
 * nothing is harder to point at someone.
 */
export type Bucket = "month" | "quarter" | "year";
export interface Period {
    /** The period key: 2026-04, 2026-Q2 or 2026. */
    period: string;
    messages: number;
    words: number;
    findings: number;
    /** Weighted findings per 1,000 words, or null when the period holds too few words to divide. */
    per1000: number | null;
    /** Rule ids by count, most common first. */
    rules: {
        rule: string;
        count: number;
    }[];
}
export interface History {
    identity: string[];
    bucket: Bucket;
    messages: number;
    words: number;
    periods: Period[];
}
export interface HistoryOptions extends LintOptions {
    cwd: string;
    /** Addresses to read. Defaults to the repository's configured user.email. */
    authors?: string[];
    bucket?: Bucket;
    /** Anything `git log --since` accepts. */
    since?: string;
}
/** The address git would put on a commit made here right now. */
export declare function configuredIdentity(cwd: string): string | null;
/**
 * Trailers are boilerplate a tool wrote, not prose a person wrote, so counting them would
 * measure the template. Only the contiguous block at the end goes, which is what the git
 * convention calls a trailer; a `Key: value` line in the middle of a paragraph stays.
 */
export declare function stripTrailers(message: string): string;
export interface Commit {
    /** The author's own local date, taken from the offset git recorded, not converted to UTC. */
    date: string;
    message: string;
}
export declare function readCommits(opts: HistoryOptions): Commit[];
export declare function history(opts: HistoryOptions): History;
export declare function renderHistory(h: History): string;
