import { prepare, suppressed } from "./doc.js";
import type { Doc, Finding, Fix, Rule, Severity } from "./doc.js";
import { dashes } from "./rules/dashes.js";
import { notXButY, triad, reveal, ingTail, inflated } from "./rules/constructions.js";
import { aiVocabulary, sales, filler } from "./rules/vocabulary.js";
import { chatbot, announcing, closer, challenges, vagueSource, cutoff } from "./rules/residue.js";
import { referenceMarkup } from "./rules/reference-markup.js";
import { frRules } from "./rules/fr.js";
import { boldLabel, titleCase, emoji, curlyQuotes, hyphenDensity, invisibleCharacter } from "./rules/formatting.js";
import { PARAGRAPH_DETECT, detectLanguage, frontMatterLanguage, splitParagraphs } from "./lang.js";

export type { Doc, Finding, Fix, Rule, Severity } from "./doc.js";
export { prepare, countWords } from "./doc.js";
export { compareFacts } from "./compare.js";
export type { Fact, FactKind } from "./compare.js";

/** Every rule, in the order findings are reported. */
export const rules: Rule[] = [
  dashes,
  chatbot,
  cutoff,
  notXButY,
  triad,
  reveal,
  ingTail,
  inflated,
  aiVocabulary,
  sales,
  vagueSource,
  announcing,
  closer,
  boldLabel,
  emoji,
  filler,
  curlyQuotes,
  titleCase,
  challenges,
  hyphenDensity,
  referenceMarkup,
  invisibleCharacter,
];

/**
 * Rule sets for languages other than English, keyed by the language tag used to switch them
 * on. A pack switches on from the language a file is written in: a file declared, or detected,
 * in that language runs the pack on the whole text, and an English file runs it on any
 * paragraph detected as that language. A pack rule ships only if it passes the shipping limit
 * in `bench/packs-lib.mjs`, which `test/packs.test.mjs` enforces for every registered pack.
 *
 * A pack is a file under `src/rules/<lang>.ts` exporting its rules, registered here. Every
 * rule in it carries an id prefixed with its language, so `zh/chatbot` and never `chatbot`,
 * and a source, the same requirement the English rules meet. Nothing loads a pack unless the
 * language of the text is that language, so an English-only repository never sees a finding
 * from one.
 */
export const languageRules: Record<string, Rule[]> = {
  fr: frRules,
};

/** Every prose rule that can fire anywhere: the English rules, then each language pack's. */
export const allRules = (): Rule[] => [...rules, ...Object.values(languageRules).flat()];

/**
 * The English rules, plus the packs for any language asked for. Throws on a language with no
 * pack rather than silently linting without it, because a repository that configured `zh` and
 * got no Chinese findings would read that as a clean file. `lintDoc` switches a pack on from the
 * file's own language without going through this function, so it does not throw there.
 */
export function rulesFor(languages: readonly string[] = []): Rule[] {
  const chosen: Rule[] = [...rules];
  for (const lang of languages) {
    const pack = languageRules[lang];
    if (!pack) {
      const known = Object.keys(languageRules);
      throw new Error(`no rule pack for "${lang}" (${known.length ? `have: ${known.join(", ")}` : "none exist yet; see CONTRIBUTING.md"})`);
    }
    chosen.push(...pack);
  }
  return chosen;
}

/**
 * What a pack has to satisfy before it is registered. Called by the pack's own test, so a
 * contributor sees the requirement fail rather than reading it in a document.
 */
export function checkLanguagePack(lang: string, pack: readonly Rule[]): string[] {
  const problems: string[] = [];
  if (pack.length === 0) problems.push(`${lang}: the pack is empty`);
  for (const rule of pack) {
    if (!rule.id.startsWith(`${lang}/`)) problems.push(`${rule.id}: a rule in the ${lang} pack needs the id ${lang}/${rule.id}`);
    if (!rule.source?.trim()) problems.push(`${rule.id}: every rule carries a source`);
    if (rules.some((r) => r.id === rule.id)) problems.push(`${rule.id}: an English rule already has this id`);
  }
  return problems;
}

export const WEIGHTS: Record<Severity, number> = { error: 3, warning: 1, info: 0.3 };

/** Grade thresholds on the weighted findings-per-thousand-words score. */
export const GRADES: [string, number][] = [
  ["A", 3],
  ["B", 8],
  ["C", 15],
  ["D", 30],
];

