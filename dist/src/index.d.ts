import type { Doc, Finding, Rule, Severity } from "./doc.js";
export type { Doc, Finding, Fix, Rule, Severity } from "./doc.js";
export { prepare, countWords } from "./doc.js";
/** Every rule, in the order findings are reported. */
export declare const rules: Rule[];
/**
 * Rule sets for languages other than English, keyed by the language tag used to switch them
 * on. Empty until a pack lands: issue #1 tracks the first one, and the vocabulary rules are
 * the ones that need translating, since the structural rules already work in any language.
 *
 * A pack is a file under `src/rules/<lang>.ts` exporting its rules, registered here. Every
 * rule in it carries an id prefixed with its language, so `zh/chatbot` and never `chatbot`,
 * and a source, the same requirement the English rules meet. Nothing loads a pack unless the
 * language is asked for, so an English-only repository can never see a finding from one.
 */
export declare const languageRules: Record<string, Rule[]>;
/**
 * The English rules, plus the packs for any language asked for. Throws on a language with no
 * pack rather than silently linting without it, because a repository that configured `zh` and
 * got no Chinese findings would read that as a clean file.
 */
export declare function rulesFor(languages?: readonly string[]): Rule[];
/**
 * What a pack has to satisfy before it is registered. Called by the pack's own test, so a
 * contributor sees the requirement fail rather than reading it in a document.
 */
export declare function checkLanguagePack(lang: string, pack: readonly Rule[]): string[];
export declare const WEIGHTS: Record<Severity, number>;
/** Grade thresholds on the weighted findings-per-thousand-words score. */
export declare const GRADES: [string, number][];
export interface LintOptions {
    ignore?: string[];
    /** When set, only these rule ids run; `ignore` still applies on top. */
    only?: string[];
    /** Language packs to switch on, by tag. English is always on. */
    languages?: readonly string[];
    /**
     * The language this document's prose is written in, as a BCP 47 tag. Defaults to English,
     * which is the behaviour every existing repository has. When it is anything else, rules
     * marked `englishOnly` stand down, because their evidence is English and their pattern is
     * ordinary writing elsewhere. This is configuration rather than detection on purpose: a
     * guess made on a README with English headings over French prose is wrong either way.
     */
    language?: string;
    /**
     * Words below which the document is not graded. Defaults to GRADE_FLOOR. A caller that
     * only ever sees short text, the commit-message paths, passes 0, because there the
     * question is whether a message carries a tell, not how dense the tells are.
     */
    floor?: number;
}
/**
 * A document shorter than this is not graded. Below it the denominator is small enough
 * that one finding decides the grade, so the letter says more about the length than about
 * the writing. A 12-word fragment with one em dash used to score 60 and print an F.
 */
export declare const GRADE_FLOOR = 50;
/** True for the default and for every English tag, "en", "en-GB", "en_US". */
export declare const isEnglish: (tag: string | undefined) => boolean;
export interface LintResult {
    path: string;
    words: number;
    findings: Finding[];
    /**
     * Rules that did not run because the declared language is not English. Reported so that a
     * quiet result is never mistaken for a clean one.
     */
    stoodDown: string[];
    /** Weighted findings per 1,000 words, or null when the document is under GRADE_FLOOR words. */
    score: number | null;
    /** Null when the document is too short to grade; the findings still stand. */
    grade: string | null;
    errors: number;
}
export declare function gradeFor(score: number): string;
export declare function lintText(path: string, text: string, options?: LintOptions): LintResult;
export declare function lintDoc(doc: Doc, options?: LintOptions): LintResult;
/** Apply every safe fix once. Overlapping fixes keep the earlier one. */
export declare function applyFixes(text: string, findings: Finding[]): {
    text: string;
    applied: number;
};
/** Lint, fix, and lint again so the returned findings describe the fixed text. */
export declare function fixText(path: string, text: string, options?: LintOptions): {
    text: string;
    applied: number;
    result: LintResult;
};
