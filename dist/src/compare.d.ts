/**
 * Facts a text states: numbers, versions, dates, urls, issue ids, quotations, code and names.
 * Comparing a text with its rewrite shows which facts the rewrite added or lost. The method is
 * deterministic and reads the raw text: it does not judge whether a change is good.
 *
 * Known limits, on purpose:
 * - Spelled-out numbers are read by value (`three` is the number fact `3`) for English and for the
 *   declared, front matter or guessed language. The tables cover numbers two to ninety, not the one
 *   words (`one`, `un`, `een`), `once`, nor hundred, thousand or million. A word joined to another by
 *   `-` or `_` (`five-star`), and a word after `#`, is not read.
 * - Dotted thousands read as versions (`1.000.000` is a version fact, not a number).
 * - Ordinals read as numbers: `3rd` gives number `3`.
 * - `person` facts are first-person words (`our`, `we`, `ich`, `nous`), compared by count: a word
 *   that occurs more often in the rewrite is added (`In benchmarks` becoming `In our benchmarks`
 *   adds `our`, an owner the source never named), a word that occurs less often is lost. Code,
 *   urls, link targets, e-mail addresses and text in double quotation marks (straight, curly,
 *   guillemet and low quotes) are not read, so quoted speech does not count; neither is a word
 *   joined to a letter or digit by `-`, `_`, `/`, `.` or `@` (`us-east-1`, `my-app`), except a
 *   French hyphen (`contactez-nous`, `nous-mêmes`). Limits: the word lists cover English,
 *   French, Spanish, German and Turkish, chosen by the declared, front matter or detected
 *   language (English when it cannot be told, none for another detected language such as Italian; Turkish and texts under about
 *   25 words are not detected, so declare them); Turkish suffixes (`-im`) are not read; a word in
 *   an all-capitals token (`US`, `ME`) is never read; a lowercase `i` is never read; a capital
 *   `I` is skipped as a Roman numeral or list marker (`I.`, `Part I`), in `I/O` and in
 *   abbreviations (`I.T.`); single quotation marks, Markdown block quotes and indented code
 *   blocks are read; a quotation that runs over several lines is read; a stray quotation mark
 *   can hide a stretch of text.
 * - `claim` facts are claim words (`always`, `guaranteed`, `because`) and are reported only when
 *   the rewrite has more of them than the source. Removing a claim word is never reported. The
 *   list is short on purpose: `bench/COMPARE-WORDS.md` records each candidate word with its
 *   flags on honest rewrites, and a word that flagged too many honest rewrites was dropped.
 * - `qualifier` facts are an approximator or a bound right before a number (`about 40%`, `up to 3`,
 *   `bis zu 3`, `plus de 300`). A qualifier is part of the fact: `about 40%` becoming `40%` is a lost
 *   qualifier, `300` becoming `over 300` an added one. Qualifiers are grouped by meaning (about,
 *   at least, at most), so a swap within a group (`about` for `around`, `over` for `more than`) is
 *   not reported. Only a number both texts have is read: a changed number is already a lost and an
 *   added number. Only the words in QUALIFIERS are read; `bench/COMPARE-QUALIFIERS.md` records each
 *   candidate with its flags on honest rewrites. Limits: a qualifier after its number (`40 % environ`)
 *   or spelled-out numbers are not read; code, urls and quoted text are not read.
 * - In German (or Luxembourgish) text only a run of two or more capitalised words is a name:
 *   every noun is capitalised there, so a single "Kaufmann" or "Technik" says nothing, while
 *   "Herr Krause" does. A single surname alone is therefore not compared. The language is the
 *   declared one, the front matter's, or detected from the text; every other kind of fact is
 *   compared as always.
 * - A single capitalised word that opens a table cell is not a name (a run of several is). A name that starts a sentence or a list item is not extracted, and an all-capitals token (an acronym)
 *   is not a name. A name counts as lost or added only when it is absent from the other text
 *   as a whole word, so a name that moves between sentence-initial and mid-sentence is kept.
 */
