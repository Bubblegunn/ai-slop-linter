import type { Rule } from "../doc.js";
/**
 * Em dashes, en dashes used as dashes, spaced hyphens and double hyphens.
 * En dashes between digits (2019–2021) are ranges and are left alone.
 * Fix: a dash between words becomes a comma; a dash after sentence-final
 * punctuation is dropped.
 *
 * Dialogue exemption for the English-only rule (see dialogueLines): a line that opens a
 * paragraph as dialogue is exempt when that paragraph is not English. A continuation line of a
 * hard-wrapped paragraph is exempt only when it carries a raya pattern (a dash that opens the
 * line, a dash directly attached to a letter, or an inverted ¿ or ¡). English-looking lines are
 * not exempt. Known trade-off: a glued English dash ("word—word") on such a raya line is exempt
 * too.
 */
export declare const dashes: Rule;
