import type { Doc, Finding, Rule } from "../doc.js";
import { position, scan } from "../doc.js";

/** List items that open with a bold label and a colon. */
export const boldLabel: Rule = {
  id: "bold-label",
  title: "Bold mini-heading in a list item",
  severity: "warning",
  source: "Wikipedia, Signs of AI writing: Excessive use of boldface",
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
  check(doc) {
    return scan(doc, curlyQuotes, /[“”‘’]/g, (m) => `curly ${/[“”]/.test(m[0]) ? "quote" : "apostrophe"}; straight marks match the rest of the repository`, (m) => (/[“”]/.test(m[0]) ? '"' : "'"));
  },
};

/** Too many hyphenated word pairs per hundred words. */
export const hyphenDensity: Rule = {
  id: "hyphen-density",
  title: "Hyphenated compounds everywhere",
  severity: "info",
  source: "Wikipedia, Signs of AI writing: Overuse of hyphenated compounds",
  check(doc) {
    const matches = [...doc.masked.matchAll(/\b[a-z]+-[a-z]+\b/gi)];
    if (doc.words < 100) return [];
    const per100 = (matches.length / doc.words) * 100;
    if (per100 <= 3) return [];
    const first = matches[0]!;
    const { line, column } = position(doc, first.index!);
    return [{ rule: hyphenDensity.id, severity: hyphenDensity.severity, line, column, excerpt: `${matches.length} hyphenated pairs in ${doc.words} words`, message: `${per100.toFixed(1)} hyphenated compounds per 100 words; drop the hyphen after the noun ("the report is high quality")` }];
  },
};
