#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, relative, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { lintText, fixText, rules } from "./index.js";
import type { LintResult, Finding } from "./index.js";
import { expand, skippedByDefault } from "./glob.js";

const HELP = `usage: slop [options] [file|glob|-]...
       slop --commit            lint the last commit message
       slop --commit-msg <file> lint the message being written (what a commit-msg hook receives)
       slop --pr <number>       lint a pull request description (needs gh)
       slop --rules             list the rules

Lints text for the patterns that mark writing as machine-made. It does not guess who
wrote it; it shows the tells, with line numbers, and fixes the safe ones.

  --fix                 apply safe fixes in place (dashes, curly quotes, filler phrases)
  --format <f>          text (default), json, or github (workflow annotations)
  --ignore <rule,...>   skip rules by id
  --max-score <n>       fail when a file's score is above n (default from .slop.json, else 10)
  --warn                never exit 1; report only
  --cwd <dir>           working directory (default: current)
  -h, --help            this text

With no targets, lints the globs in .slop.json ("include", default ["**/*.md"]) under --cwd.
Exit 1 on any error-severity finding or a score above --max-score, 2 on usage errors.
Inline: <!-- slop-ignore-next-line [rule] --> and <!-- slop-ignore rule-a, rule-b --> (rest of file).`;

interface Options {
  targets: string[];
  commit: boolean;
  commitMsg?: string;
  pr?: string;
  fix: boolean;
  format: "text" | "json" | "github";
  ignore: string[];
  maxScore: number | undefined;
  warn: boolean;
  cwd: string;
  listRules: boolean;
}

export function parse(argv: string[]): Options {
  const o: Options = { targets: [], commit: false, fix: false, format: "text", ignore: [], maxScore: undefined, warn: false, cwd: process.cwd(), listRules: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    const next = () => {
      const v = argv[++i];
      if (v === undefined) throw new Error(`${a} needs a value`);
      return v;
    };
    if (a === "--commit") o.commit = true;
    else if (a === "--commit-msg") o.commitMsg = next();
    else if (a === "--pr") o.pr = next();
    else if (a === "--fix") o.fix = true;
    else if (a === "--format") {
      const f = next();
      if (f !== "text" && f !== "json" && f !== "github") throw new Error(`--format must be text, json or github`);
      o.format = f;
    } else if (a === "--ignore") o.ignore.push(...next().split(",").map((s) => s.trim()).filter(Boolean));
    else if (a === "--max-score") o.maxScore = Number(next());
    else if (a === "--warn") o.warn = true;
    else if (a === "--cwd") o.cwd = resolve(next());
    else if (a === "--rules") o.listRules = true;
    else if (a === "-h" || a === "--help") {
      console.log(HELP);
      process.exit(0);
    } else if (a.startsWith("--")) throw new Error(`unknown option ${a} (see --help)`);
    else o.targets.push(a);
  }
  return o;
}

interface Config {
  ignore?: string[];
  maxScore?: number;
  include?: string[];
}