export type FactKind = "unit" | "number" | "version" | "date" | "url" | "reference" | "quote" | "code" | "name" | "person" | "claim" | "qualifier";
export interface CompareOptions {
    /** The language of the texts, when the caller knows it. Unset or "auto": front matter, then detection. */
    language?: string | undefined;
}
export interface Fact {
    kind: FactKind;
    value: string;
}
export declare function extractFacts(text: string, options?: {
    names?: boolean;
    multiWordNamesOnly?: boolean;
    language?: string | null;
}): Fact[];
/**
 * Every first-person word the reader recognises, by language tag. Lowercase; a trailing apostrophe
 * is an elision (French `j'`). A language not listed here has no person facts; text whose language
 * cannot be told is read with the English list. Which of these words may raise a flag is decided
 * below, from the measurement in bench/COMPARE-WORDS.md.
 */
export declare const PERSON_CANDIDATES: Readonly<Record<string, readonly string[]>>;
export declare function isPolishPersonVerb(word: string): boolean;
export declare function isPortuguesePersonVerb(word: string): boolean;
/**
 * Claim words and phrases measured for the precision rule, by language tag. `leading` alone is not
 * a candidate: technical text adds it honestly (`the leading slash`, `leading zeros`), and the
 * corpus has no case of it either way; `industry-leading` is the claim.
 */
export declare const CLAIM_CANDIDATES: Readonly<Record<string, readonly string[]>>;
/** Person words reported when the rewrite has more of them than the source. */
export declare const PERSON_ADDED: Readonly<Record<string, readonly string[]>>;
/** Person words reported when the rewrite has fewer of them than the source. */
export declare const PERSON_LOST: Readonly<Record<string, readonly string[]>>;
/** Claim words reported when the rewrite has more of them than the source (removals are never reported). */
export declare const CLAIM_WORDS: Readonly<Record<string, readonly string[]>>;
/**
 * Qualifier candidates: an approximator or a bound written right before a number, by language tag,
 * each mapped to its group. `approx` is "about that number", `min` "that number or more", `max` "that
 * number or less". A swap within a group is not a change of fact; a move between groups, a lost or an
 * added qualifier is. Which of these may raise a flag is decided from bench/COMPARE-QUALIFIERS.md.
 */
export declare const QUALIFIER_CANDIDATES: Readonly<Record<string, Readonly<Record<string, "approx" | "min" | "max">>>>;
/**
 * Qualifiers reported when a rewrite drops or adds one next to a number both texts have. English `about`
 * and `approximately` are not here: `about` flagged an honest round 1 rewrite, and without it a swap of
 * `approximately` for `about` would flag (bench/COMPARE-QUALIFIERS.md).
 */
export declare const QUALIFIERS: Readonly<Record<string, readonly string[]>>;
/** One qualifier before a number: the words as written, its group, and the number it qualifies. */
export interface QualifiedNumber {
    qualifier: string;
    group: string;
    number: string;
}
/** Every listed qualifier written right before a number, in the prose of a text (code, urls and quotes are blanked). */
export declare function qualifiedNumbers(text: string, tag?: string | null, words?: readonly string[]): QualifiedNumber[];
/**
 * The qualifier facts a rewrite lost or added: for each group and number, a rewrite with fewer
 * qualified occurrences lost one, with more added one. Only a number that the other text also has
 * counts, because a changed number is reported as a number already. `words` defaults to QUALIFIERS.
 */
export declare function qualifierChanges(before: string, after: string, tag?: string | null, words?: readonly string[]): {
    lost: Fact[];
    added: Fact[];
};
/**
 * Numbers that lost their unit: `4,8 segundos` in the original, and the rewrite still has 4,8 but not
 * followed by the same unit (`1,2 segundos en lugar de 4,8`). A number that is gone is reported as a
 * number already. Units are the measure words of the hedge check (seconds, %, ms, MB, ...).
 */
export declare function unitChanges(before: string, after: string): Fact[];
/** Text with code, urls, link targets and quoted text blanked, so none of it is read as the author's own words. */
export declare function proseOnly(text: string): string;
/** The first-person words of a text, counted. `tag` picks the word list. */
export declare function countPersonWords(text: string, tag?: string | null): Map<string, number>;
/** How often each term occurs in the prose of a text (whole words or phrases, case-insensitive). */
export declare function countTerms(text: string, terms: readonly string[]): Map<string, number>;
/** The language tag compareFacts reads both texts with. */
export declare function languageOf(before: string, after: string, language?: string): string | null;
/**
 * The facts of `before` that `after` no longer has (lost) and the facts `after` has that
 * `before` did not (added), each sorted by kind then value, and how many facts both share.
 */
export declare function compareFacts(before: string, after: string, options?: CompareOptions): {
    lost: Fact[];
    added: Fact[];
    kept: number;
};
