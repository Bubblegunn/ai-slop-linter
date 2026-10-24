/**
 * The deterministic hedge check behind `--verify`: two classes of hedge that stack a second
 * softener on a claim. A hit blocks like a catalog hit, with the same exemptions (code, front
 * matter, quotes, dialogue lines) and the same inline suppression, under the rule name `hedge`.
 *
 * Class 1 is a modal verb with a hedge adverb within three words (`could potentially`,
 * `may possibly`). English is supported by Wikipedia, "Signs of AI writing" (CC BY-SA 4.0, facts
 * only), and by two MIT catalogs (blader/humanizer, conorbronsdon/avoid-ai-writing). Class 2 is an
 * evidential hedge verb with a vague-link participle in one clause (`seems to be related to`).
 * Its only independent source is the English Wikipedia page, on vague connection. The Portuguese,
 * Spanish, French and German lexicons are our translations of ordinary words, not catalog phrases.
 * A modal alone, or `seems` alone, is never a hit.
 *
 * Class 3 is an epistemic marker next to an effect predicate in one clause: a conditional or
 * subjunctive-II form of can, may, might (`could`, `podría`, `pourrait`, `könnte`, Dutch `zou`),
 * a conditional ending on an effect verb (`aceleraría`, `accélérerait`), or an appearance verb
 * (`seems to`, `parece`, `scheint zu`) followed by an effect verb (reduce, improve, speed up,
 * ease, ...). It is defined by grammatical category, not by phrase, and a sentence that names a
 * reason (a condition or cause connector, or a number with a unit) is never a hit: that is the
 * hedge-support test of SKILL.md. A plain present modal (`can reduce`, `puede reducir`) never hits.
 * Languages: en, es, pt, de, fr, nl. Turkish is not enabled: its `-ebil-` is the plain "can" and
 * the same form as a hedge, so no plain-modal negative can be told apart from a hit.
 */
import { exempt } from "./catalog.js";
import { UNIT_WORDS } from "./units.js";
import { position, suppressed, type Doc } from "./doc.js";

export interface HedgeHit {
  line: number;
  column: number;
  phrase: string;
}

interface Lexicon {
  modals: readonly string[];
  adverbs: readonly string[];
  /** The evidential hedge with its vague-link participle, within one clause. */
  link: RegExp;
}

const WORD = "\\p{L}";

/*
 * Class 3 grammar lists.
 * Everything from here to `scanHedge` is function words and verb stems of grammatical classes:
 * markers, appearance verbs, condition connectors and effect verbs. They are ordinary words of each
 * language, written by us. There is no independent catalog source for them: no catalog, style guide
 * or competitor lists them, and none of them is a phrase.
 */
interface Grammar {
  /** Conditional or subjunctive-II forms of the verbs for can, may, might (and Dutch `zou`). */
  markers: readonly string[];
  /** Appearance verbs (seem, appear), followed by an effect predicate. */
  appearance: readonly string[];
  /** Verbs of changing a quantity or state of the product or the user's work. */
  effect: RegExp;
  /** A conditional ending on an effect verb: a hedge on its own (Romance languages). */
  conditional?: RegExp;
  /** The condition and cause connectors: a sentence that has one names a reason. */
  connectors: RegExp;
  /**
   * Words before the marker in the same sentence that mean it is not a hedge on a claim: a negation,
   * a reporting verb ("he said it could ..."), a past or habitual adverb, or a first or second person
   * subject (a proposal, advice or a habit, not a statement about the product).
   */
  guard: RegExp;
}

const words = (alternatives: readonly string[]) => new RegExp(`(?<!${WORD})(?:${alternatives.join("|")})(?!${WORD})`, "iu");