function loadConfig(cwd: string): Config {
  const file = resolve(cwd, ".slop.json");
  if (!existsSync(file)) return {};
  try {
    return JSON.parse(readFileSync(file, "utf8")) as Config;
  } catch (err) {
    throw new Error(`.slop.json is not valid JSON: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/** Resolve targets to [displayPath, absolutePath|null for virtual inputs, text]. */
function collect(o: Options, config: Config): { name: string; file: string | null; text: string }[] {
  const inputs: { name: string; file: string | null; text: string }[] = [];
  if (o.commitMsg) {
    inputs.push({ name: "commit message", file: null, text: stripCommentLines(readFileSync(resolve(o.cwd, o.commitMsg), "utf8")) });
  }
  if (o.commit) {
    inputs.push({ name: "last commit", file: null, text: execFileSync("git", ["log", "-1", "--format=%B"], { cwd: o.cwd, encoding: "utf8" }) });
  }
  if (o.pr) {
    const body = execFileSync("gh", ["pr", "view", o.pr, "--json", "body", "--jq", ".body"], { cwd: o.cwd, encoding: "utf8" });
    inputs.push({ name: `pull request #${o.pr}`, file: null, text: body });
  }
  const targets = o.targets.length ? o.targets : o.commit || o.commitMsg || o.pr ? [] : (config.include ?? ["**/*.md"]);
  for (const t of targets) {
    if (t === "-") {
      inputs.push({ name: "stdin", file: null, text: readFileSync(0, "utf8") });
      continue;
    }
    const abs = resolve(o.cwd, t);
    if (existsSync(abs) && !/[*?]/.test(t)) {
      inputs.push({ name: t, file: abs, text: readFileSync(abs, "utf8") });
      continue;
    }
    for (const rel of expand(o.cwd, [t])) {
      if (skippedByDefault(rel)) continue;
      const file = resolve(o.cwd, rel);
      inputs.push({ name: rel, file, text: readFileSync(file, "utf8") });
    }
  }
  return inputs;
}

const stripCommentLines = (msg: string) => msg.split("\n").filter((l) => !l.startsWith("#")).join("\n");

function renderText(results: LintResult[], fixed: Map<string, number>): string {
  const out: string[] = [];
  for (const r of results) {
    const applied = fixed.get(r.path) ?? 0;
    out.push(`${r.path}  ${r.grade} (score ${r.score}, ${r.words} words, ${r.findings.length} finding${r.findings.length === 1 ? "" : "s"}${applied ? `, ${applied} fixed` : ""})`);
    for (const f of r.findings) out.push(`  ${String(f.line).padStart(4)}:${String(f.column).padEnd(3)} ${f.severity.padEnd(7)} ${f.rule.padEnd(20)} ${f.message}`);
  }
  return out.join("\n");
}

function renderGithub(results: LintResult[]): string {
  const out: string[] = [];
  for (const r of results) {
    for (const f of r.findings) {
      const level = f.severity === "error" ? "error" : f.severity === "warning" ? "warning" : "notice";
      out.push(`::${level} file=${r.path},line=${f.line},col=${f.column},title=${f.rule}::${f.message}`);
    }
    out.push(`::notice file=${r.path}::${r.grade}, score ${r.score}, ${r.findings.length} findings`);
  }
  return out.join("\n");
}

async function main() {
  let o: Options;
  try {
    o = parse(process.argv.slice(2));
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(2);
  }
  if (o.listRules) {
    for (const r of rules) console.log(`${r.id.padEnd(22)} ${r.severity.padEnd(8)} ${r.title}  (${r.source})`);
    return;
  }
  const config = loadConfig(o.cwd);
  const ignore = [...(config.ignore ?? []), ...o.ignore];
  const maxScore = o.maxScore ?? config.maxScore ?? 10;
  const inputs = collect(o, config);
  if (!inputs.length) {
    console.error("nothing to lint (no files matched)");
    process.exit(2);
  }
  const results: LintResult[] = [];
  const fixed = new Map<string, number>();
  for (const input of inputs) {
    const display = input.file ? relative(o.cwd, input.file).split(sep).join("/") : input.name;
    if (o.fix && input.file) {
      const r = fixText(display, input.text, { ignore });
      if (r.applied) {
        writeFileSync(input.file, r.text);
        fixed.set(display, r.applied);
      }
      results.push(r.result);
    } else {
      results.push(lintText(display, input.text, { ignore }));
    }
  }
  if (o.format === "json") console.log(JSON.stringify(results.map((r) => ({ ...r, findings: r.findings.map(withoutFix) })), null, 2));
  else if (o.format === "github") console.log(renderGithub(results));
  else console.log(renderText(results, fixed));
  const failing = results.filter((r) => r.errors > 0 || r.score > maxScore);
  if (failing.length && !o.warn) process.exit(1);
}

const withoutFix = (f: Finding) => ({ rule: f.rule, severity: f.severity, line: f.line, column: f.column, excerpt: f.excerpt, message: f.message, fixable: !!f.fix });

const entry = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (entry === import.meta.url || /\/(?:slop|ai-slop-linter)$/.test(entry)) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(2);
  });
}
