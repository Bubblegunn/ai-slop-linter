import type { Rule } from "../doc.js";
/**
 * Em dashes, en dashes used as dashes, spaced hyphens and double hyphens.
 * En dashes between digits (2019–2021) are ranges and are left alone.
 * Fix: a dash between words becomes a comma; a dash after sentence-final
 * punctuation is dropped; a dash that opens a line is left for a human.
 */
export declare const dashes: Rule;