/** Effect verbs as stems with their endings, English. A whole token must match one of them. */
const EN_EFFECT = [
  "reduc(?:e|es|ed|ing)", "improv(?:e|es|ed|ing)", "increas(?:e|es|ed|ing)", "speed(?:s|ed|ing)?", "simplif(?:y|ies|ied|ying)",
  "prevent(?:s|ed|ing)?", "help(?:s|ed|ing)?", "eas(?:e|es|ed|ing)", "lower(?:s|ed|ing)?", "cut(?:s|ting)?", "boost(?:s|ed|ing)?",
  "optimi[sz](?:e|es|ed|ing)", "shorten(?:s|ed|ing)?", "accelerat(?:e|es|ed|ing)", "enhanc(?:e|es|ed|ing)", "minimi[sz](?:e|es|ed|ing)",
  "decreas(?:e|es|ed|ing)", "mitigat(?:e|es|ed|ing)", "streamlin(?:e|es|ed|ing)", "strengthen(?:s|ed|ing)?", "avoid(?:s|ed|ing)?",
  "fix(?:es|ed|ing)?", "resolv(?:e|es|ed|ing)", "alleviat(?:e|es|ed|ing)",
];

/** Effect verbs as infinitives. The trunk (infinitive without its last two letters) plus a verb ending matches a form. */
const ES_EFFECT = ["reducir", "mejorar", "aumentar", "acelerar", "simplificar", "evitar", "ayudar", "facilitar", "disminuir", "optimizar", "impulsar", "agilizar", "resolver", "minimizar", "mitigar", "acortar", "recortar", "aliviar", "fortalecer", "potenciar"];
const PT_EFFECT = ["reduzir", "melhorar", "aumentar", "acelerar", "simplificar", "evitar", "ajudar", "facilitar", "diminuir", "otimizar", "impulsionar", "agilizar", "resolver", "minimizar", "mitigar", "encurtar", "aliviar", "fortalecer", "cortar", "potencializar"];
const FR_EFFECT = ["réduire", "améliorer", "augmenter", "accélérer", "simplifier", "éviter", "aider", "faciliter", "diminuer", "optimiser", "résoudre", "minimiser", "limiter", "raccourcir", "renforcer", "alléger", "empêcher", "soulager", "atténuer", "fluidifier"];
/** German and Dutch effect verbs as stems; a stem plus up to five letters of ending is one form. */
const DE_EFFECT = ["reduzier", "verbesser", "erhöh", "beschleunig", "vereinfach", "verhinder", "helf", "hilf", "erleichter", "senk", "verkürz", "steiger", "optimier", "verringer", "vermeid", "entlast", "beheb", "behob", "mildern", "verkleiner"];
const NL_EFFECT = ["verminder", "verbeter", "verhoog", "versnel", "vereenvoudig", "voorkom", "help", "verlicht", "verlaag", "verkort", "optimaliseer", "versterk", "beperk", "verklein", "vergemakkelijk", "verhelp", "verscherp", "stroomlijn"];

const trunk = (infinitive: string) => infinitive.slice(0, -2);
const romanceEffect = (infinitives: readonly string[]) => new RegExp(`^(?:${infinitives.map(trunk).join("|")})\\p{L}{1,7}$`, "u");
/** Conditional of a Romance infinitive: the infinitive (French `-re` loses its `e`) plus the ending. */
const romanceConditional = (infinitives: readonly string[], endings: string, drop = false) =>
  new RegExp(`^(?:${infinitives.map((i) => (drop ? i.replace(/re$/, "r") : i)).join("|")})(?:${endings})$`, "u");
const stemEffect = (stems: readonly string[]) => new RegExp(`^(?:${stems.join("|")})\\p{L}{0,5}$`, "u");

/** The effect-verb lists per language, as written above; the tests count them. */
export const EFFECT_VERBS: Readonly<Record<string, readonly string[]>> = { en: EN_EFFECT, es: ES_EFFECT, pt: PT_EFFECT, fr: FR_EFFECT, de: DE_EFFECT, nl: NL_EFFECT };

