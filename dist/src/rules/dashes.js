import { position, scan } from "../doc.js";
import { MIN_SHARE, detectLanguage, functionWordShare, looksForeign, splitParagraphs } from "../lang.js";
const WIKI = "Wikipedia, Signs of AI writing: Em dashes";
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
        // marker: drop those matches. A dialogue line and a quotation in another language's own
        // quotation marks are typography, not an English dash, so they are dropped too.
        const quoted = quotedOffsets(doc);
        foreignOffsets(doc, quoted);
        const dialogue = dialogueLines(doc);
        return em.filter((f) => !isRange(doc, f) && !isListMarker(doc, f) && !dialogue.has(f.line) && !quoted[doc.lineStarts[f.line - 1] + f.column - 1]);
    },
};
/**
 * First lines of a paragraph whose first visible character, in the raw text, is an em or en
 * dash followed by a space, a letter, ¿ or ¡, and that are plausibly not English prose: the
 * dialogue opener of Spanish, French, Russian and others. The whole line is exempt, including
 * the dashes inside it that set off a speaker tag. A continuation line is exempt only when it
 * carries a raya pattern (see hasRaya). A hyphen (a list item) or a dash before a digit is never
 * exempt.
 *
 * "Opens with a dash" is decided on the raw line. In the masked text inline code is spaces, so
 * a line such as "`readdirp(root)` - returns ..." looked like it opened with a dash. And an
 * English paragraph that opens with an em dash (U+2014, then "Our platform is seamless", another
 * em dash, "truly robust") is not dialogue: it is exempt only when the paragraph is confidently another language (five
 * words are enough here), carries a Spanish raya (a dash directly before a letter, or before
 * ¿ or ¡ after a space, or an inner dash directly before a verb), or has too few English function words
 * to read as English at all (Russian, Finnish, Turkish: no word list here). This rule only runs on a file whose language is English, so a file in another
 * language never reaches this function.
 */
