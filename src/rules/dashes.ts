import type { Doc, Finding, Rule } from "../doc.js";
import { scan } from "../doc.js";

const WIKI = "Wikipedia, Signs of AI writing: Em dashes";

/**
 * Em dashes, en dashes used as dashes, spaced hyphens and double hyphens.
 * En dashes between digits (2019–2021) are ranges and are left alone.
 * Fix: a dash between words becomes a comma; a dash after sentence-final
 * punctuation is dropped; a dash that opens a line is left for a human.
 */
export const dashes: Rule = {
  id: "dash",
  title: "Em dash or en dash used as a dash",
  severity: "error",
  source: WIKI,
  why:
    "Models punctuate with the em dash far more often than most writers do, and the rest of a repository almost never contains one, so a single dash reads as text that arrived from somewhere else.",
  example: {
    before: "Rates rose \u2014 sharply \u2014 in May.",
    after: "Rates rose sharply in May.",
  },
  ignoreWhen:
    "You are quoting a source that uses dashes, or the dash is your own long-standing habit and the rest of the repository agrees with it.",
  check(doc: Doc): Finding[] {
    const em = scan(
      doc,
      dashes,
      // The spaced-hyphen branch must not match a Markdown list marker. A nested item
      // ("  - two") is a hyphen preceded only by indentation, which is a bullet, not a dash.
      /[ \t]*(?:—|–(?!\d)|(?<=\s)--(?=\s)|(?<!^[ \t]*) - )[ \t]*/gm,
      (m) => (m[0].includes("—") ? "em dash" : m[0].trim() === "--" ? "double hyphen used as a dash" : m[0].includes("–") ? "en dash used as a dash" : "spaced hyphen used as a dash"),
      (m) => fixFor(doc, m),
    );
    // en dash between digits is a range: drop those matches
    return em.filter((f) => !isRange(doc, f));
  },
};

function isRange(doc: Doc, f: Finding): boolean {
  const start = doc.lineStarts[f.line - 1]! + f.column - 1;
  const before = doc.masked[start - 1] ?? "";
  const after = doc.masked[start + (f.fix ? f.fix.end - f.fix.start : 1)] ?? "";
  return /\d/.test(before) && /\d/.test(after) && !/\s/.test(doc.masked.slice(start, start + 3));
}

function fixFor(doc: Doc, m: RegExpMatchArray): string | null {
  const start = m.index!;
  const before = doc.masked.slice(Math.max(0, start - 1), start);
  const lineStart = doc.masked.lastIndexOf("\n", start - 1) + 1;
  const prefix = doc.masked.slice(lineStart, start);
  if (prefix.trim() === "") return null; // dash opening a line: dialogue or a list, leave it
  if (/[.!?:;,]$/.test(before)) return " "; // ". — Next" becomes ". Next"
  const after = doc.masked.slice(start + m[0].length, start + m[0].length + 1);
  if (after === "" || after === "\n") return "."; // trailing dash at end of line
  return ", ";
}
