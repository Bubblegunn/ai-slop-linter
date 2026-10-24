import type { Doc, Finding, Rule } from "../doc.js";
import { position, scan } from "../doc.js";

/** List items that open with a bold label and a colon. */
export const boldLabel: Rule = {
  id: "bold-label",
  title: "Bold mini-heading in a list item",
  severity: "warning",
  source: "Wikipedia, Signs of AI writing: Excessive use of boldface",
  why:
    "A bold label and a colon on every item turns a list into a form. It is the most recognisable shape in generated documentation, and readers skim past it.",
  example: {
    before: "- **Fast:** the parser runs in one pass.\n",
    after: "- The parser runs in one pass.\n",
  },
  ignoreWhen:
    "The list is a glossary or an options table, where the label is the term being defined.",
  check(doc) {
    return scan(doc, boldLabel, /^[ \t]*(?:[-*+]|\d+\.)\s+\*\*[^*\n]{1,60}?:?\*\*:?\s/gm, () => "bold label with a colon; write the item as a sentence");
  },
};

const SMALL = new Set(["a", "an", "the", "and", "or", "but", "of", "in", "on", "at", "to", "for", "with", "by", "from", "as", "vs", "is", "it"]);

/** Headings with every main word capitalised. */
export const titleCase: Rule = {
  id: "title-case-heading",
  title: "Title Case heading",
  severity: "info",
  source: "Wikipedia, Signs of AI writing: Title case headings",
  why:
    "Title Case on every heading is a house style almost no repository uses, and it is the default a model reaches for.",
  example: {
    before: "## Getting Started With The Parser",
    after: "## Getting started with the parser",
  },
  ignoreWhen:
    "The project's style guide asks for title case; switch the rule off once in .slop.json.",
  // Title case is an English convention. German capitalises every noun, so "Ein Login. Alle
  // Quellen." reads as Title Case there and is ordinary sentence case (found by the Task 20
  // probe of the h17 German fixture, which no heading-bearing corpus had covered before).
  englishOnly: true,
  check(doc) {
    const out: Finding[] = [];
    for (const m of doc.masked.matchAll(/^#{1,6}[ \t]+([^\n]+)$/gm)) {
      const words = m[1]!.trim().split(/\s+/).filter((w) => /^[A-Za-z]/.test(w));
      if (words.length < 3) continue;
      const main = words.slice(1).filter((w) => !SMALL.has(w.toLowerCase()) && w.length > 2);
      if (main.length < 2) continue;
      if (words.every((w) => w === w.toUpperCase())) continue; // ALL CAPS is a different choice
      const caps = main.filter((w) => /^[A-Z]/.test(w)).length;
      if (caps / main.length >= 0.75) {
        const { line, column } = position(doc, m.index!);
        const end = position(doc, m.index! + m[0].length);
        out.push({ rule: titleCase.id, severity: titleCase.severity, line, column, endLine: end.line, endColumn: end.column, excerpt: m[0].trim(), message: "Title Case heading; sentence case reads as written by a person" });
      }
    }
    return out;
  },
};

/** Emoji decorating headings or list markers. */
export const emoji: Rule = {
  id: "emoji",
  title: "Emoji as decoration",
  severity: "warning",
  source: "Wikipedia, Signs of AI writing: Emojis",
  why:
    "Emoji on headings and list markers are applied uniformly as decoration rather than for meaning, and they read badly in terminals and screen readers.",
  example: {
    before: "## \ud83d\ude80 Getting started",
    after: "## Getting started",
  },
  ignoreWhen:
    "The emoji is the content, such as documentation of which emoji a command prints.",
  check(doc) {
    return scan(doc, emoji, /^(?:#{1,6}[ \t]+|[ \t]*(?:[-*+]|\d+\.)[ \t]+)(?:\*\*)?[\p{Extended_Pictographic}✅✔❌⭐]/gmu, () => "emoji decorating a heading or list item; remove it");
  },
};

/** Curly quotes and apostrophes, fixed to straight ones. */
export const curlyQuotes: Rule = {
  id: "curly-quotes",
  title: "Curly quotation marks",
  severity: "info",
  source: "Wikipedia, Signs of AI writing: Curly quotation marks",
  why:
    "Curly marks arrive when text is pasted out of an interface that substitutes them. The rule fires only on a file that mixes them with straight marks, because a file that uses them throughout made a typographic choice.",
  example: {
    before: "The flag is \"--fix\" and it's safe. The model said \u201cthis is fine\u201d.",
    after: "The flag is \"--fix\" and it's safe. The model said \"this is fine\".",
  },
  ignoreWhen:
    "The file is typeset prose that uses curly marks everywhere, in which case the rule already says nothing.",
  check(doc) {
    // A document that never uses a straight mark chose its typography; flagging it
    // would report every line of a typeset book. The tell is the mixture, which is
    // what pasting from an interface that substitutes smart quotes leaves behind.
    //
    // Each family is judged against its own straight form. Chinese quotes with the curly
    // double marks as its primary quotation marks and nests straight apostrophes inside
    // them, which is correct Chinese and not a mixture of anything: judging both families
    // together reported every quotation mark in the file, 21.7 per 1,000 words on the
    // Chinese text in bench/TYPOGRAPHY.md.
    const findings: Finding[] = [];
    if (/"/.test(doc.masked)) findings.push(...scan(doc, curlyQuotes, /[\u201C\u201D]/g, () => "curly quote among straight ones; the file mixes both", () => '"'));
    if (/'/.test(doc.masked)) findings.push(...scan(doc, curlyQuotes, /[\u2018\u2019]/g, () => "curly apostrophe among straight ones; the file mixes both", () => "'"));
    // The closing mark of a German low quotation („Wir melden uns bald“) is a curly mark by
    // design, so it is neither a pasted mark nor safe to turn into a straight one. A span stays
    // inside one paragraph, so an unclosed „ never reaches the next one.
    const low: Array<[number, number]> = [];
    for (const m of doc.masked.matchAll(LOW_QUOTE)) low.push([m.index!, m.index! + m[0].length]);
    const inLowQuote = (f: Finding) => f.fix !== undefined && low.some(([from, to]) => f.fix!.start >= from && f.fix!.start < to);
    return findings.filter((f) => !inLowQuote(f)).sort((a, b) => a.line - b.line || a.column - b.column);
  },
};

/** A German low quotation: „ up to its closing “ or ”, without crossing a blank line. */
const LOW_QUOTE = /\u201E[^\u201E\u201C\u201D\n]*(?:\n(?![ \t]*\r?\n)[^\u201E\u201C\u201D\n]*)*[\u201C\u201D]/g;

/** Too many hyphenated word pairs per hundred words. */
export const hyphenDensity: Rule = {
  id: "hyphen-density",
  title: "Hyphenated compounds everywhere",
  severity: "info",
  source: "Wikipedia, Signs of AI writing: Overuse of hyphenated compounds",
  why:
    "A high rate of hyphenated compounds is the signature of a model reaching for adjectives. Most of them lose the hyphen when they follow the noun.",
  example: {
    before: "This production-ready service is a well-tested, high-performance component built for cloud-native deployments. The state-of-the-art pipeline offers real-time processing with best-in-class reliability, and the developer-friendly API keeps the learning curve short. Teams get end-to-end visibility across every request, with fine-grained control over retries and a battle-tested storage layer underneath. The system is designed for large-scale workloads and keeps latency low under heavy load, which makes it a good fit for data-intensive applications that need predictable behaviour during traffic spikes and long-running background jobs that would otherwise saturate the queue for hours.",
    after: "This service is ready for production. It is well tested, it is fast, and it was built to run in a container. The pipeline processes records as they arrive and its reliability is measured in the benchmark below. The API is small enough to learn in an afternoon. Teams see every request end to end, control retries in detail, and store results in a layer that has run in production for two years. The system handles large workloads and keeps latency low under heavy load, which suits applications that move a lot of data and need predictable behaviour during traffic spikes.",
  },
  ignoreWhen:
    "The compounds are established technical terms in your domain and dropping the hyphen would change the meaning.",
  check(doc) {
    // A Unicode letter class rather than [a-z]: the ASCII version could not match
    // "peut-être" or any hyphenated compound carrying a letter outside the English
    // alphabet, so the rule quietly meant nothing outside ASCII. Measured after the change
    // on every file in bench/corpus and bench/typography: the highest rate in any of them is
    // 1.4 per 100 words, against a threshold of 3, so nothing new fires. One text per
    // language cannot say how often a language that hyphenates freely would cross it.
    const matches = [...doc.masked.matchAll(/(?<![\p{L}\p{N}_])\p{L}+-\p{L}+(?![\p{L}\p{N}_])/gu)];
    if (doc.words < 100) return [];
    const per100 = (matches.length / doc.words) * 100;
    if (per100 <= 3) return [];
    const first = matches[0]!;
    const { line, column } = position(doc, first.index!);
    // The rule has no phrase to cover: it judges the whole document, so the range runs from
    // the first compound to the end of the text.
    const end = position(doc, doc.text.length);
    return [{ rule: hyphenDensity.id, severity: hyphenDensity.severity, line, column, endLine: end.line, endColumn: end.column, excerpt: `${matches.length} hyphenated pairs in ${doc.words} words`, message: `${per100.toFixed(1)} hyphenated compounds per 100 words; drop the hyphen after the noun ("the report is high quality")` }];
  },
};

/** Names of the invisible characters the rule reports, by code point. */
const INVISIBLE_NAMES: Record<number, string> = {
  0x180e: "MONGOLIAN VOWEL SEPARATOR",
  0x200b: "ZERO WIDTH SPACE",
  0x200c: "ZERO WIDTH NON-JOINER",
  0x200d: "ZERO WIDTH JOINER",
  0x200e: "LEFT-TO-RIGHT MARK",
  0x200f: "RIGHT-TO-LEFT MARK",
  0x2060: "WORD JOINER",
  0xfeff: "ZERO WIDTH NO-BREAK SPACE",
};
const invisibleName = (cp: number) =>
  INVISIBLE_NAMES[cp] ?? (cp >= 0xe0000 ? "TAG CHARACTER" : cp >= 0x2061 && cp <= 0x2064 ? "INVISIBLE OPERATOR" : "BIDIRECTIONAL CONTROL");
const hex = (cp: number) => `U+${cp.toString(16).toUpperCase().padStart(4, "0")}`;
/** Right-to-left scripts, whose text uses direction marks and controls on purpose. */
const RTL = /[\p{Script=Hebrew}\p{Script=Arabic}\p{Script=Syriac}\p{Script=Thaana}\p{Script=Nko}]/u;
const DIRECTIONAL = /[‎‏‪-‮⁦-⁩]/u;

/**
 * Whether the run sits where an invisible character does a job: next to an emoji (a joined emoji
 * sequence or a subdivision flag), next to a letter of a script other than Latin (Thai, Khmer,
 * Indic and Persian text join or break words with them), at the very start of the file (a byte
 * order mark), or, for a direction mark or control, on a line with right-to-left text.
 */
function invisibleHasAJob(text: string, start: number, end: number): boolean {
  if (start === 0) return true;
  const prev = String.fromCodePoint(text.codePointAt(start - 1 >= 1 && /[\uDC00-\uDFFF]/.test(text[start - 1]!) ? start - 2 : start - 1) ?? 32);
  const next = String.fromCodePoint(text.codePointAt(end) ?? 32);
  const emojiPart = /[\p{Extended_Pictographic}\p{Emoji_Modifier}\p{Regional_Indicator}️⃣]/u;
  if (emojiPart.test(prev) || emojiPart.test(next)) return true;
  const otherScript = (c: string) => /[\p{L}\p{M}]/u.test(c) && !/\p{Script=Latin}/u.test(c);
  if (otherScript(prev) || otherScript(next)) return true;
  const run = text.slice(start, end);
  if (DIRECTIONAL.test(run)) {
    const lineStart = text.lastIndexOf("\n", start - 1) + 1;
    const lineEnd = text.indexOf("\n", end);
    if (RTL.test(text.slice(lineStart, lineEnd === -1 ? undefined : lineEnd))) return true;
  }
  return false;
}

/** Invisible characters in Latin-script prose: zero-width spaces and joiners, direction controls, tag characters. */
export const invisibleCharacter: Rule = {
  id: "invisible-character",
  title: "Invisible character",
  severity: "warning",
  source: "house (idea from the invisible-character pass of everwrite's scripts/tells.py, MIT; our code)",
  why:
    "Text copied out of a chat interface or a web page can carry characters that render as nothing: zero-width spaces and joiners, direction controls, Unicode tag characters. They break search, diffs and spell checks, and a reader cannot see them to remove them.",
  example: {
    before: "The cache​ is warm.",
    after: "The cache is warm.",
  },
  ignoreWhen:
    "The character does a job the rule cannot see, such as a zero-width joiner inside a ligature on purpose. Joined emoji, flags, text in a script other than Latin, a byte order mark at the start of the file, and direction marks on a line with right-to-left text are already left alone. The soft hyphen (U+00AD) is not reported: German and Dutch typesetting uses it.",
  check(doc) {
    return scan(
      doc,
      invisibleCharacter,
      /[᠎​-‏‪-‮⁠-⁤⁦-⁩﻿\u{e0000}-\u{e007f}]+/gu,
      (m) => `${[...m[0]].map((c) => `${hex(c.codePointAt(0)!)} ${invisibleName(c.codePointAt(0)!)}`).filter((v, i, a) => a.indexOf(v) === i).join(", ")}: invisible character; delete it`,
      () => "",
    )
      .filter((f) => !invisibleHasAJob(doc.masked, f.fix!.start, f.fix!.end))
      .map((f) => {
        // Between two word characters the run splits what a reader sees as one word; deleting it would
        // join two tokens a tool reads as separate words, so that case is reported without a fix.
        const word = /[\p{L}\p{N}\p{M}]/u;
        const prev = doc.text[f.fix!.start - 1] ?? "";
        const next = doc.text[f.fix!.end] ?? "";
        if (word.test(prev) && word.test(next)) delete f.fix;
        return f;
      });
  },
};
