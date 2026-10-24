/**
 * Checks `--verify` runs on the size and the sentences of a rewrite: the length bound, and the
 * sentences of the original that are missing from the rewrite.
 */
/** Rewrites outside this ratio of the original length are a collapse or a growth. */
export const LENGTH_MIN = 0.35;
export const LENGTH_MAX = 1.3;
/** A shorter original (outside fences) is not measured. */
const LENGTH_FLOOR = 200;
const FENCE = /^\s*(?:```(?!.*```)|~~~)/;
/** Lines of the text with fenced code and front matter blanked to null; line numbers stay. */
function proseLines(text) {
    const lines = text.split(/\r?\n/);
    let fenced = false;
    let front = lines[0]?.trim() === "---";
    return lines.map((line, i) => {
        if (front) {
            if (i > 0 && /^(?:---|\.\.\.)\s*$/.test(line))
                front = false;
            return null;
        }
        if (FENCE.test(line)) {
            fenced = !fenced;
            return null;
        }
        return fenced ? null : line;
    });
}
/** Characters outside fenced code blocks, trimmed. */
export function proseLength(text) {
    return text.split(/\r?\n/).reduce((acc, line) => {
        if (FENCE.test(line))
            acc.fenced = !acc.fenced;
        else if (!acc.fenced)
            acc.chars.push(line);
        return acc;
    }, { fenced: false, chars: [] }).chars.join("\n").trim().length;
}
/** The length problem as a message, or null when the rewrite stays inside the bounds. */
export function lengthProblem(before, after) {
    const b = proseLength(before);
    if (b < LENGTH_FLOOR)
        return null;
    const ratio = proseLength(after) / b;
    if (ratio >= LENGTH_MIN && ratio <= LENGTH_MAX)
        return null;
    return `length after is ${Math.round(ratio * 100)}% of before (allowed ${LENGTH_MIN * 100}% to ${LENGTH_MAX * 100}%)`;
}
// A terminator (Latin, CJK, Arabic, Devanagari, Armenian) with its closing marks, then space or the end.
const SPLIT = /(?<=[.!?…。！？؟۔।։]["'”’»)\]]*)\s+|(?<=[。！？])(?=\S)/u;
/** Sentences of the prose: no fenced code, front matter, table rows or headings. */
export function sentences(text) {
    const out = [];
    proseLines(text).forEach((line, i) => {
        if (line === null || /^\s*(?:\||#{1,6}\s)/.test(line))
            return;
        for (const part of line.split(SPLIT)) {
            const s = part.trim();
            if (/[\p{L}\p{N}]/u.test(s))
                out.push({ text: s, line: i + 1 });
        }
    });
    return out;
}
const squash = (s) => s.replace(/\s+/g, " ").trim();
/** `flagged` is the set of lines of the original that carry a lint finding or a catalog hit. */
export function alignment(before, after, flagged) {
    const rewrite = squash(proseLines(after).filter((l) => l !== null).join(" "));
    const all = sentences(before);
    const lost = all.filter((s) => !rewrite.includes(squash(s.text)));
    return { total: all.length, kept: all.length - lost.length, unrequested: lost.filter((s) => !flagged.has(s.line)) };
}
const SHOWN = 8;
/** The report lines; empty when the original has no sentence to compare. */
export function alignmentLines(a) {
    if (a.total === 0)
        return [];
    const lines = a.unrequested.slice(0, SHOWN).map((s) => `unrequested edit: ${[...squash(s.text)].slice(0, 80).join("")}`);
    if (a.unrequested.length > SHOWN)
        lines.push(`and ${a.unrequested.length - SHOWN} more`);
    lines.push(`alignment: ${a.kept} of ${a.total} sentences kept verbatim`);
    return lines;
}
