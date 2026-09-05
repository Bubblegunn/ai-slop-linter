#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { history, renderHistory, configuredIdentity, type Bucket } from "./history.js";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve, relative, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { GRADE_FLOOR, lintText, fixText, rules } from "./index.js";
import type { LintResult, Finding, Rule } from "./index.js";
import { expand, globToRegExp, skippedByDefault } from "./glob.js";
import { applyBaseline, createBaseline, parseBaseline } from "./baseline.js";

const HELP = `usage: slop [options] [file|dir|glob|-]...
       slop --commit            lint the last commit message
       slop --commit-msg <file> lint the message being written (what a commit-msg hook receives)
       slop --pr <number>       lint a pull request description (needs gh)
       slop --history           your own commit messages, read over time
       slop --rules             list the rules
       slop --explain <rule>    why one rule exists, with a before and after
       slop --init [action|hook] write .slop.json, and the workflow or the commit hook

Lints text for the patterns that mark writing as machine-made. It does not guess who
wrote it; it shows the tells, with line numbers, and fixes the safe ones.

  --fix                 apply safe fixes in place (dashes, curly quotes, filler phrases)
  --format <f>          text (default), json, github (workflow annotations) or markdown (a table to paste)
  --ignore <rule,...>   skip rules by id (--skip is the same flag)
  --only <rule,...>     run only these rules
  --language <tag>      the language this repository's prose is written in (default en);
                        rules whose evidence is English stand down when it is not
  --languages <tag,...> rule packs to switch on besides English
  --max-score <n>       fail when a file's score is above n (default from .slop.json, else 10)
  --warn                never exit 1; report only
  --baseline            fail only on findings not listed in the baseline file
  --baseline-write      record the current findings as the baseline, then exit 0
  --baseline-file <f>   the baseline file (default .slop-baseline.json, or "baseline" in .slop.json)
  --author <email,...>  --history: whose messages (default: this repository's user.email)
  --by <period>         --history: month (default), quarter or year
  --since <when>        --history: anything git log --since accepts
  --cwd <dir>           working directory (default: current)
  -h, --help            this text
  --version             print the version

A directory means the Markdown inside it. With no targets, lints the globs in .slop.json
("include", default ["**/*.md"]) under --cwd.
Exit 1 on any error-severity finding or a score above --max-score, 2 on usage errors.
Inline: <!-- slop-ignore-next-line [rule] --> and <!-- slop-ignore rule-a, rule-b --> (rest of file).`;

interface Options {
  targets: string[];
  commit: boolean;
  commitMsg?: string;
  pr?: string;
  fix: boolean;
  format: "text" | "json" | "github" | "markdown";
  ignore: string[];
  only: string[];
  languages: string[];
  language?: string;
  maxScore: number | undefined;
  warn: boolean;
  baseline: boolean;
  baselineWrite: boolean;
  baselineFile?: string;
  cwd: string;
  listRules: boolean;
  explain?: string;
  init?: string;
  historyMode: boolean;
  authors: string[];
  bucket?: Bucket;
  since?: string;
}

export function parse(argv: string[]): Options {
  const o: Options = { targets: [], commit: false, fix: false, format: "text", ignore: [], only: [], languages: [], maxScore: undefined, warn: false, baseline: false, baselineWrite: false, cwd: process.cwd(), listRules: false, historyMode: false, authors: [] };
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
      if (f !== "text" && f !== "json" && f !== "github" && f !== "markdown") throw new Error(`--format must be text, json, github or markdown`);
      o.format = f;
    } else if (a === "--ignore" || a === "--skip") o.ignore.push(...next().split(",").map((s) => s.trim()).filter(Boolean));
    else if (a === "--only") o.only.push(...next().split(",").map((s) => s.trim()).filter(Boolean));
    else if (a === "--language") o.language = next();
    else if (a === "--languages") o.languages.push(...next().split(",").map((s) => s.trim()).filter(Boolean));
    else if (a === "--max-score") o.maxScore = Number(next());
    else if (a === "--warn") o.warn = true;
    else if (a === "--baseline") o.baseline = true;
    else if (a === "--baseline-write") o.baselineWrite = true;
    else if (a === "--baseline-file") o.baselineFile = next();
    else if (a === "--cwd") o.cwd = resolve(next());
    else if (a === "--history") o.historyMode = true;
    else if (a === "--author") o.authors.push(...next().split(",").map((v) => v.trim()).filter(Boolean));
    else if (a === "--by") {
      const b = next();
      if (b !== "month" && b !== "quarter" && b !== "year") throw new Error("--by must be month, quarter or year");
      o.bucket = b;
    } else if (a === "--since") o.since = next();
    else if (a === "--rules") o.listRules = true;
    else if (a === "--explain") o.explain = next();
    else if (a === "--init") {
      const what = argv[i + 1];
      o.init = what && !what.startsWith("-") ? (i++, what) : "config";
      if (o.init !== "config" && o.init !== "action" && o.init !== "hook") throw new Error(`--init takes nothing, "action" or "hook", not "${o.init}"`);
    }
    else if (a === "-h" || a === "--help") {
      console.log(HELP);
      process.exit(0);
    } else if (a === "--version") {
      console.log(createRequire(import.meta.url)("../../package.json").version as string);
      process.exit(0);
    } else if (a.startsWith("--")) throw new Error(`unknown option ${a} (see --help)`);
    else o.targets.push(a);
  }
  return o;
}

