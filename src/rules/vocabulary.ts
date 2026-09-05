import type { Rule } from "../doc.js";
import { scan } from "../doc.js";

/** Words and phrases that language models use far more often than people do. */
export const aiVocabulary: Rule = {
  id: "ai-vocabulary",
  title: "Overused AI vocabulary",
  severity: "warning",
  source: "Wikipedia, Signs of AI writing: Vocabulary",
  check(doc) {
    return scan(
      doc,
      aiVocabulary,
      /\b(?:delv(?:e|es|ed|ing)|tapestry|testament|pivotal|crucial|underscor(?:es|ed|ing)|showcas(?:e|es|ed|ing)|vibrant|robust|seamless(?:ly)?|leverag(?:e|es|ed|ing)|elevat(?:e|es|ed|ing)|harness(?:es|ed|ing)? the|unlock(?:s|ed|ing)? the|game[- ]changer|in today'?s fast[- ]paced|at the end of the day|it(?:'s| is) worth noting|navigate the (?:complexities|landscape|world)|multifaceted|meticulous(?:ly)?|intricate|intricacies|realm of|embark(?:s|ed|ing)? on|paradigm shift|synergy|holistic|cutting[- ]edge|ever[- ]evolving)\b/gi,
      (m) => `"${m[0]}": a word models reach for; use the plain one`,
    ).concat(
      // "landscape" as an abstract noun, not a picture
      scan(doc, aiVocabulary, /\b(?:the|this|a|an|its|their|our) (?:\w+ )?landscape\b(?! (?:photo|photograph|mode|orientation|painting|architect))/gi, (m) => `"${m[0]}": abstract "landscape"; name the actual thing`),
    );
  },
};

/** Advertising language. */
export const sales: Rule = {
  id: "sales",
  title: "Sales language",
  severity: "warning",
  source: "Wikipedia, Signs of AI writing: Promotional language",
  check(doc) {
    return scan(
      doc,
      sales,
      /\b(?:breathtaking|stunning|nestled|must-visit|must-see|world-class|state-of-the-art|best-in-class|groundbreaking|revolutionary|unparalleled|unmatched|boasts? (?:a|an|over)|rich (?:cultural )?heritage|natural beauty|in the heart of|renowned)\b/gi,
      (m) => `"${m[0]}": sounds like an advertisement; give the fact instead`,
    );
  },
};

const FILLERS: [RegExp, string][] = [
  [/\bin order to\b/gi, "to"],
  [/\bdue to the fact that\b/gi, "because"],
  [/\b(?:it is|it's) important to note that\b ?/gi, ""],
  [/\bat this point in time\b/gi, "now"],
  [/\bin the event that\b/gi, "if"],
  [/\bhas the ability to\b/gi, "can"],
  [/\bfor the purpose of\b/gi, "for"],
  [/\bin the process of\b/gi, ""],
  [/\ba wide (?:range|variety|array) of\b/gi, "many"],
  [/\bin a timely manner\b/gi, "promptly"],
];

/** Phrases that carry no meaning of their own; every one has a shorter form. */
export const filler: Rule = {
  id: "filler",
  title: "Filler phrase",
  severity: "info",
  source: "Wikipedia, Signs of AI writing: Filler phrases",
  check(doc) {
    return FILLERS.flatMap(([re, to]) =>
      scan(doc, filler, re, (m) => (to ? `"${m[0]}": say "${to}"` : `"${m[0]}": cut it`), (m) => {
        if (to) return keepCase(m[0], to);
        return "";
      }),
    );
  },
};

function keepCase(original: string, replacement: string): string {
  return /^[A-Z]/.test(original) ? replacement.charAt(0).toUpperCase() + replacement.slice(1) : replacement;
}
