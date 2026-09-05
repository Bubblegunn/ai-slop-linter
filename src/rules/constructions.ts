import type { Doc, Finding, Rule } from "../doc.js";
import { scan } from "../doc.js";

/** "Not X but Y", "It's not X. It's Y." and "not because A, because B". */
export const notXButY: Rule = {
  id: "not-x-but-y",
  title: "Not X but Y construction",
  severity: "warning",
  source: "Wikipedia, Signs of AI writing: Negative parallelisms",
  check(doc) {
    return [
      ...scan(doc, notXButY, /\bnot (?:just|only|merely|simply|about) [^.;\n]{2,80}?\b(?:but|it'?s|it is)\b/gi, () => "\"not just X but Y\": say the thing itself"),
      ...scan(doc, notXButY, /\b(?:it|this|that)(?:'s| is) not (?:a|an|the|about)? ?[^.;\n]{2,60}?[.;] (?:it|this|that)(?:'s| is)\b/gi, () => "\"It's not X. It's Y.\": state Y directly"),
      ...scan(doc, notXButY, /\bnot because [^.;\n]{2,80}?,? (?:but )?because\b/gi, () => "\"not because A, because B\": give the reason once"),
    ];
  },
};

const STOP = new Set(["the", "and", "for", "with", "that", "this", "from", "into", "than", "then", "your", "their", "have", "will", "were", "been", "also", "more", "most", "very"]);

/** Three single words in a row joined as a list: often a forced rhythm rather than three real items. */
export const triad: Rule = {
  id: "triad",
  title: "Forced group of three",
  severity: "warning",
  source: "Wikipedia, Signs of AI writing: Rule of three",
  check(doc) {
    const out: Finding[] = [];
    for (const f of scan(doc, triad, /\b([a-z]{4,}), ([a-z]{4,}),? (?:and|or) ([a-z]{4,})\b/g, () => "three parallel single words: keep the ones that carry information")) {
      const words = f.excerpt.toLowerCase();
      const m = /\b([a-z]{4,}), ([a-z]{4,}),? (?:and|or) ([a-z]{4,})\b/.exec(words);
      if (!m) continue;
      if ([m[1], m[2], m[3]].some((w) => STOP.has(w!))) continue;
      // same suffix family (adjectives in -ful/-ive/-able, adverbs in -ly, nouns in -tion) is the usual tell
      const suffix = (w: string) => (/(ly|ful|ive|able|ible|tion|sion|ness|ment|ing|ed)$/.exec(w) ?? [""])[0];
      const s = [m[1]!, m[2]!, m[3]!].map(suffix);
      if (!(s[0] && s[0] === s[1] && s[1] === s[2])) continue;
      out.push(f);
    }
    return out;
  },
};

/** Phrases that dress an ordinary point up as a hidden truth. */
export const reveal: Rule = {
  id: "reveal",
  title: "Pretending to reveal a deeper truth",
  severity: "warning",
  source: "house rule, after Wikipedia: Superficial analyses",
  check(doc) {
    return scan(
      doc,
      reveal,
      /\b(?:the real (?:question|issue|problem) is|what really matters|at its core|the heart of the matter|the deeper (?:issue|question|truth)|in reality,|fundamentally,|here'?s the thing|the truth is)\b/gi,
      (m) => `"${m[0]}": make the point without announcing it as a reveal`,
    );
  },
};

/** ", highlighting ..." tails that add a claim of significance to a plain fact. */
export const ingTail: Rule = {
  id: "ing-tail",
  title: "Present-participle tail adding significance",
  severity: "warning",
  source: "Wikipedia, Signs of AI writing: Superficial analyses",
  check(doc) {
    return scan(
      doc,
      ingTail,
      /,\s+(?:highlighting|underscoring|showcasing|ensuring|reflecting|emphasizing|emphasising|symbolizing|symbolising|contributing to|fostering|cultivating|encompassing|demonstrating|solidifying|cementing|reinforcing|signaling|signalling|marking|paving the way)\b/gi,
      (m) => `"${m[0].trim()}": cut the tail or make it its own sentence with a fact in it`,
    );
  },
};

/** Words that claim importance or legacy for ordinary details. */
export const inflated: Rule = {
  id: "inflated",
  title: "Inflated claim of importance",
  severity: "warning",
  source: "Wikipedia, Signs of AI writing: Undue emphasis on significance",
  check(doc) {
    return scan(
      doc,
      inflated,
      /\b(?:stands as a|serves as a|is a testament to|a testament to|pivotal (?:moment|role)|marking a (?:new|significant|pivotal)|setting the stage for|key turning point|evolving landscape|indelible mark|deeply rooted|plays? a (?:crucial|vital|significant|key|pivotal) role|underscores? the (?:importance|significance)|enduring legacy|lasting impact|cannot be overstated)\b/gi,
      (m) => `"${m[0]}": say what happened; let the reader judge the importance`,
    );
  },
};
