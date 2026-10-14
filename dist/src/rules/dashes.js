import { position, scan } from "../doc.js";
const WIKI = "Wikipedia, Signs of AI writing: Em dashes";
/**
 * Em dashes, en dashes used as dashes, spaced hyphens and double hyphens.
 * En dashes between digits (2019–2021) are ranges and are left alone.
 * Fix: a dash between words becomes a comma; a dash after sentence-final
 * punctuation is dropped; a dash that opens a line is left for a human.
 */
export const dashes = {
    id: "dash",
    title: "Em dash or en dash used as a dash",
    severity: "error",
    source: WIKI,
    why: "Models punctuate with the em dash far more often than most writers do, and the rest of a repository almost never contains one, so a single dash reads as text that arrived from somewhere else.",
    example: {
        before: "Rates rose \u2014 sharply \u2014 in May.",
        after: "Rates rose sharply in May.",
    },
    ignoreWhen: "You are quoting a source that uses dashes, or the dash is your own long-standing habit and the rest of the repository agrees with it.",
    // Measured, not assumed. Against correct published prose in thirteen languages this rule
    // fires 73.5 times per 1,000 words on Polish, 52.1 on Hungarian, 24.0 on Russian and 22.0
    // on French, against 1.0 on the English human baseline, because the dash is ordinary
    // punctuation there and in Russian it stands in for the verb. bench/TYPOGRAPHY.md has the
    // table and docs/typography-across-languages.md has the argument, including why a density
    // threshold cannot separate correct German prose from the machine corpus.
    englishOnly: true,
    check(doc) {
        const em = scan(doc, dashes, 
        // The spaced-hyphen branch must not match a Markdown list marker. A nested item
        // ("  - two") is a hyphen preceded only by indentation, which is a bullet, not a dash.
        // A run of em dashes is one mark, not one finding per character: the Chinese 破折号 is
        // written as two em dashes and was reported twice.
        // Leading whitespace is taken only from the start of a run. A bare leading `[ \t]*` was
        // retried from every position of a long run of spaces, so 100,000 spaces took 4.5 s
        // (test/perf.test.ts). Matches are unchanged: compared on every Markdown file in the
        // repository and 200,000 generated strings of spaces, tabs, dashes and digits.
        // The list-marker exclusion is done after matching (isListMarker) rather than with a
        // `(?<!^[ \t]*)` lookbehind: V8 before Node 24 re-scanned that lookbehind from every position
        // of a run of spaces, so 100,000 spaces still took over 3 s on Node 20 and 22 in CI.
        /(?:(?<![ \t])[ \t]+)?(?:—+|–(?!\d)|(?<=\s)--(?=\s)| - )[ \t]*/gm, (m) => (m[0].includes("—") ? "em dash" : m[0].trim() === "--" ? "double hyphen used as a dash" : m[0].includes("–") ? "en dash used as a dash" : "spaced hyphen used as a dash"), (m) => fixFor(doc, m));
        // en dash between digits is a range, and a hyphen preceded only by indentation is a list
        // marker: drop those matches
        return em.filter((f) => !isRange(doc, f) && !isListMarker(doc, f));
    },
};
function isListMarker(doc, f) {
    if (f.message !== "spaced hyphen used as a dash")
        return false;
    const lineStart = doc.lineStarts[f.line - 1];
    const start = lineStart + f.column - 1;
    const hyphen = doc.masked.indexOf("-", start);
    return !/[^ \t]/.test(doc.masked.slice(lineStart, hyphen));
}
function isRange(doc, f) {
    const start = doc.lineStarts[f.line - 1] + f.column - 1;
    const before = doc.masked[start - 1] ?? "";
    const after = doc.masked[start + (f.fix ? f.fix.end - f.fix.start : 1)] ?? "";
    return /\d/.test(before) && /\d/.test(after) && !/\s/.test(doc.masked.slice(start, start + 3));
}
function fixFor(doc, m) {
    const start = m.index;
    const before = doc.masked.slice(Math.max(0, start - 1), start);
    // From lineStarts, and a search that stops at the first visible character: finding the
    // line start with lastIndexOf and trimming the whole prefix was quadratic on a long line.
    const lineStart = doc.lineStarts[position(doc, start).line - 1];
    if (!/\S/.test(doc.masked.slice(lineStart, start)))
        return null; // dash opening a line: dialogue or a list, leave it
    if (/[.!?:;,]$/.test(before))
        return " "; // ". — Next" becomes ". Next"
    const after = doc.masked.slice(start + m[0].length, start + m[0].length + 1);
    if (after === "" || after === "\n")
        return "."; // trailing dash at end of line
    return ", ";
}