export interface LintOptions {
  ignore?: string[];
  /** When set, only these rule ids run; `ignore` still applies on top. */
  only?: string[];
  /** Language packs to switch on, by tag. English is always on. */
  languages?: readonly string[];
  /**
   * The language this document's prose is written in, as a BCP 47 tag. When it is not
   * English, rules marked `englishOnly` stand down, because their evidence is English and
   * their pattern is ordinary writing elsewhere. Unset, or `"auto"`, the language is worked
   * out from the document: its front matter `lang` key first, then the prose itself. A
   * declared tag always wins over detection.
   */
  language?: string;
  /**
   * Words below which the document is not graded. Defaults to GRADE_FLOOR. A caller that
   * only ever sees short text, the commit-message paths, passes 0, because there the
   * question is whether a message carries a tell, not how dense the tells are.
   */
  floor?: number;
}

/**
 * A document shorter than this is not graded. Below it the denominator is small enough
 * that one finding decides the grade, so the letter says more about the length than about
 * the writing. A 12-word fragment with one em dash used to score 60 and print an F.
 */
export const GRADE_FLOOR = 50;

/** True for the default and for every English tag, "en", "en-GB", "en_US". */
export const isEnglish = (tag: string | undefined): boolean => !tag || tag.toLowerCase().split(/[-_]/)[0] === "en";

export type LanguageSource = "declared" | "front-matter" | "detected" | "default";

/**
 * The language a document is written in. A declared tag is taken as given (`auto` and an empty
 * value mean undeclared). Otherwise the front matter, then detection on the prose with code and
 * front matter already blanked, then English by default.
 */
export function resolveLanguage(doc: Doc, declared: string | undefined): { tag: string; source: LanguageSource } {
  if (declared !== undefined && declared !== "" && declared.toLowerCase() !== "auto") return { tag: declared, source: "declared" };
  const fromFrontMatter = frontMatterLanguage(doc.text);
  if (fromFrontMatter !== null) return { tag: fromFrontMatter, source: "front-matter" };
  const guess = detectLanguage(doc.masked);
  if (guess.tag !== null) return { tag: guess.tag, source: "detected" };
  return { tag: "en", source: "default" };
}

/** A paragraph confidently written in one language, as character offsets into the masked text. */
interface ParagraphLanguage {
  tag: string;
  start: number;
  end: number;
}

/**
 * The paragraphs of a document that are confidently written in a language. A paragraph has to
 * reach 12 words before it is judged at all, and a language has to win on three distinct function
 * words and three hits (PARAGRAPH_DETECT), so short ones and one stray word are left out. The
 * result is in document order and its ranges do not overlap, which `inParagraphs` relies on.
 */
function paragraphLanguages(doc: Doc): ParagraphLanguage[] {
  const out: ParagraphLanguage[] = [];
  for (const p of splitParagraphs(doc.masked)) {
    const guess = detectLanguage(p.text, PARAGRAPH_DETECT);
    if (guess.tag !== null) out.push({ tag: guess.tag, start: p.start, end: p.end });
  }
  return out;
}

/** The primary subtag of a tag, lower case: `fr-CA` gives `fr`, so a regional tag finds its pack. */
const primaryTag = (tag: string): string => tag.toLowerCase().split(/[-_]/)[0]!;

/**
 * Whether a character offset falls inside one of the given paragraphs: a binary search over
 * their sorted, non-overlapping ranges, so a file with thousands of findings does not rescan
 * every paragraph for each one.
 */
function inParagraphs(paragraphs: readonly ParagraphLanguage[], offset: number): boolean {
  let low = 0;
  let high = paragraphs.length - 1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    const p = paragraphs[mid]!;
    if (offset < p.start) high = mid - 1;
    else if (offset >= p.end) low = mid + 1;
    else return true;
  }
  return false;
}

export interface LintResult {
  path: string;
  words: number;
  findings: Finding[];
  /**
   * Rules that did not run because the declared language is not English. Reported so that a
   * quiet result is never mistaken for a clean one.
   */
  stoodDown: string[];
  /** Weighted findings per 1,000 words, or null when the document is under GRADE_FLOOR words. */
  score: number | null;
  /** The language the rules ran as: the declared tag, or the one worked out for this file. */
  language: string;
  /** Where `language` came from. "default" means nothing declared, nothing detected, English assumed. */
  languageSource: LanguageSource;
  /** Null when the document is too short to grade; the findings still stand. */
  grade: string | null;
  errors: number;
}

export function gradeFor(score: number): string {
  for (const [grade, limit] of GRADES) if (score < limit) return grade;
  return "F";
}

export function lintText(path: string, text: string, options: LintOptions = {}): LintResult {
  const doc = prepare(path, text);
  return lintDoc(doc, options);
}

