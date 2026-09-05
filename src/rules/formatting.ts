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
        out.push({ rule: titleCase.id, severity: titleCase.severity, line, column, excerpt: m[0].trim(), message: "Title Case heading; sentence case reads as written by a person" });
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
    return findings.sort((a, b) => a.line - b.line || a.column - b.column);
  },
};

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
    return [{ rule: hyphenDensity.id, severity: hyphenDensity.severity, line, column, excerpt: `${matches.length} hyphenated pairs in ${doc.words} words`, message: `${per100.toFixed(1)} hyphenated compounds per 100 words; drop the hyphen after the noun ("the report is high quality")` }];
  },
};