const GRAMMAR: Readonly<Record<string, Grammar>> = {
  en: {
    markers: ["could", "might"],
    appearance: ["seem", "seems", "seemed", "appear", "appears", "appeared"],
    effect: new RegExp(`^(?:${EN_EFFECT.join("|")})$`, "u"),
    connectors: words(["because", "if", "unless", "when", "whenever", "depending", "provided", "assuming", "once", "given", "since", "whether", "as long as", "due to", "in case"]),
    guard: words(["n['’]t", "not", "never", "no", "nothing", "nobody", "neither", "nor", "cannot", "said", "says", "told", "thought", "think", "believed?", "claimed?", "expected", "hoped?", "formerly", "i", "we", "you", "he", "she", "my", "our", "i['’]d", "we['’]d", "you['’]d"]),
  },
  es: {
    markers: ["podría", "podrían"],
    appearance: ["parece", "parecen", "parecía", "parecían"],
    effect: romanceEffect(ES_EFFECT),
    conditional: romanceConditional(ES_EFFECT, "ía|ían"),
    connectors: words(["porque", "si", "cuando", "siempre que", "siempre y cuando", "según", "dependiendo", "salvo", "a menos que", "ya que", "puesto que", "debido a", "en caso de", "mientras", "con tal de"]),
    guard: words(["no", "nunca", "nada", "nadie", "ni", "jamás", "tampoco", "dijo", "dijeron", "dice", "dicen", "pensó", "pensaba", "creía", "creyó", "según", "antes", "antaño", "yo", "tú", "vos", "nosotros", "nosotras", "usted", "ustedes"]),
  },
  pt: {
    markers: ["poderia", "poderiam"],
    appearance: ["parece", "parecem", "parecia", "pareciam"],
    effect: romanceEffect(PT_EFFECT),
    conditional: romanceConditional(PT_EFFECT, "ia|iam"),
    connectors: words(["porque", "pois", "quando", "caso", "desde que", "dependendo", "conforme", "a menos que", "a não ser que", "já que", "devido a", "sempre que", "enquanto", `se(?=\\s+(?:o|a|os|as|um|uma|não|nao|for|forem|houver|estiver|estiverem|tiver|ele|ela|eles|elas|você|voce|isso|esse|essa)(?!${WORD}))`]),
    guard: words(["não", "nao", "nunca", "nada", "ninguém", "nem", "jamais", "disse", "disseram", "diz", "dizem", "pensou", "achava", "acreditava", "segundo", "antes", "antigamente", "eu", "tu", "você", "voce", "nós", "vocês", "voces"]),
  },
  fr: {
    markers: ["pourrait", "pourraient"],
    appearance: ["semble", "semblent", "semblait", "semblaient", "paraît", "paraissent"],
    effect: romanceEffect(FR_EFFECT),
    conditional: romanceConditional(FR_EFFECT, "ait|aient", true),
    connectors: words(["parce que", "car", "si", "s['’]ils?", "quand", "lorsque", "à condition", "selon", "en fonction", "sauf si", "à moins que", "tant que", "puisque", "dès que", "grâce à", "du fait", "étant donné"]),
    guard: words(["ne", "n['’]", "pas", "jamais", "rien", "personne", "aucun", "aucune", "dit", "disait", "ont dit", "pensait", "croyait", "selon", "autrefois", "avant", "je", "j['’]", "tu", "nous", "vous"]),
  },
  de: {
    markers: ["könnte", "könnten", "dürfte", "dürften"],
    appearance: ["scheint", "scheinen", "schien", "schienen"],
    effect: stemEffect(DE_EFFECT),
    connectors: words(["weil", "denn", "wenn", "falls", "sofern", "solange", "sobald", "abhängig", "je nach", "aufgrund", "wegen", "dank", "vorausgesetzt", "nachdem", "ob"]),
    guard: words(["nicht", "kein\\p{L}*", "nie", "niemals", "nichts", "niemand", "sagte", "sagt", "sagten", "meinte", "dachte", "glaubte", "laut", "früher", "damals", "ich", "du", "wir", "ihr"]),
  },
  nl: {
    markers: ["zou", "zouden"],
    appearance: ["lijkt", "lijken", "leek", "leken"],
    effect: stemEffect(NL_EFFECT),
    connectors: words(["omdat", "want", "als", "wanneer", "tenzij", "indien", "afhankelijk", "zodra", "mits", "doordat", "zolang", "aangezien", "dankzij", "vanwege"]),
    guard: words(["niet", "geen", "nooit", "niets", "niemand", "zei", "zeiden", "zegt", "dacht", "vond", "geloofde", "volgens", "vroeger", "toen", "ik", "jij", "je", "wij", "we", "jullie", "u"]),
  },
};