interface Rules {
  ignore?: string[];
  only?: string[];
  maxScore?: number;
}

interface Override extends Rules {
  /** Globs, matched against the path as reported, with forward slashes. */
  files: string[];
}

interface Config extends Rules {
  include?: string[];
  /** Language rule packs to switch on besides English. */
  languages?: string[];
  /**
   * The language this repository's prose is written in, a BCP 47 tag, default "en". Not the
   * same as `languages`, which switches extra rule packs on: this one says what the text is,
   * and rules whose evidence is English stand down when it is not English.
   */
  language?: string;
  baseline?: string;
  /** Applied in order to a file that matches; a later entry wins over an earlier one. */
  overrides?: Override[];
}

/** The rule settings for one path: the top level, then every override that matches it. */
export function settingsFor(config: Config, path: string): { ignore: string[]; only: string[]; maxScore: number | undefined } {
  let ignore = config.ignore ?? [];
  let only = config.only ?? [];
  let maxScore = config.maxScore;
  for (const o of config.overrides ?? []) {
    if (!o.files.some((g) => globToRegExp(g).test(path))) continue;
    if (o.ignore !== undefined) ignore = o.ignore;
    if (o.only !== undefined) only = o.only;
    if (o.maxScore !== undefined) maxScore = o.maxScore;
  }
  return { ignore, only, maxScore };
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
      // A directory means the Markdown inside it, which is what running with no target
      // does for the whole repository. Reading it as a file printed EISDIR.
      if (statSync(abs).isDirectory()) {
        const found = expand(abs, ["**/*.md"]).filter((rel) => !skippedByDefault(rel));
        if (found.length === 0) throw new Error(`no Markdown files under ${t}`);
        for (const rel of found) {
          const file = resolve(abs, rel);
          inputs.push({ name: relative(o.cwd, file).split(sep).join("/"), file, text: readFileSync(file, "utf8") });
        }
        continue;
      }
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

function renderText(results: (LintResult & { baselined?: number })[], fixed: Map<string, number>): string {
  const out: string[] = [];
  for (const r of results) {
    const applied = fixed.get(r.path) ?? 0;
    const set = r.baselined ?? 0;
    const extra = `${set ? `, ${set} baselined` : ""}${applied ? `, ${applied} fixed` : ""}`;
    const count = `${r.findings.length} finding${r.findings.length === 1 ? "" : "s"}`;
    out.push(
      r.score === null
        ? `${r.path}  not graded (${r.words} words, under ${GRADE_FLOOR}, ${count}${extra})`
        : `${r.path}  ${r.grade} (score ${r.score}, ${r.words} words, ${count}${extra})`,
    );
    for (const f of r.findings) out.push(`  ${String(f.line).padStart(4)}:${String(f.column).padEnd(3)} ${f.severity.padEnd(7)} ${f.rule.padEnd(20)} ${f.message}`);
  }
  // A rule that did not run is said out loud, so a quiet result is never read as a clean one.
  const stoodDown = [...new Set(results.flatMap((r) => r.stoodDown))].sort();
  if (stoodDown.length) out.push(`${stoodDown.join(", ")} did not run: the declared language is not English.`);
  return out.join("\n");
}

/** One rule, in full, for someone who has just been told their text has it. */
export function explain(rule: Rule): string {
  return [
    `${rule.id}  ${rule.severity}  ${rule.title}`,
    `source: ${rule.source}`,
    "",
    "Why",
    indent(rule.why),
    "",
    "Instead of",
    indent(rule.example.before.trimEnd()),
    "",
    "Write",
    indent(rule.example.after.trimEnd()),
    "",
    "Ignore it when",
    indent(rule.ignoreWhen),
    "",
    `Switch it off with --ignore ${rule.id}, or per file with <!-- slop-ignore ${rule.id} -->.`,
  ].join("\n");
}

const indent = (text: string) => text.split("\n").map((l) => `  ${l}`).join("\n");

export function renderGithub(results: LintResult[], maxScore: number): string {
  const out: string[] = [];
  for (const r of results) {
    for (const f of r.findings) {
      const level = f.severity === "error" ? "error" : f.severity === "warning" ? "warning" : "notice";
      out.push(`::${level} file=${r.path},line=${f.line},col=${f.column},title=${f.rule}::${f.message}`);
    }
    const summary = r.score === null ? `not graded, ${r.words} words, ${r.findings.length} findings` : `${r.grade}, score ${r.score}, ${r.findings.length} findings`;
    if (r.errors > 0) out.push(`::error file=${r.path},title=ai-slop-linter::${summary}; ${r.errors} error-severity tell${r.errors === 1 ? "" : "s"}`);
    else if (r.score !== null && r.score > maxScore) out.push(`::error file=${r.path},title=ai-slop-linter::${summary}; score above max-score ${maxScore}`);
    else out.push(`::notice file=${r.path},title=ai-slop-linter::${summary}`);
  }
  return out.join("\n");
}

const cell = (s: string) => s.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");

/** A Markdown table for a pull request comment or an issue; the same facts as the text output. */
export function renderMarkdown(results: LintResult[], maxScore: number): string {
  const total = results.reduce((n, r) => n + r.findings.length, 0);
  const failing = results.filter((r) => r.errors > 0 || (r.score !== null && r.score > maxScore));
  const out: string[] = [];
  out.push(`**ai-slop-linter**: ${total} finding${total === 1 ? "" : "s"} in ${results.length} text${results.length === 1 ? "" : "s"}${failing.length ? `, ${failing.length} failing` : ""}.`);
  out.push("");
  out.push("| text | grade | score | findings |");
  out.push("|---|---|---|---|");
  for (const r of results) out.push(`| ${cell(r.path)} | ${r.grade ?? "not graded"}${failing.includes(r) ? " (fails)" : ""} | ${r.score ?? "—"} | ${r.findings.length} |`);
  if (total) {
    out.push("");
    out.push("| where | rule | severity | message |");
    out.push("|---|---|---|---|");
    for (const r of results) for (const f of r.findings) out.push(`| ${cell(r.path)}:${f.line} | ${f.rule} | ${f.severity} | ${cell(f.message)} |`);
  }
  out.push("");
  out.push("Scores are weighted findings per 1,000 words; the tool lists tells and does not judge who wrote the text.");
  return out.join("\n");
}


const CONFIG = `{
  "include": ["**/*.md"],
  "language": "en",
  "maxScore": 10,
  "overrides": [
    { "files": ["CHANGELOG.md"], "ignore": ["bold-label"] }
  ]
}
`;

const WORKFLOW = `name: prose
on: pull_request
permissions:
  contents: read
  pull-requests: write # read is enough with comment: "false"
jobs:
  slop:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: Bubblegunn/ai-slop-linter@v0
        # with:
        #   max-score: "5"
        #   baseline: ".slop-baseline.json"
`;

const HOOK = `#!/bin/sh
# ai-slop-linter commit-msg hook: refuses a commit message that carries AI-writing tells.
# Skip once with: git commit --no-verify

if command -v ai-slop-linter >/dev/null 2>&1; then
  ai-slop-linter --commit-msg "$1"
elif [ -x node_modules/.bin/ai-slop-linter ]; then
  node_modules/.bin/ai-slop-linter --commit-msg "$1"
else
  npx --yes ai-slop-linter --commit-msg "$1"
fi
`;

/** Write one file, refusing to touch a file that is already there. */
function put(path: string, body: string, mode?: number): string {
  if (existsSync(path)) throw new Error(`${path} already exists; delete it first or edit it by hand`);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, body, mode === undefined ? undefined : { mode });
  return path;
}

