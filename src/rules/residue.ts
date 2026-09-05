import type { Rule } from "../doc.js";
import { scan } from "../doc.js";

/** Text a chatbot writes to its user, left inside a document that should stand alone. */
export const chatbot: Rule = {
  id: "chatbot",
  title: "Chatbot residue",
  severity: "error",
  source: "Wikipedia, Signs of AI writing: Communication intended for the user",
  check(doc) {
    return scan(
      doc,
      chatbot,
      /\b(?:I hope this helps|Certainly!|Of course!|Absolutely!|Great question|You'?re absolutely right|Let me know if|Would you like me to|Want me to|Should I continue|As an AI(?: language model)?|I'?m unable to browse|Feel free to (?:ask|reach out)|Here'?s a (?:breakdown|summary|quick overview) of)\b/g,
      (m) => `"${m[0]}": chatbot residue; delete it`,
    );
  },
};

/** Sentences that announce the next point instead of making it. */
export const announcing: Rule = {
  id: "announcing",
  title: "Announcing instead of saying",
  severity: "warning",
  source: "house rule, after Wikipedia: Filler phrases",
  check(doc) {
    return scan(
      doc,
      announcing,
      /\b(?:let'?s dive (?:in|into)|let'?s explore|let'?s break (?:this|it) down|let'?s take a (?:closer )?look|without further ado|in this (?:article|post|guide|blog|piece),? (?:we|I|you)(?:'ll| will)|here'?s what you need to know|now,? let'?s look at|buckle up|read on to)\b/gi,
      (m) => `"${m[0]}": make the point instead of announcing it`,
    );
  },
};

/** A closing paragraph of vague optimism. */
export const closer: Rule = {
  id: "closer",
  title: "Generic positive ending",
  severity: "warning",
  source: "Wikipedia, Signs of AI writing: Generic conclusions",
  check(doc) {
    return scan(
      doc,
      closer,
      /\b(?:exciting times (?:lie )?ahead|the future looks bright|the possibilities are endless|the sky is the limit|stay tuned|journey toward excellence|a (?:major )?step in the right direction|only time will tell|the best is yet to come|watch this space)\b/gi,
      (m) => `"${m[0]}": end on the last concrete fact instead`,
    );
  },
};

/** The stock "challenges and future outlook" section. */
export const challenges: Rule = {
  id: "challenges-section",
  title: "Formulaic challenges or outlook section",
  severity: "info",
  source: "Wikipedia, Signs of AI writing: Challenges and future prospects",
  check(doc) {
    return scan(
      doc,
      challenges,
      /(?:^#{1,6}\s+(?:challenges and (?:legacy|opportunities|the road ahead)|future (?:outlook|prospects|directions))\b|\bdespite (?:these|its|the) (?:challenges|obstacles|hurdles)\b|\bcontinues to thrive\b)/gim,
      (m) => `"${m[0].trim()}": stock section; keep only the dated facts`,
    );
  },
};

/** Claims attributed to nobody in particular, on a line with no link. */
export const vagueSource: Rule = {
  id: "vague-source",
  title: "Vague or invented source",
  severity: "warning",
  source: "Wikipedia, Signs of AI writing: Vague attributions",
  check(doc) {
    return scan(
      doc,
      vagueSource,
      /\b(?:experts (?:argue|say|believe|agree|suggest)|industry reports?|studies (?:show|have shown|suggest)|research (?:shows|suggests|has shown)|observers have (?:cited|noted)|some critics argue|it is widely (?:believed|known|accepted)|according to (?:many|some) (?:experts|analysts))\b/gi,
      (m) => `"${m[0]}": name the source or drop the claim`,
    ).filter((f) => {
      const start = doc.lineStarts[f.line - 1]!;
      const end = doc.text.indexOf("\n", start);
      const line = doc.text.slice(start, end === -1 ? undefined : end);
      return !/https?:\/\/|\]\(|\[\d+\]|\^\[/.test(line); // a link or a citation on the same line counts as a source
    });
  },
};

/** A model talking about its own training. */
export const cutoff: Rule = {
  id: "cutoff-disclaimer",
  title: "Knowledge-cutoff disclaimer",
  severity: "error",
  source: "Wikipedia, Signs of AI writing: Knowledge-cutoff disclaimers",
  check(doc) {
    return scan(
      doc,
      cutoff,
      /\b(?:as of my (?:last|latest|most recent) (?:update|training|knowledge)|my (?:knowledge|training) (?:cutoff|cut-off)|I don'?t have (?:access to )?real-time|up to my last training|based on (?:the )?available information|while specific details are (?:limited|scarce))\b/gi,
      (m) => `"${m[0]}": a model's disclaimer; state what the sources show or cut it`,
    );
  },
};