export function lintDoc(doc: Doc, options: LintOptions = {}): LintResult {
  const ignore = new Set(options.ignore ?? []);
  const only = options.only?.length ? new Set(options.only) : undefined;
  const { tag: language, source: languageSource } = resolveLanguage(doc, options.language);
  const english = isEnglish(language);
  // A declared tag is taken as given, so no per-paragraph guess is applied to it.
  const declared = languageSource === "declared";
  const findings: Finding[] = [];
  const stoodDown: string[] = [];
  let paragraphs: ParagraphLanguage[] | undefined;
  let foreign: ParagraphLanguage[] | undefined;
  const offsetOf = (f: Finding): number => doc.lineStarts[f.line - 1]! + f.column - 1;

  // The rules that run on the whole file: English, the packs asked for, and the pack of the
  // file's own language, which switches on from that language with no declaration needed.
  const wholeFile = rulesFor(options.languages);
  const ids = new Set(wholeFile.map((r) => r.id));
  const ownPack = english ? undefined : languageRules[primaryTag(language)];
  for (const rule of ownPack ?? []) {
    if (ids.has(rule.id)) continue;
    ids.add(rule.id);
    wholeFile.push(rule);
  }

  for (const rule of wholeFile) {
    if (only && !only.has(rule.id)) continue;
    if (ignore.has(rule.id)) continue;
    if (rule.englishOnly && !english) {
      stoodDown.push(rule.id);
      continue;
    }
    for (const f of rule.check(doc)) {
      if (suppressed(doc, f)) continue;
      // Inside an English file, a finding in a paragraph written in another language is not a
      // finding: that dash is that language's punctuation.
      if (rule.englishOnly && !declared) {
        paragraphs ??= paragraphLanguages(doc);
        foreign ??= paragraphs.filter((p) => !isEnglish(p.tag));
        if (inParagraphs(foreign, offsetOf(f))) continue;
      }
      findings.push(f);
    }
  }

  // A paragraph written in a language other than the file's own runs the pack of that language,
  // and only on that paragraph. A pack already run on the whole file is not run a second time.
  // Skipped outright while no non-English pack is registered, so English-only use pays nothing.
  if (!declared && Object.keys(languageRules).some((tag) => !isEnglish(tag))) {
    paragraphs ??= paragraphLanguages(doc);
    const fileTag = primaryTag(language);
    for (const tag of new Set(paragraphs.map((p) => p.tag))) {
      if (isEnglish(tag) || tag === fileTag) continue;
      for (const rule of languageRules[tag] ?? []) {
        if (ids.has(rule.id) || (only && !only.has(rule.id)) || ignore.has(rule.id)) continue;
        const own = paragraphs.filter((p) => p.tag === tag);
        for (const f of rule.check(doc)) {
          if (suppressed(doc, f)) continue;
          if (inParagraphs(own, offsetOf(f))) findings.push(f);
        }
      }
    }
  }
  findings.sort((a, b) => a.line - b.line || a.column - b.column);
  const weighted = findings.reduce((s, f) => s + WEIGHTS[f.severity], 0);
  // Two separate things: the denominator is clamped so a short text cannot explode it,
  // and a document under the floor is not graded at all.
  const denominator = Math.max(doc.words, GRADE_FLOOR) / 1000;
  const floor = options.floor ?? GRADE_FLOOR;
  const score = doc.words < floor ? null : Math.round((weighted / denominator) * 10) / 10;
  return { path: doc.path, words: doc.words, findings, stoodDown, score, grade: score === null ? null : gradeFor(score), errors: findings.filter((f) => f.severity === "error").length, language, languageSource };
}

/** Apply every safe fix once. Overlapping fixes keep the earlier one. */
export function applyFixes(text: string, findings: Finding[]): { text: string; applied: number } {
  const fixes: Fix[] = findings.filter((f): f is Finding & { fix: Fix } => !!f.fix).map((f) => f.fix).sort((a, b) => a.start - b.start);
  let out = "";
  let cursor = 0;
  let applied = 0;
  for (const fix of fixes) {
    if (fix.start < cursor) continue;
    out += text.slice(cursor, fix.start) + fix.replacement;
    cursor = fix.end;
    applied++;
  }
  out += text.slice(cursor);
  return { text: out, applied };
}

/** Lint, fix, and lint again so the returned findings describe the fixed text. */
export function fixText(path: string, text: string, options: LintOptions = {}): { text: string; applied: number; result: LintResult } {
  let current = text;
  let applied = 0;
  // Two passes: a fix can expose a second fixable pattern (a dash next to a curly quote).
  for (let pass = 0; pass < 2; pass++) {
    const result = lintText(path, current, options);
    const step = applyFixes(current, result.findings);
    applied += step.applied;
    current = step.text;
    if (step.applied === 0) break;
  }
  return { text: current, applied, result: lintText(path, current, options) };
}
