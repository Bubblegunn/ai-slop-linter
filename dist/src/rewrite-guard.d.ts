/**
 * Checks `--verify` runs on the size and the sentences of a rewrite: the length bound, and the
 * sentences of the original that are missing from the rewrite.
 */
/** Rewrites outside this ratio of the original length are a collapse or a growth. */
export declare const LENGTH_MIN = 0.35;
export declare const LENGTH_MAX = 1.3;
/** Characters outside fenced code blocks, trimmed. */
export declare function proseLength(text: string): number;
/** The length problem as a message, or null when the rewrite stays inside the bounds. */
export declare function lengthProblem(before: string, after: string): string | null;
export interface Sentence {
    text: string;
    line: number;
}
/** Sentences of the prose: no fenced code, front matter, table rows or headings. */
export declare function sentences(text: string): Sentence[];
export interface Alignment {
    total: number;
    kept: number;
    /** Original sentences missing from the rewrite that no finding explains. */
    unrequested: Sentence[];
}
/** `flagged` is the set of lines of the original that carry a lint finding or a catalog hit. */
export declare function alignment(before: string, after: string, flagged: Set<number>): Alignment;
/** The report lines; empty when the original has no sentence to compare. */
export declare function alignmentLines(a: Alignment): string[];
