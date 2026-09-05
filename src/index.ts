import { prepare, suppressed } from "./doc.js";
import type { Doc, Finding, Fix, Rule, Severity } from "./doc.js";
import { dashes } from "./rules/dashes.js";
import { notXButY, triad, reveal, ingTail, inflated } from "./rules/constructions.js";
import { aiVocabulary, sales, filler } from "./rules/vocabulary.js";
import { chatbot, announcing, closer, challenges, vagueSource, cutoff } from "./rules/residue.js";
import { boldLabel, titleCase, emoji, curlyQuotes, hyphenDensity } from "./rules/formatting.js";

export type { Doc, Finding, Fix, Rule, Severity } from "./doc.js";
export { prepare } from "./doc.js";

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
];

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
}

export interface LintResult {
  path: string;
  words: number;
  findings: Finding[];
  /** Weighted findings per 1,000 words (a 50-word floor keeps short texts from exploding). */
  score: number;
  grade: string;
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
  const findings: Finding[] = [];
  for (const rule of rules) {
    if (ignore.has(rule.id)) continue;
    for (const f of rule.check(doc)) if (!suppressed(doc, f)) findings.push(f);
  }
  findings.sort((a, b) => a.line - b.line || a.column - b.column);
  const weighted = findings.reduce((s, f) => s + WEIGHTS[f.severity], 0);
  const denominator = Math.max(doc.words, 50) / 1000;
  const score = Math.round((weighted / denominator) * 10) / 10;
  return { path: doc.path, words: doc.words, findings, score, grade: gradeFor(score), errors: findings.filter((f) => f.severity === "error").length };
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
