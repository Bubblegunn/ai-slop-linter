import type { Rule } from "../doc.js";
/** Text a chatbot writes to its user, left inside a document that should stand alone. */
export declare const chatbot: Rule;
/** Sentences that announce the next point instead of making it. */
export declare const announcing: Rule;
/** A closing paragraph of vague optimism. */
export declare const closer: Rule;
/** The stock "challenges and future outlook" section. */
export declare const challenges: Rule;
/** Claims attributed to nobody in particular, on a line with no link. */
export declare const vagueSource: Rule;
/** A model talking about its own training. */
export declare const cutoff: Rule;
