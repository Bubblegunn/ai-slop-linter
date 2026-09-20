/**
 * A document prepared for the rules: the original text, the same text with
 * fenced code, inline code, URLs, front matter and HTML comments blanked out
 * (same length, so offsets line up), line starts for offset to line/column,
 * and the inline ignore directives.
 */
export interface Doc {
    path: string;
    text: string;
    /** Same length as `text`; masked regions are spaces, newlines are kept. */
    masked: string;
    lineStarts: number[];
    words: number;
    /** Line numbers (1-based) whose findings are ignored entirely. */
    ignoredLines: Set<number>;
    /** Rule ids ignored for the whole file from the directive's line onward, with that line. */
    ignoredRules: Map<string, number>;
    /** Rule ids ignored on a specific line: "line:rule". */
    ignoredLineRules: Set<string>;
}
export interface Finding {
    rule: string;
    severity: Severity;
    line: number;
    column: number;
    excerpt: string;
    message: string;
    fix?: Fix;
}
export type Severity = "error" | "warning" | "info";
export interface Fix {
    start: number;
    end: number;
    replacement: string;
}
export interface Rule {
    id: string;
    title: string;
    severity: Severity;
    /** Where the pattern comes from: a section of Wikipedia's "Signs of AI writing" or "house". */
    source: string;
    /** Why the pattern reads as machine-made, in a sentence or two. Printed by --explain. */
    why: string;
    /** A line that trips the rule and the same line rewritten. Both are checked by the tests. */
    example: {
        before: string;
        after: string;
    };
    /** The case where a maintainer should switch this rule off rather than obey it. */
    ignoreWhen: string;
    /**
     * True for a rule whose evidence is English and whose pattern is ordinary writing
     * elsewhere, so it stands down when a repository declares it writes in another language.
     * Set only where that was measured: see `bench/TYPOGRAPHY.md`.
     */
    englishOnly?: boolean;
    check(doc: Doc): Finding[];
}
/**
 * How many words a document holds, in any script.
 *
 * Scripts that separate words are tokenised, which is what the tool has always done and
 * keeps every English score where it was. Scripts that do not separate words are handed to
 * the platform's Unicode segmenter (UAX #29 plus ICU's dictionaries), because the only
 * alternative is a characters-per-word constant, and that would be a number nobody measured.
 * Where the segmenter is missing or has no dictionary for the script, two characters count
 * as one word and the count is an estimate; that is the conservative direction, since fewer
 * words raise the score rather than lower it.
 *
 * The second argument exists so a test can hand in a segmenter that behaves like a build
 * without dictionaries; nothing in the tool passes it.
 */
export declare function countWords(text: string, seg?: Intl.Segmenter | undefined): number;
export declare function prepare(path: string, text: string): Doc;
/** 1-based line and column for an absolute offset. */
export declare function position(doc: Doc, offset: number): {
    line: number;
    column: number;
};
/** The original text of the line containing `offset`, trimmed to a readable excerpt around it. */
export declare function excerptAt(doc: Doc, offset: number, length: number): string;
/** Run a regex over the masked text and turn every match into a finding. */
export declare function scan(doc: Doc, rule: Pick<Rule, "id" | "severity">, pattern: RegExp, message: (m: RegExpMatchArray) => string, fix?: (m: RegExpMatchArray) => string | null): Finding[];
/** Whether a finding is suppressed by an inline directive. */
export declare function suppressed(doc: Doc, f: Finding): boolean;