function dialogueLines(doc) {
    const out = new Set();
    const text = doc.masked;
    // The file start counts as a blank line, and front matter and code are masked to spaces, so a
    // block that begins right after them is a paragraph start too.
    let previousBlank = true;
    const blankAt = (line) => {
        let i = doc.lineStarts[line];
        while (text[i] === " " || text[i] === "\t")
            i++;
        const c = text[i];
        return c === undefined || c === "\n" || c === "\r";
    };
    doc.lineStarts.forEach((start, index) => {
        const blank = blankAt(index);
        if (previousBlank && !blank) {
            let i = start;
            while (doc.text[i] === " " || doc.text[i] === "\t")
                i++;
            const first = doc.text[i];
            // Only the first line of a paragraph: a hard-wrapped continuation line that starts with a
            // dash is handled in the branch below (raya only). After the dash, a space, a letter or ¿ or ¡ makes
            // it an opener; a digit (an en dash before a minus sign) does not.
            if ((first === "—" || first === "–") && /[\s\p{L}¿¡]/u.test(doc.text[i + 1] ?? "") && notEnglishProse(doc, index))
                out.add(index + 1);
        }
        else if (!blank && !previousBlank) {
            // A continuation line that opens with a dash and carries the Spanish raya is that
            // language's dialogue typography wherever it falls in the paragraph.
            const line = lineText(doc, index);
            if (/^[ \t]*[—–]/.test(line) && hasRaya(line))
                out.add(index + 1);
        }
        previousBlank = blank;
    });
    return out;
}
/** Whether the paragraph starting at the 0-based line `index` is plausibly not English prose. */
function notEnglishProse(doc, index) {
    const first = lineText(doc, index);
    if (hasRaya(first))
        return true;
    // The paragraph: this line and the lines after it up to the next blank one.
    let end = index;
    while (end + 1 < doc.lineStarts.length && lineText(doc, end + 1, true).trim() !== "")
        end++;
    const paragraph = doc.masked.slice(doc.lineStarts[index], end + 1 < doc.lineStarts.length ? doc.lineStarts[end + 1] : doc.masked.length);
    const guess = detectLanguage(paragraph, { minTokens: 5 });
    if (guess.tag !== null)
        return guess.tag !== "en";
    // No language is clear. A paragraph with too few English function words to read as English
    // (Finnish, Polish, Turkish: no word list here) is not English prose either.
    const share = functionWordShare(paragraph, "en");
    if (guess.words >= 5)
        return share < MIN_SHARE;
    // Under five words nothing can be measured. With no English function word at all (a Turkish
    // "Hadi yap! derdi." after the dash) it cannot be called English, so the dialogue exemption
    // stands. One English function word is not enough to call a line English when it also has a
    // letter outside ASCII: the Polish "Skąd pan to wie?" has "to", which is also English.
    const hits = Math.round(share * guess.words);
    return hits === 0 || (hits === 1 && /[^\u0000-\u007f]/.test(paragraph.replace(/[^\p{L}]/gu, "")));
}
/** The Spanish raya: a dash before a letter, a dash and then ¿ or ¡, or an inner dash glued to the verb that follows. */
const hasRaya = (line) => /^[ \t]*[—–][ \t]*[¿¡]/.test(line) || /^[ \t]*[—–]\p{L}/u.test(line) || /[ \t][—–]\p{L}/u.test(line);
/** One line of the raw text (or of the masked text) without its line break. */
function lineText(doc, index, masked = false) {
    const source = masked ? doc.masked : doc.text;
    const from = doc.lineStarts[index];
    const to = index + 1 < doc.lineStarts.length ? doc.lineStarts[index + 1] : source.length;
    return source.slice(from, to).replace(/\r?\n$/, "");
}
/**
 * Offsets inside a quotation in the typographic marks of French and Italian (« »), Spanish and
 * Italian (‹ ›) and German („ “ or „ ”). A span lives inside one paragraph, so an unclosed mark
 * never reaches the next paragraph. English quotation marks are not in this list on purpose.
 */
const QUOTE = /«[^«»]*»|‹[^‹›]*›|„[^„“”]*[“”]/g;
function quotedOffsets(doc) {
    const out = new Uint8Array(doc.masked.length);
    for (const p of splitParagraphs(doc.masked)) {
        for (const m of p.text.matchAll(QUOTE))
            out.fill(1, p.start + m.index, p.start + m.index + m[0].length);
    }
    return out;
}
/**
 * Marks, in `out`, a paragraph (or a quoted span of an English paragraph, in straight or curly
 * double quotes) that looks like a language this tool has no word list for: 8 or more word
 * tokens, no English function word, a letter outside ASCII (see looksForeign). The Turkish
 * sentence of the h14 fixture is the case: its en dash is that language's punctuation, and no
 * Turkish list exists for the paragraph guess to find it. A dash inside straight quotes is not
 * exempt in general; only quoted text that passes the test is.
 */
function foreignOffsets(doc, out) {
    for (const p of splitParagraphs(doc.masked)) {
        if (looksForeign(p.text)) {
            out.fill(1, p.start, p.end);
            continue;
        }
        for (const m of p.text.matchAll(/"([^"\n]+)"|\u201C([^\u201D\n]+)\u201D/g)) {
            if (looksForeign(m[1] ?? m[2] ?? ""))
                out.fill(1, p.start + m.index, p.start + m.index + m[0].length);
        }
    }
}
function isListMarker(doc, f) {
    if (f.message !== "spaced hyphen used as a dash")
        return false;
    const lineStart = doc.lineStarts[f.line - 1];
    const start = lineStart + f.column - 1;
    const hyphen = doc.masked.indexOf("-", start);
    // The raw text: inline code is spaces in the masked text, so "`code` - note" looked like a
    // hyphen that follows only indentation, and its dash was never reported.
    return !/[^ \t]/.test(doc.text.slice(lineStart, hyphen));
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
