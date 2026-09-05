/**
 * A document prepared for the rules: the original text, the same text with
 * fenced code, inline code, URLs, front matter and HTML comments blanked out
 * (same length, so offsets line up), line starts for offset to line/column,
 * and the inline ignore directives.
 */
export interface Doc {
  path: string;
  text: string;
  /** Same length as `text`; masked regions are spaces, newlines are kept. */
  masked: string;
  lineStarts: number[];
  words: number;
  /** Line numbers (1-based) whose findings are ignored entirely. */
  ignoredLines: Set<number>;
  /** Rule ids ignored for the whole file from the directive's line onward, with that line. */
  ignoredRules: Map<string, number>;
  /** Rule ids ignored on a specific line: "line:rule". */
  ignoredLineRules: Set<string>;
}

export interface Finding {
  rule: string;
  severity: Severity;
  line: number;
  column: number;
  excerpt: string;
  message: string;
  fix?: Fix;
}

export type Severity = "error" | "warning" | "info";

export interface Fix {
  start: number;
  end: number;
  replacement: string;
}

export interface Rule {
  id: string;
  title: string;
  severity: Severity;
  /** Where the pattern comes from: a section of Wikipedia's "Signs of AI writing" or "house". */
  source: string;
  /** Why the pattern reads as machine-made, in a sentence or two. Printed by --explain. */
  why: string;
  /** A line that trips the rule and the same line rewritten. Both are checked by the tests. */
  example: { before: string; after: string };
  /** The case where a maintainer should switch this rule off rather than obey it. */
  ignoreWhen: string;
  check(doc: Doc): Finding[];
}

const blank = (s: string) => s.replace(/[^\n]/g, " ");

/**
 * Spans `[start, end)` of `open`...`close` pairs found by index search, so a file
 * with thousands of unclosed openers costs one pass instead of one scan per opener
 * (the regex form was quadratic on crafted input). A `stop` character between the
 * two ends the candidate without a match and the search resumes after the opener;
 * an `opener` test rejects a candidate at its first character.
 */
function delimited(s: string, open: string, close: string, stop?: RegExp, opener?: RegExp): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  let from = 0;
  for (;;) {
    const start = s.indexOf(open, from);
    if (start < 0) break;
    if (opener && !opener.test(s.slice(start, start + 3))) {
      from = start + 1;
      continue;
    }
    const end = s.indexOf(close, start + open.length);
    if (end < 0) break;
    const inner = s.slice(start + open.length, end);
    if (stop && stop.test(inner)) {
      from = start + open.length;
      continue;
    }
    out.push([start, end + close.length]);
    from = end + close.length;
  }
  return out;
}

/** Mask a region of `masked` in place (string surgery keeps the length). */
function mask(masked: string, start: number, end: number): string {
  return masked.slice(0, start) + blank(masked.slice(start, end)) + masked.slice(end);
}