const MEASURED = new RegExp(
  `(?<![${WORD}\\d])\\d(?:[.,\\d]*\\d)?\\s?(?:${UNIT_WORDS})(?![${WORD}\\d])`,
  "iu",
);

/** Where one sentence ends and the next begins: a full stop, a blank line, a list item or a table row. */
export const SENTENCE_BREAK = /(?<=[.!?])\s+|\n[ \t]*\n|\n(?=[ \t]*(?:[-*+]|\d+[.)])\s)|\n(?=[ \t]*\|)/g;
/** How many words after a marker, or after an appearance verb, an effect verb may stand. */
const EFFECT_REACH = 6;
const APPEARANCE_REACH = 5;
/** German and Dutch put the verb last, so the effect verb can stand further from the marker. */
const VERB_FINAL = new Set(["de", "nl"]);
const EFFECT_REACH_VERB_FINAL = 9;

const LEXICONS: Readonly<Record<string, Lexicon>> = {
  en: {
    modals: ["could", "may", "might"],
    adverbs: ["potentially", "possibly", "arguably"],
    link: new RegExp(`(?<!${WORD})(?:seems?|seemed|appears?|appeared)\\s+to\\s+be\\s+(?:${WORD}+ly\\s+)?(?:related|linked|associated)\\s+(?:to|with)(?!${WORD})`, "giu"),
  },
  pt: {
    modals: ["poderia", "poderiam", "pode", "podem"],
    adverbs: ["potencialmente", "eventualmente"],
    link: new RegExp(`(?<!${WORD})parece(?:m)?\\s+(?:estar|ser)\\s+(?:${WORD}+mente\\s+)?(?:relacionad|ligad|associad)[ao]s?(?!${WORD})`, "giu"),
  },
  es: {
    modals: ["podría", "podrían", "puede", "pueden"],
    adverbs: ["potencialmente", "eventualmente"],
    link: new RegExp(`(?<!${WORD})parece(?:n)?\\s+(?:estar|ser)\\s+(?:${WORD}+mente\\s+)?(?:relacionad|vinculad|asociad)[ao]s?(?!${WORD})`, "giu"),
  },
  fr: {
    modals: ["pourrait", "pourraient", "peut", "peuvent"],
    adverbs: ["potentiellement", "éventuellement"],
    link: new RegExp(`(?<!${WORD})semble(?:nt)?\\s+(?:être\\s+)?(?:${WORD}+ment\\s+)?(?:lié|associé)(?:e|s|es)?(?!${WORD})`, "giu"),
  },
  de: {
    modals: ["könnte", "könnten", "kann", "können"],
    adverbs: ["möglicherweise", "potenziell", "potentiell"],
    link: new RegExp(`(?<!${WORD})schein(?:t|en)\\b[^.!?;:,]{0,40}?\\szusammenzuhängen(?!${WORD})`, "giu"),
  },
};

