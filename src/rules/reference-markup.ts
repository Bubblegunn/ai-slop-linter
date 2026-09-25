import type { Rule } from "../doc.js";
import { scan } from "../doc.js";

/** Internal citation and formatting residue left behind by chatbot interfaces. */
export const referenceMarkup: Rule = {
  id: "reference-markup",
  title: "Internal reference markup residue",
  severity: "error",
  source: "Wikipedia, Signs of AI writing: Reference markup bugs",
  why:
    "Chatbot interfaces sometimes leave internal citation or rendering markers in copied text. These tokens are implementation residue rather than prose, so a document containing one has exposed the interface instead of the intended reference.",
  example: {
    before: "The result is documented here :contentReference[oaicite:0]{index=0}.",
    after: "The result is documented in the linked source.",
  },
  ignoreWhen:
    "The token is shown inside inline or fenced code, a URL, or another masked region as documentation of the bug; those regions are ignored before rules run.",
  check(doc) {
    return scan(
      doc,
      referenceMarkup,
      /(?::contentReference\[oaicite:\d+\]\{index=\d+\}|contentReference|oaicite|oai_citation|attributableIndex|Example\+\d+|turn\d+(?:search|image|news|file)\d+|\[cite:\s*\d+(?:,\s*\d+)*\]|\[span_\d+\]\((?:start|end)_span\)|grok[_-]card|grok_render_citation_card_json|\[attached_file:\d+\]|attached_file|ppl-ai-file-upload|〖\d+†L\d+-\d+〗|\d+|:::writing\b)/gu,
      (m) => `"${m[0]}": internal reference markup residue; remove the marker and restore the intended reference`,
    );
  },
};