export function prepare(path: string, text: string): Doc {
  let masked = text;
  // Front matter at the very top.
  const fm = /^---\r?\n[\s\S]*?\r?\n---\r?\n/.exec(text);
  if (fm) masked = mask(masked, 0, fm[0].length);
  // Fenced code blocks (``` or ~~~).
  for (const m of text.matchAll(/^(```|~~~)[^\n]*\n[\s\S]*?^\1[ \t]*$/gm)) {
    masked = mask(masked, m.index!, m.index! + m[0].length);
  }
  // HTML comments (kept readable for the directive scan below, masked for rules).
  for (const [s, e] of delimited(text, "<!--", "-->")) masked = mask(masked, s, e);
  // Inline code.
  for (const m of masked.matchAll(/`[^`\n]*`/g)) masked = mask(masked, m.index!, m.index! + m[0].length);
  // Markdown link targets and bare URLs.
  for (const [s, e] of delimited(masked, "](", ")", /\s/)) masked = mask(masked, s + 2, e - 1);
  for (const m of masked.matchAll(/https?:\/\/[^\s)>\]]+/g)) masked = mask(masked, m.index!, m.index! + m[0].length);
  // HTML tags.
  for (const [s, e] of delimited(masked, "<", ">", /\n/, /^<\/?[a-zA-Z]/)) masked = mask(masked, s, e);

  const lineStarts = [0];
  for (let i = 0; i < text.length; i++) if (text[i] === "\n") lineStarts.push(i + 1);

  const ignoredLines = new Set<number>();
  const ignoredRules = new Map<string, number>();
  const ignoredLineRules = new Set<string>();
  const lines = text.split("\n");
  lines.forEach((line, i) => {
    const next = /<!--\s*slop-ignore-next-line(?:\s+([\w,\s-]+?))?\s*-->/.exec(line);
    if (next) {
      const rules = next[1]?.split(/[,\s]+/).filter(Boolean);
      if (rules?.length) for (const r of rules) ignoredLineRules.add(`${i + 2}:${r}`);
      else ignoredLines.add(i + 2);
    }
    const file = /<!--\s*slop-ignore\s+([\w,\s-]+?)\s*-->/.exec(line);
    if (file && !/slop-ignore-next-line/.test(line)) {
      for (const r of file[1]!.split(/[,\s]+/).filter(Boolean)) if (!ignoredRules.has(r)) ignoredRules.set(r, i + 1);
    }
  });

  const words = (masked.match(/[A-Za-z0-9'’]+/g) ?? []).length;
  return { path, text, masked, lineStarts, words, ignoredLines, ignoredRules, ignoredLineRules };
}

/** 1-based line and column for an absolute offset. */
export function position(doc: Doc, offset: number): { line: number; column: number } {
  let lo = 0;
  let hi = doc.lineStarts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (doc.lineStarts[mid]! <= offset) lo = mid;
    else hi = mid - 1;
  }
  return { line: lo + 1, column: offset - doc.lineStarts[lo]! + 1 };
}

/** The original text of the line containing `offset`, trimmed to a readable excerpt around it. */
export function excerptAt(doc: Doc, offset: number, length: number): string {
  const { line } = position(doc, offset);
  const start = doc.lineStarts[line - 1]!;
  const end = doc.text.indexOf("\n", start);
  const lineText = doc.text.slice(start, end === -1 ? undefined : end);
  if (lineText.length <= 100) return lineText.trim();
  const col = offset - start;
  const from = Math.max(0, col - 40);
  const to = Math.min(lineText.length, col + length + 40);
  return `${from > 0 ? "…" : ""}${lineText.slice(from, to).trim()}${to < lineText.length ? "…" : ""}`;
}

/** Run a regex over the masked text and turn every match into a finding. */
export function scan(
  doc: Doc,
  rule: Pick<Rule, "id" | "severity">,
  pattern: RegExp,
  message: (m: RegExpMatchArray) => string,
  fix?: (m: RegExpMatchArray) => string | null,
): Finding[] {
  const out: Finding[] = [];
  const re = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g");
  for (const m of doc.masked.matchAll(re)) {
    const start = m.index!;
    const { line, column } = position(doc, start);
    const finding: Finding = { rule: rule.id, severity: rule.severity, line, column, excerpt: excerptAt(doc, start, m[0].length), message: message(m) };
    if (fix) {
      const replacement = fix(m);
      if (replacement !== null) finding.fix = { start, end: start + m[0].length, replacement };
    }
    out.push(finding);
  }
  return out;
}

/** Whether a finding is suppressed by an inline directive. */
export function suppressed(doc: Doc, f: Finding): boolean {
  if (doc.ignoredLines.has(f.line)) return true;
  if (doc.ignoredLineRules.has(`${f.line}:${f.rule}`)) return true;
  const from = doc.ignoredRules.get(f.rule);
  return from !== undefined && f.line >= from;
}