const TOKEN = /[\p{L}\p{M}'’]+/gu;
const BOUNDARY = /[.!?;:]|\n[ \t]*\n/;
/** How many words after the modal a hedge adverb may stand. */
const REACH = 3;

/** Hedge hits in a document, in reading order. A language with no lexicon, or an unknown one, gives none. */
export function scanHedge(doc: Doc, tag: string): HedgeHit[] {
  const lang = tag.split(/[-_]/)[0]!.toLowerCase();
  const lexicon = LEXICONS[lang];
  const grammar = GRAMMAR[lang];
  if (!lexicon && !grammar) return [];
  const text = exempt(doc);
  const found: { at: number; phrase: string }[] = [];
  const tokens = [...text.matchAll(TOKEN)].map((m) => ({ word: m[0].replace(/^['’]+|['’]+$/g, "").toLowerCase(), raw: m[0].replace(/^['’]+|['’]+$/g, ""), start: m.index!, end: m.index! + m[0].length }));
  if (lexicon) {
    for (let i = 0; i < tokens.length; i++) {
      const modal = tokens[i]!;
      // A capitalised "May" is a month or a name; other modals match in any case.
      if (!lexicon.modals.includes(modal.word) || modal.raw === "May") continue;
      for (let j = i + 1; j <= i + REACH && j < tokens.length; j++) {
        const next = tokens[j]!;
        if (BOUNDARY.test(text.slice(tokens[j - 1]!.end, next.start))) break;
        if (lexicon.adverbs.includes(next.word)) {
          found.push({ at: modal.start, phrase: text.slice(modal.start, next.end) });
          break;
        }
      }
    }
    for (const m of text.matchAll(lexicon.link)) found.push({ at: m.index!, phrase: m[0] });
  }
  if (grammar) found.push(...epistemicHits(text, tokens, grammar, new Set(found.map((f) => f.at)), VERB_FINAL.has(lang) ? EFFECT_REACH_VERB_FINAL : EFFECT_REACH));
  found.sort((a, b) => a.at - b.at);
  const hits: HedgeHit[] = [];
  for (const { at, phrase } of found) {
    const { line, column } = position(doc, at);
    if (suppressed(doc, { rule: "hedge", severity: "error", line, column, endLine: line, endColumn: column, excerpt: "", message: "" })) continue;
    hits.push({ line, column, phrase });
  }
  return hits;
}

interface Token {
  word: string;
  raw: string;
  start: number;
  end: number;
}

/** Class 3: a marker, a conditional effect verb or an appearance verb next to an effect predicate, in a sentence with no stated reason. */
function epistemicHits(text: string, tokens: Token[], g: Grammar, taken: ReadonlySet<number>, effectReach: number): { at: number; phrase: string }[] {
  const breaks = [0, ...[...text.matchAll(SENTENCE_BREAK)].map((m) => m.index! + m[0].length)];
  const sentenceAt = (at: number) => {
    let lo = 0;
    for (let k = 0; k < breaks.length && breaks[k]! <= at; k++) lo = breaks[k]!;
    const next = breaks.find((b) => b > at) ?? text.length;
    return { text: text.slice(lo, next), before: text.slice(lo, at) };
  };
  const out: { at: number; phrase: string }[] = [];
  const reach = (from: number, limit: number): Token | undefined => {
    for (let j = from + 1; j <= from + limit && j < tokens.length; j++) {
      if (BOUNDARY.test(text.slice(tokens[j - 1]!.end, tokens[j]!.start))) return undefined;
      if (g.effect.test(tokens[j]!.word)) return tokens[j]!;
    }
    return undefined;
  };
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]!;
    if (taken.has(t.start)) continue;
    let end: Token | undefined;
    if (g.markers.includes(t.word)) {
      // "you could cut the log level" is advice, not a claim about an effect.
      if (t.word === "could" && tokens[i - 1]?.word === "you") continue;
      end = reach(i, effectReach);
    } else if (g.appearance.includes(t.word)) end = reach(i, APPEARANCE_REACH);
    else if (g.conditional?.test(t.word)) end = t;
    if (!end) continue;
    const sentence = sentenceAt(t.start);
    if (/\?\s*$/.test(sentence.text) || g.connectors.test(sentence.text) || MEASURED.test(sentence.text) || g.guard.test(sentence.before)) continue;
    out.push({ at: t.start, phrase: text.slice(t.start, end.end) });
  }
  return out;
}
