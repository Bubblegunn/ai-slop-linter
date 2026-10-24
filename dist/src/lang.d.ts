export interface LanguageGuess {
    tag: string | null;
    confidence: number;
    words: number;
}
export interface Paragraph {
    start: number;
    end: number;
    text: string;
}
export declare const MIN_SHARE = 0.12;
/**
 * Whether `text` is plausibly written in a language this tool has no word list for (Turkish,
 * Finnish, Polish): at least `minTokens` word tokens, not one function word of any listed language
 * (English included), and at least one letter outside ASCII. One such function word is enough to
 * say it is not.
 */
export declare function looksForeign(text: string, minTokens?: number): boolean;
/** Thresholds for one call. The share and ratio thresholds are the same for every call. */
export interface DetectOptions {
    /** Word count below which nothing is said. Default: the whole-file floor. */
    minTokens?: number;
    /** Distinct function words of the winning language required. Default 0 (no requirement). */
    minDistinct?: number;
    /** Function-word hits of the winning language required. Default 0 (no requirement). */
    minHits?: number;
}
/**
 * Paragraph mode: a short paragraph is called foreign only on three distinct function words
 * of that language and at least three hits, so one word such as "over" (Dutch) or "plus"
 * (French) inside English prose cannot decide it.
 */
export declare const PARAGRAPH_DETECT: DetectOptions;
/**
 * The language of `text`, or a null tag when no language is clear. A number is `minTokens`,
 * the word count below which nothing is said; the default is the whole-file floor, and a
 * paragraph passes a smaller one. An options object adds the distinct-word and hit counts.
 */
export declare function detectLanguage(text: string, limits?: number | DetectOptions): LanguageGuess;
/**
 * The share of the words of `text` that are function words of `tag`, 0 when there are none.
 * Words that two languages' lists share count for neither, as in detectLanguage.
 */
export declare function functionWordShare(text: string, tag: string): number;
/**
 * The language of `text` for compare only: Polish, Indonesian or Turkish, by the same rule as
 * detectLanguage (at least 25 words, function words at least 12 percent of them, at least 1.5 times
 * the second of the three). Null for every other language or when none is clear. detectLanguage
 * itself is unchanged, so the linter's dash rule does not move.
 */
export declare function guessCompareLanguage(text: string): string | null;
/**
 * The `lang` or `language` key of a front-matter block at the top of the file (YAML `lang: fr`
 * or TOML `lang = "fr"`), as a two-letter primary subtag. A byte order mark before the opening fence is allowed. An empty block, or a
 * value that is not a two-letter code or a mapped three-letter one, gives null.
 */
export declare function frontMatterLanguage(text: string): string | null;
export declare function splitParagraphs(text: string): Paragraph[];