/** `--init`: the config, and on request the workflow or the commit-msg hook. */
export function init(cwd: string, what: "config" | "action" | "hook"): string[] {
  const written: string[] = [];
  const config = resolve(cwd, ".slop.json");
  if (!existsSync(config) || what === "config") written.push(put(config, CONFIG));
  if (what === "action") written.push(put(resolve(cwd, ".github/workflows/prose.yml"), WORKFLOW));
  if (what === "hook") {
    if (!existsSync(resolve(cwd, ".git"))) throw new Error("no .git directory here; run this inside a repository");
    written.push(put(resolve(cwd, ".git/hooks/commit-msg"), HOOK, 0o755));
  }
  return written;
}

async function main() {
  let o: Options;
  try {
    o = parse(process.argv.slice(2));
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(2);
  }
  if (o.init !== undefined) {
    let written: string[];
    try {
      written = init(o.cwd, o.init as "config" | "action" | "hook");
    } catch (err) {
      // A file that is already there is a refusal to act, not a usage error.
      console.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
    for (const file of written) console.log(`wrote ${relative(o.cwd, file).split(sep).join("/")}`);
    console.log("run `npx ai-slop-linter` to see what it finds");
    return;
  }
  if (o.explain !== undefined) {
    const rule = rules.find((r) => r.id === o.explain);
    if (!rule) {
      console.error(`unknown rule "${o.explain}"\nrules: ${rules.map((r) => r.id).join(", ")}`);
      process.exit(2);
    }
    console.log(explain(rule));
    return;
  }
  if (o.historyMode) {
    // Default to the identity this repository would sign a commit with. Reading your own
    // writing back is the point; naming someone else has to be a deliberate act.
    const authors = o.authors.length ? o.authors : (() => { const me = configuredIdentity(o.cwd); return me ? [me] : []; })();
    if (!o.authors.length && authors.length === 0) {
      console.error("no git user.email is set here, so there is no \"your own\" to read.\nSet one, or name an address with --author.");
      process.exit(2);
    }
    let h: ReturnType<typeof history>;
    try {
      h = history({ cwd: o.cwd, authors, ignore: o.ignore, only: o.only, languages: o.languages, ...(o.bucket ? { bucket: o.bucket } : {}), ...(o.since ? { since: o.since } : {}) });
    } catch {
      console.error("could not read git history here (is this a repository?)");
      process.exit(2);
    }
    console.log(o.format === "json" ? JSON.stringify(h, null, 2) : renderHistory(h));
    return;
  }
  if (o.listRules) {
    for (const r of rules) console.log(`${r.id.padEnd(22)} ${r.severity.padEnd(8)} ${r.title}  (${r.source})`);
    return;
  }
  const config = loadConfig(o.cwd);
  const known = new Set(rules.map((r) => r.id));
  for (const id of [...o.only, ...o.ignore]) {
    if (!known.has(id)) {
      console.error(`unknown rule "${id}"\nrules: ${rules.map((r) => r.id).join(", ")}`);
      process.exit(2);
    }
  }
  const inputs = collect(o, config);
  if (!inputs.length) {
    console.error("nothing to lint (no files matched)");
    process.exit(2);
  }
  let results: (LintResult & { baselined?: number })[] = [];
  const fixed = new Map<string, number>();
  /** Each file gets the settings its own path resolves to, so docs can be stricter than notes. */
  const limits = new Map<string, number>();
  for (const input of inputs) {
    const display = input.file ? relative(o.cwd, input.file).split(sep).join("/") : input.name;
    const per = settingsFor(config, display);
    // A commit message and a pull request description are short by nature, so the floor
    // that stops a fragment being graded would leave every one of them ungraded. There the
    // question is whether the text carries a tell, not how dense the tells are.
    const short = input.file === null && input.name !== "stdin";
    const languages = o.languages.length ? o.languages : (config.languages ?? []);
    const language = o.language ?? config.language;
    const opts = { ignore: [...per.ignore, ...o.ignore], only: o.only.length ? o.only : per.only, languages, ...(language ? { language } : {}), ...(short ? { floor: 0 } : {}) };
    limits.set(display, o.maxScore ?? per.maxScore ?? 10);
    if (o.fix && input.file) {
      const r = fixText(display, input.text, opts);
      if (r.applied) {
        writeFileSync(input.file, r.text);
        fixed.set(display, r.applied);
      }
      results.push(r.result);
    } else {
      results.push(lintText(display, input.text, opts));
    }
  }
  const limitFor = (path: string) => limits.get(path) ?? o.maxScore ?? config.maxScore ?? 10;
  const maxScore = o.maxScore ?? config.maxScore ?? 10;
  const baselineFile = resolve(o.cwd, o.baselineFile ?? config.baseline ?? ".slop-baseline.json");
  if (o.baselineWrite) {
    const baseline = createBaseline(results);
    writeFileSync(baselineFile, `${JSON.stringify(baseline, null, 2)}\n`);
    console.log(`wrote ${baseline.findings.length} findings to ${relative(o.cwd, baselineFile).split(sep).join("/")}`);
    return;
  }
  if (o.baseline) {
    if (!existsSync(baselineFile)) throw new Error(`baseline file ${relative(o.cwd, baselineFile)} not found; run with --baseline-write first`);
    results = applyBaseline(results, parseBaseline(readFileSync(baselineFile, "utf8"))).results;
  }
  if (o.format === "json") console.log(JSON.stringify(results.map((r) => ({ ...r, findings: r.findings.map(withoutFix) })), null, 2));
  else if (o.format === "github") console.log(renderGithub(results, maxScore));
  else if (o.format === "markdown") console.log(renderMarkdown(results, maxScore));
  else {
    console.log(renderText(results, fixed));
    // Guidance for a person, kept off stdout so the text format stays parseable
    // by the problem matcher and by anything piping it.
    const first = results.flatMap((r) => r.findings)[0];
    if (first) console.error(`\nWhy any of these is a tell, and what to write instead: slop --explain ${first.rule}`);
  }
  const failing = results.filter((r) => r.errors > 0 || (r.score !== null && r.score > limitFor(r.path)));
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
