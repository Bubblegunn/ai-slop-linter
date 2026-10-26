import { type Doc } from "./doc.js";
export interface HedgeHit {
    line: number;
    column: number;
    phrase: string;
}
/** The effect-verb lists per language, as written above; the tests count them. */
export declare const EFFECT_VERBS: Readonly<Record<string, readonly string[]>>;
/** Where one sentence ends and the next begins: a full stop, a blank line, a list item or a table row. */
export declare const SENTENCE_BREAK: RegExp;
/** Hedge hits in a document, in reading order. A language with no lexicon, or an unknown one, gives none. */
export declare function scanHedge(doc: Doc, tag: string): HedgeHit[];
