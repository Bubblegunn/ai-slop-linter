import type { Rule } from "../doc.js";
/**
 * A call to action that closes a page with a deadline-style push: "Essayez Calbo dès aujourd'hui".
 * The verb frame is what separates it from "dès aujourd'hui" in ordinary prose, such as "le
 * formulaire est disponible dès aujourd'hui", which has no call to act.
 */
export declare const frCloser: Rule;
/** The French pack, switched on by the French language (see `languageRules` in src/index.ts). */
export declare const frRules: Rule[];
