/**
 * The chained-sentence hint behind `--verify`: a long sentence that strings several clauses
 * together and also holds a finding. It prints `rebuild` with the line, the word count and the
 * finding, and never changes the exit code: it tells the rewriter that rebuilding or splitting
 * this sentence is allowed. A sentence with no finding gets no hint, so clean text is never touched.
 */
import { SENTENCE_BREAK } from "./hedge.js";
import { position } from "./doc.js";
const MIN_WORDS = 32;
const MIN_CLAUSES = 4;
/** Scripts written without spaces: 60 characters count as 10 words. */
const UNSPACED = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Thai}]/u;
const CHARS_PER_WORD = 6;
const COMMAS = /[,，、;；]/g;
/** Coordinating and subordinating words that open a clause (en, es, pt, fr, de, nl, tr). */
const CLAUSE_WORDS = new Set([
    "and", "but", "or", "which", "because", "although", "while", "whereas", "so", "yet", "that",
    "y", "e", "pero", "porque", "aunque", "mientras", "que", "mas", "porém", "embora", "enquanto",
    "et", "mais", "ou", "car", "bien", "lorsque", "und", "aber", "oder", "weil", "obwohl", "während", "dass", "sondern",
    "en", "maar", "of", "omdat", "hoewel", "terwijl", "dat", "ve", "ama", "fakat", "çünkü", "ancak", "ki",
]);
const wordCount = (sentence) => {
    let n = 0;
    for (const m of sentence.matchAll(/[\p{L}\p{N}]+/gu))
        n += UNSPACED.test(m[0]) ? m[0].length / CHARS_PER_WORD : 1;
    return Math.round(n);
};
const clauseCount = (sentence) => {
    let n = sentence.match(COMMAS)?.length ?? 0;
    for (const m of sentence.matchAll(/\p{L}+/gu))
        if (CLAUSE_WORDS.has(m[0].toLowerCase()))
            n++;
    return n;
};
/** One `rebuild` line per chained sentence that holds a finding, in reading order. */
export function chainedSentences(doc, found) {
    if (found.length === 0)
        return [];
    const at = (f) => doc.lineStarts[f.line - 1] + f.column - 1;
    const positions = found.map((f) => ({ f, offset: at(f) })).sort((a, b) => a.offset - b.offset);
    const text = doc.masked;
    const breaks = [0, ...[...text.matchAll(SENTENCE_BREAK)].map((m) => m.index + m[0].length), text.length];
    const lines = [];
    for (let k = 0; k + 1 < breaks.length; k++) {
        const [start, end] = [breaks[k], breaks[k + 1]];
        const hit = positions.find((p) => p.offset >= start && p.offset < end);
        if (!hit)
            continue;
        const sentence = text.slice(start, end);
        const words = wordCount(sentence);
        if (words < MIN_WORDS || clauseCount(sentence) < MIN_CLAUSES)
            continue;
        const lead = start + (sentence.length - sentence.trimStart().length);
        const { line, column } = position(doc, lead);
        lines.push(`${line}:${column} rebuild ${words} words, contains ${hit.f.label}`);
    }
    return lines;
}
