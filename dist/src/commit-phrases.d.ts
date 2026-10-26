export interface PhraseList {
    /** The file in the upstream repository the tokens come from. */
    source: string;
    ignorecase: boolean;
    /** Regular expression fragments, matched on word boundaries, as the upstream style does. */
    tokens: readonly string[];
}
export declare const PHRASES: Record<string, PhraseList>;
