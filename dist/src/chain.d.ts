import { type Doc } from "./doc.js";
export interface Located {
    line: number;
    column: number;
    /** What the hint names: the rule or check and its phrase. */
    label: string;
}
/** One `rebuild` line per chained sentence that holds a finding, in reading order. */
export declare function chainedSentences(doc: Doc, found: readonly Located[]): string[];
