#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { history, renderHistory, configuredIdentity } from "./history.js";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve, relative, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { GRADE_FLOOR, allRules, lintText, fixText, rules, languageRules } from "./index.js";
import { expand, globToRegExp, skippedByDefault } from "./glob.js";
import { applyBaseline, createBaseline, parseBaseline } from "./baseline.js";
import { renderSarif } from "./sarif.js";
import { commitRules, lintCommitMessage } from "./commits.js";
import { compareFacts } from "./compare.js";
import { loadCatalog, scanCatalog } from "./catalog.js";
import { scanHedge } from "./hedge.js";
import { chainedSentences } from "./chain.js";
import { prepare } from "./doc.js";
import { structureProblems } from "./structure.js";
import { alignment, alignmentLines, lengthProblem } from "./rewrite-guard.js";
import { maybeStarHint, realFs } from "./star-hint.js";
const HELP = `usage: slop [options] [file|dir|glob|-]...
       slop --commit            lint the last commit message
       slop --commit-msg <file> lint the message being written (what a commit-msg hook receives)
       slop --pr <number>       lint a pull request description (needs gh)
       slop --history           your own commit messages, read over time
       slop --compare <before> <after>  facts a rewrite lost or added, with first-person words, claim words and number qualifiers (also: slop diff)
       slop --verify <before> <after>  the rewrite gate: lint errors, --compare, the tell catalog, the hedge check and a length bound; also lists sentences dropped without a reason (not blocking); exit 0 only if all are clean
       slop --rules             list the rules
       slop --explain <rule>    why one rule exists, with a before and after
       slop --init [action|hook] write .slop.json, and the workflow or the commit hook
       slop --mcp               serve the linter to an AI agent over MCP (JSON-RPC on stdio)

Lints text for the patterns that mark writing as machine-made. It does not guess who
wrote it; it shows the tells, with line numbers, and fixes the safe ones.

  --fix                 apply safe fixes in place (dashes, curly quotes, filler phrases)
  --format <f>          text (default), json, github (workflow annotations), markdown (a table to paste) or sarif
  --ignore <rule,...>   skip rules by id (--skip is the same flag)
  --only <rule,...>     run only these rules
  --language <tag>      the language the prose is written in; rules whose evidence is English
                        stand down when it is not. Unset or "auto": worked out per file
                        from its front matter, then its text (English if nothing is clear)
  --languages <tag,...> rule packs to switch on besides English
  --max-score <n>       fail when a file's score is above n (default from .slop.json, else 10)
  --warn                never exit 1; report only
  --baseline            fail only on findings not listed in the baseline file
  --baseline-write      record the current findings as the baseline, then exit 0
  --baseline-file <f>   the baseline file (default .slop-baseline.json, or "baseline" in .slop.json)
  --author <email,...>  --history: whose messages (default: this repository's user.email)
  --by <period>         --history: month (default), quarter or year
  --since <when>        --history: anything git log --since accepts
  --json                a comparison as JSON: {lost, added, kept}; the kinds include person, claim and qualifier
  --quiet, -q           no star hint after a clean interactive run (changes nothing else)
  --cwd <dir>           working directory (default: current)
  -h, --help            this text
  --version             print the version

A directory means the Markdown inside it. With no targets, lints the globs in .slop.json
("include", default ["**/*.md"]) under --cwd.
Exit 1 on any error-severity finding or a score above --max-score, 2 on usage errors.
Inline: <!-- slop-ignore-next-line [rule] --> and <!-- slop-ignore rule-a, rule-b --> (rest of file).`;
export function parse(input) {
    // `slop diff <before> <after>` is the same command as `slop --compare`; only a first argument counts.
    const diff = input[0] === "diff";
    const argv = diff ? input.slice(1) : input;
    const o = { targets: [], commit: false, fix: false, format: "text", ignore: [], only: [], languages: [], maxScore: undefined, warn: false, baseline: false, baselineWrite: false, cwd: process.cwd(), listRules: false, mcp: false, historyMode: false, authors: [], compare: diff, verify: false, json: false, quiet: false };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        const next = () => {
            const v = argv[++i];
            if (v === undefined)
                throw new Error(`${a} needs a value`);
            return v;
        };
        if (a === "--commit")
            o.commit = true;
        else if (a === "--commit-msg")
            o.commitMsg = next();
        else if (a === "--pr")
            o.pr = next();
        else if (a === "--fix")
            o.fix = true;
        else if (a === "--format") {
            const f = next();
            if (f !== "text" && f !== "json" && f !== "github" && f !== "markdown" && f !== "sarif")
                throw new Error(`--format must be text, json, github, markdown or sarif`);
            o.format = f;
        }
        else if (a === "--ignore" || a === "--skip")
            o.ignore.push(...next().split(",").map((s) => s.trim()).filter(Boolean));
        else if (a === "--only")
            o.only.push(...next().split(",").map((s) => s.trim()).filter(Boolean));
        else if (a === "--language")
            o.language = next();
        else if (a === "--languages")
            o.languages.push(...next().split(",").map((s) => s.trim()).filter(Boolean));
        else if (a === "--max-score")
            o.maxScore = Number(next());
        else if (a === "--warn")
            o.warn = true;
        else if (a === "--baseline")
            o.baseline = true;
        else if (a === "--baseline-write")
            o.baselineWrite = true;
        else if (a === "--baseline-file")
            o.baselineFile = next();
        else if (a === "--cwd")
            o.cwd = resolve(next());
        else if (a === "--history")
            o.historyMode = true;
        else if (a === "--author")
            o.authors.push(...next().split(",").map((v) => v.trim()).filter(Boolean));
        else if (a === "--by") {
            const b = next();
            if (b !== "month" && b !== "quarter" && b !== "year")
                throw new Error("--by must be month, quarter or year");
            o.bucket = b;
        }
        else if (a === "--since")
            o.since = next();
        else if (a === "--rules")
            o.listRules = true;
        else if (a === "--mcp")
            o.mcp = true;
        else if (a === "--compare")
            o.compare = true;
        else if (a === "--verify")
            o.verify = true;
        else if (a === "--json")
            o.json = true;
        else if (a === "--quiet" || a === "-q")
            o.quiet = true;
        else if (a === "--explain")
            o.explain = next();
        else if (a === "--init") {
            const what = argv[i + 1];
            o.init = what && !what.startsWith("-") ? (i++, what) : "config";
            if (o.init !== "config" && o.init !== "action" && o.init !== "hook")
                throw new Error(`--init takes nothing, "action" or "hook", not "${o.init}"`);
        }
        else if (a === "-h" || a === "--help") {
            console.log(HELP);
            process.exit(0);
        }
        else if (a === "--version") {
            console.log(createRequire(import.meta.url)("../../package.json").version);
            process.exit(0);
        }
        else if (a.startsWith("--"))
            throw new Error(`unknown option ${a} (see --help)`);
        else
            o.targets.push(a);
    }
    if (o.json && !o.compare)
        throw new Error("--json applies to a comparison: slop --compare <before> <after> --json");
    if (o.verify && o.compare)
        throw new Error("--verify already includes --compare; use one of them");
    if (o.verify && o.json)
        throw new Error("--verify has no --json output");
    if (o.compare || o.verify) {
        // A comparison reads two files and prints a report; any mode that lints, writes or reads history is another command.
        const others = [
            ["--fix", o.fix],
            ["--commit", o.commit],
            ["--commit-msg", o.commitMsg !== undefined],
            ["--pr", o.pr !== undefined],
            ["--init", o.init !== undefined],
            ["--history", o.historyMode],
            ["--explain", o.explain !== undefined],
            ["--mcp", o.mcp],
            ["--rules", o.listRules],
        ];
        const clash = others.find(([, on]) => on);
        if (clash)
            throw new Error(`${o.verify ? "--verify" : "--compare (and slop diff)"} cannot be combined with ${clash[0]}`);
    }
    return o;
}
/** The rule settings for one path: the top level, then every override that matches it. */
export function settingsFor(config, path) {
    let ignore = config.ignore ?? [];
    let only = config.only ?? [];
    let maxScore = config.maxScore;
    for (const o of config.overrides ?? []) {
        if (!o.files.some((g) => globToRegExp(g).test(path)))
            continue;
        if (o.ignore !== undefined)
            ignore = o.ignore;
        if (o.only !== undefined)
            only = o.only;
        if (o.maxScore !== undefined)
            maxScore = o.maxScore;
    }
    return { ignore, only, maxScore };
}
function loadConfig(cwd) {
    const file = resolve(cwd, ".slop.json");
    if (!existsSync(file))
        return {};
    try {
        return JSON.parse(readFileSync(file, "utf8"));
    }
    catch (err) {
        throw new Error(`.slop.json is not valid JSON: ${err instanceof Error ? err.message : String(err)}`);
    }
}
/** Resolve targets to [displayPath, absolutePath|null for virtual inputs, text]. */
function collect(o, config) {
    const inputs = [];
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
                if (found.length === 0)
                    throw new Error(`no Markdown files under ${t}`);
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
            if (skippedByDefault(rel))
                continue;
            const file = resolve(o.cwd, rel);
            inputs.push({ name: rel, file, text: readFileSync(file, "utf8") });
        }
    }
    return inputs;
}
/** Every rule that can fire anywhere: the prose rules and the commit-only rules. */
const everyRule = [...rules, ...commitRules, ...Object.values(languageRules).flat()];
const stripCommentLines = (msg) => msg.split("\n").filter((l) => !l.startsWith("#")).join("\n");
function renderText(results, fixed) {
    const out = [];
    for (const r of results) {
        const applied = fixed.get(r.path) ?? 0;
        const set = r.baselined ?? 0;
        const extra = `${set ? `, ${set} baselined` : ""}${applied ? `, ${applied} fixed` : ""}`;
        const count = `${r.findings.length} finding${r.findings.length === 1 ? "" : "s"}`;
        out.push(r.score === null
            ? `${r.path}  not graded (${r.words} words, under ${GRADE_FLOOR}, ${count}${extra})`
            : `${r.path}  ${r.grade} (score ${r.score}, ${r.words} words, ${count}${extra})`);
        for (const f of r.findings)
            out.push(`  ${String(f.line).padStart(4)}:${String(f.column).padEnd(3)} ${f.severity.padEnd(7)} ${f.rule.padEnd(20)} ${f.message}`);
    }
    // A rule that did not run is said out loud, so a quiet result is never read as a clean one.
    // A declared language keeps the one-line footer it always had. A language worked out from the
    // file is named per file, because the author did not say it and may not know it was guessed.
    const declared = [...new Set(results.filter((r) => r.languageSource === "declared").flatMap((r) => r.stoodDown))].sort();
    if (declared.length)
        out.push(`${declared.join(", ")} did not run: the declared language is not English.`);
    const inferred = results.filter((r) => r.stoodDown.length && (r.languageSource === "detected" || r.languageSource === "front-matter"));
    for (const r of inferred.slice(0, 5))
        out.push(`${r.stoodDown.join(", ")} did not run for ${r.path}: language ${r.language} (${r.languageSource})`);
    if (inferred.length > 5)
        out.push(`and ${inferred.length - 5} more`);
    return out.join("\n");
}
/** One line of the comparison: `lost   number   40%`. Line breaks in a code fact are shown escaped. */
const factLine = (tag, f) => `${tag.padEnd(6)} ${f.kind.padEnd(8)} ${f.value.replace(/\n/g, "\\n")}`;
/**
 * `--compare` and `slop diff`. Returns true when a fact was lost or added. Usage problems throw,
 * and main reports them with exit 2.
 */
function readPair(o, command) {
    if (o.targets.length !== 2)
        throw new Error(`${command} takes two files: slop ${command} <before> <after> (one side may be - for stdin)`);
    const [beforeArg, afterArg] = o.targets;
    if (beforeArg === "-" && afterArg === "-")
        throw new Error("only one side can be stdin (-)");
    const read = (target) => {
        if (target === "-")
            return readFileSync(0, "utf8");
        try {
            return readFileSync(resolve(o.cwd, target), "utf8");
        }
        catch (err) {
            throw new Error(`cannot read ${target}: ${err.code ?? "error"}`);
        }
    };
    return { before: read(beforeArg), after: read(afterArg), beforeArg, afterArg };
}
function compareCommand(o) {
    const { before, after } = readPair(o, "--compare");
    const { lost, added, kept } = compareFacts(before, after, { language: o.language });
    if (o.json) {
        console.log(JSON.stringify({ lost, added, kept }, null, 2));
    }
    else {
        const lines = [`facts: ${kept} kept, ${lost.length} lost, ${added.length} added`];
        for (const f of lost)
            lines.push(factLine("lost", f));
        for (const f of added)
            lines.push(factLine("added", f));
        if (lost.length === 0 && added.length === 0)
            lines.push("OK: no fact lost or added");
        console.log(lines.join("\n"));
    }
    return lost.length > 0 || added.length > 0;
}
/**
 * `--verify <before> <after>`: the gate a rewrite has to pass. Five checks on the rewrite: the
 * lint errors (what exit 1 means for a file), the fact comparison against the original, the
 * blocks it must keep (front matter, code blocks, table rows, headings), the tell catalog of
 * the text's language and the hedge check. Returns the number of problems; 0 means ok.
 */
function verifyCommand(o) {
    const { before, after, beforeArg, afterArg } = readPair(o, "--verify");
    const config = loadConfig(o.cwd);
    const display = afterArg === "-" ? "stdin" : relative(o.cwd, resolve(o.cwd, afterArg)).split(sep).join("/");
    const per = settingsFor(config, display);
    const language = o.language ?? config.language;
    const languages = o.languages.length ? o.languages : (config.languages ?? []);
    const lint = lintText(display, after, { ignore: [...per.ignore, ...o.ignore], only: o.only.length ? o.only : per.only, languages, ...(language ? { language } : {}) });
    const lines = [];
    let problems = 0;
    for (const f of lint.findings.filter((x) => x.severity === "error")) {
        lines.push(`${f.line}:${f.column} ${f.rule} ${f.message}`);
        problems++;
    }
    const limit = o.maxScore ?? per.maxScore ?? config.maxScore ?? 10;
    if (lint.score !== null && lint.score > limit) {
        lines.push(`score ${lint.score} is over the limit ${limit}`);
        problems++;
    }
    const { lost, added } = compareFacts(before, after, { language: o.language });
    for (const f of lost)
        lines.push(factLine("lost", f));
    for (const f of added)
        lines.push(factLine("added", f));
    problems += lost.length + added.length;
    const markdown = (arg) => arg === "-" || /\.(?:md|markdown|mdx)$/i.test(arg);
    for (const s of markdown(beforeArg) && markdown(afterArg) ? structureProblems(before, after) : []) {
        lines.push(`${s.line}:1 structure ${s.message}`);
        problems++;
    }
    for (const h of scanCatalog(prepare(display, after), lint.language)) {
        lines.push(`${h.line}:${h.column} catalog ${h.phrase.replace(/\s+/g, " ")}`);
        problems++;
    }
    for (const h of [...per.ignore, ...o.ignore].includes("hedge") ? [] : scanHedge(prepare(display, after), lint.language)) {
        lines.push(`${h.line}:${h.column} hedge ${h.phrase.replace(/\s+/g, " ")}`);
        problems++;
    }
    const tooLong = lengthProblem(before, after);
    if (tooLong) {
        lines.push(tooLong);
        problems++;
    }
    {
        const source = lintText(display, before, { ignore: [...per.ignore, ...o.ignore], only: o.only.length ? o.only : per.only, languages, ...(language ? { language } : {}) });
        const sourceDoc = prepare(display, before);
        const catalogHits = scanCatalog(sourceDoc, source.language);
        const hedgeHits = [...per.ignore, ...o.ignore].includes("hedge") ? [] : scanHedge(sourceDoc, source.language);
        const hits = [...catalogHits, ...hedgeHits];
        if (source.findings.length === 0 && hits.length === 0)
            lines.push("clean source: no edit is expected");
        const flagged = new Set([...source.findings.map((f) => f.line), ...hits.map((h) => h.line)]);
        if (before !== after)
            lines.push(...alignmentLines(alignment(before, after, flagged)));
        // Information only: a chained sentence that holds a finding may be rebuilt or split. Never a problem.
        lines.push(...chainedSentences(sourceDoc, [
            ...source.findings.map((f) => ({ line: f.line, column: f.column, label: `${f.rule} ${f.excerpt.replace(/\s+/g, " ")}`.trim() })),
            ...catalogHits.map((h) => ({ line: h.line, column: h.column, label: `catalog ${h.phrase.replace(/\s+/g, " ")}` })),
            ...hedgeHits.map((h) => ({ line: h.line, column: h.column, label: `hedge ${h.phrase.replace(/\s+/g, " ")}` })),
        ]));
    }
    // A clean pass on a language with no phrase catalog proves less; say so. Information only: the exit code is unchanged.
    const tell = lint.language.split(/[-_]/)[0].toLowerCase();
    if (loadCatalog(tell).length === 0)
        lines.push(`note: no tell catalog for ${tell}; the read-back by class and the reference file are the check`);
    lines.push(problems > 0 ? `verify: ${problems} problem(s)` : before === after ? "verify: ok (unchanged)" : "verify: ok");
    console.log(lines.join("\n"));
    return problems;
}
/** One rule, in full, for someone who has just been told their text has it. */
export function explain(rule) {
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
const indent = (text) => text.split("\n").map((l) => `  ${l}`).join("\n");
export function renderGithub(results, maxScore) {
    const out = [];
    for (const r of results) {
        for (const f of r.findings) {
            const level = f.severity === "error" ? "error" : f.severity === "warning" ? "warning" : "notice";
            out.push(`::${level} file=${r.path},line=${f.line},col=${f.column},title=${f.rule}::${f.message}`);
        }
        const summary = r.score === null ? `not graded, ${r.words} words, ${r.findings.length} findings` : `${r.grade}, score ${r.score}, ${r.findings.length} findings`;
        if (r.errors > 0)
            out.push(`::error file=${r.path},title=ai-slop-linter::${summary}; ${r.errors} error-severity tell${r.errors === 1 ? "" : "s"}`);
        else if (r.score !== null && r.score > maxScore)
            out.push(`::error file=${r.path},title=ai-slop-linter::${summary}; score above max-score ${maxScore}`);
        else
            out.push(`::notice file=${r.path},title=ai-slop-linter::${summary}`);
    }
    return out.join("\n");
}
// Backslashes first: escaping only the pipe turned `a\|b` into `a\\|b`, an escaped backslash
// followed by a bare pipe, which ends the cell early and shifts every column after it.
const cell = (s) => s.replace(/[\\|]/g, "\\$&").replace(/\r?\n/g, " ");
/** A Markdown table for a pull request comment or an issue; the same facts as the text output. */
export function renderMarkdown(results, maxScore) {
    const total = results.reduce((n, r) => n + r.findings.length, 0);
    const failing = results.filter((r) => r.errors > 0 || (r.score !== null && r.score > maxScore));
    const out = [];
    out.push(`**ai-slop-linter**: ${total} finding${total === 1 ? "" : "s"} in ${results.length} text${results.length === 1 ? "" : "s"}${failing.length ? `, ${failing.length} failing` : ""}.`);
    out.push("");
    out.push("| text | grade | score | findings |");
    out.push("|---|---|---|---|");
    for (const r of results)
        out.push(`| ${cell(r.path)} | ${r.grade ?? "not graded"}${failing.includes(r) ? " (fails)" : ""} | ${r.score ?? "—"} | ${r.findings.length} |`);
    if (total) {
        out.push("");
        out.push("| where | rule | severity | message |");
        out.push("|---|---|---|---|");
        for (const r of results)
            for (const f of r.findings)
                out.push(`| ${cell(r.path)}:${f.line} | ${f.rule} | ${f.severity} | ${cell(f.message)} |`);
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
function put(path, body, mode) {
    if (existsSync(path))
        throw new Error(`${path} already exists; delete it first or edit it by hand`);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, body, mode === undefined ? undefined : { mode });
    return path;
}
/** `--init`: the config, and on request the workflow or the commit-msg hook. */
export function init(cwd, what) {
    const written = [];
    const config = resolve(cwd, ".slop.json");
    if (!existsSync(config) || what === "config")
        written.push(put(config, CONFIG));
    if (what === "action")
        written.push(put(resolve(cwd, ".github/workflows/prose.yml"), WORKFLOW));
    if (what === "hook") {
        if (!existsSync(resolve(cwd, ".git")))
            throw new Error("no .git directory here; run this inside a repository");
        written.push(put(resolve(cwd, ".git/hooks/commit-msg"), HOOK, 0o755));
    }
    return written;
}
/** What the star hint needs to know about a finished run: the parsed options and what the run reported. */
export function starHintArgs(o, results, exitCode) {
    return {
        format: o.format,
        quiet: o.quiet,
        fix: o.fix,
        commit: o.commit || o.commitMsg !== undefined,
        pr: o.pr !== undefined,
        explain: o.explain !== undefined,
        history: o.historyMode,
        stdin: o.targets.includes("-"),
        exitCode,
        findings: results.reduce((n, r) => n + r.findings.length, 0),
    };
}
async function main() {
    let o;
    try {
        o = parse(process.argv.slice(2));
    }
    catch (err) {
        console.error(err instanceof Error ? err.message : String(err));
        process.exit(2);
    }
    if (o.mcp) {
        // Loaded only here, so every other command starts without it.
        const { serve } = await import("./mcp.js");
        await serve(process.stdin, process.stdout);
        return;
    }
    if (o.verify) {
        let problems;
        try {
            problems = verifyCommand(o);
        }
        catch (err) {
            console.error(err instanceof Error ? err.message : String(err));
            process.exit(2);
        }
        if (problems > 0)
            process.exit(1);
        return;
    }
    if (o.compare) {
        let differs;
        try {
            differs = compareCommand(o);
        }
        catch (err) {
            console.error(err instanceof Error ? err.message : String(err));
            process.exit(2);
        }
        if (differs)
            process.exit(1);
        return;
    }
    if (o.init !== undefined) {
        let written;
        try {
            written = init(o.cwd, o.init);
        }
        catch (err) {
            // A file that is already there is a refusal to act, not a usage error.
            console.error(err instanceof Error ? err.message : String(err));
            process.exit(1);
        }
        for (const file of written)
            console.log(`wrote ${relative(o.cwd, file).split(sep).join("/")}`);
        console.log("run `npx ai-slop-linter` to see what it finds");
        return;
    }
    if (o.explain !== undefined) {
        const rule = everyRule.find((r) => r.id === o.explain);
        if (!rule) {
            console.error(`unknown rule "${o.explain}"\nrules: ${everyRule.map((r) => r.id).join(", ")}`);
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
        let h;
        try {
            h = history({ cwd: o.cwd, authors, ignore: o.ignore, only: o.only, languages: o.languages, ...(o.bucket ? { bucket: o.bucket } : {}), ...(o.since ? { since: o.since } : {}) });
        }
        catch {
            console.error("could not read git history here (is this a repository?)");
            process.exit(2);
        }
        console.log(o.format === "json" ? JSON.stringify(h, null, 2) : renderHistory(h));
        return;
    }
    if (o.listRules) {
        for (const r of rules)
            console.log(`${r.id.padEnd(30)} ${r.severity.padEnd(8)} ${r.title}  (${r.source})`);
        console.log("\nCommit messages and pull request descriptions only (--commit, --commit-msg, --pr):");
        for (const r of commitRules)
            console.log(`${r.id.padEnd(30)} ${r.severity.padEnd(8)} ${r.title}  (${r.source})`);
        console.log("\nLanguage packs (run on text written in that language, or with --languages):");
        for (const r of Object.values(languageRules).flat())
            console.log(`${r.id.padEnd(30)} ${r.severity.padEnd(8)} ${r.title}  (${r.source})`);
        return;
    }
    const config = loadConfig(o.cwd);
    const known = new Set(everyRule.map((r) => r.id));
    for (const id of [...o.only, ...o.ignore]) {
        if (!known.has(id)) {
            console.error(`unknown rule "${id}"\nrules: ${everyRule.map((r) => r.id).join(", ")}`);
            process.exit(2);
        }
    }
    const inputs = collect(o, config);
    if (!inputs.length) {
        console.error("nothing to lint (no files matched)");
        process.exit(2);
    }
    let results = [];
    const fixed = new Map();
    /** Each file gets the settings its own path resolves to, so docs can be stricter than notes. */
    const limits = new Map();
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
        }
        else {
            results.push(short ? lintCommitMessage(display, input.text, opts) : lintText(display, input.text, opts));
        }
    }
    const limitFor = (path) => limits.get(path) ?? o.maxScore ?? config.maxScore ?? 10;
    const maxScore = o.maxScore ?? config.maxScore ?? 10;
    const baselineFile = resolve(o.cwd, o.baselineFile ?? config.baseline ?? ".slop-baseline.json");
    if (o.baselineWrite) {
        const baseline = createBaseline(results);
        writeFileSync(baselineFile, `${JSON.stringify(baseline, null, 2)}\n`);
        console.log(`wrote ${baseline.findings.length} findings to ${relative(o.cwd, baselineFile).split(sep).join("/")}`);
        return;
    }
    if (o.baseline) {
        if (!existsSync(baselineFile))
            throw new Error(`baseline file ${relative(o.cwd, baselineFile)} not found; run with --baseline-write first`);
        results = applyBaseline(results, parseBaseline(readFileSync(baselineFile, "utf8"))).results;
    }
    if (o.format === "json")
        console.log(JSON.stringify(results.map((r) => ({ ...r, findings: r.findings.map(withoutFix) })), null, 2));
    else if (o.format === "github")
        console.log(renderGithub(results, maxScore));
    else if (o.format === "markdown")
        console.log(renderMarkdown(results, maxScore));
    else if (o.format === "sarif")
        console.log(renderSarif(results, [...allRules(), ...commitRules], createRequire(import.meta.url)("../../package.json").version));
    else {
        console.log(renderText(results, fixed));
        // Guidance for a person, kept off stdout so the text format stays parseable
        // by the problem matcher and by anything piping it.
        const first = results.flatMap((r) => r.findings)[0];
        if (first)
            console.error(`\nWhy any of these is a tell, and what to write instead: slop --explain ${first.rule}`);
    }
    const failing = results.filter((r) => r.errors > 0 || (r.score !== null && r.score > limitFor(r.path)));
    const exitCode = failing.length && !o.warn ? 1 : 0;
    maybeStarHint(process.env, process.stdout, starHintArgs(o, results, exitCode), realFs);
    if (exitCode !== 0)
        process.exit(1);
}
const withoutFix = (f) => ({ rule: f.rule, severity: f.severity, line: f.line, column: f.column, excerpt: f.excerpt, message: f.message, fixable: !!f.fix });
const entry = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (entry === import.meta.url || /\/(?:slop|ai-slop-linter)$/.test(entry)) {
    main().catch((err) => {
        console.error(err instanceof Error ? err.message : String(err));
        process.exit(2);
    });
}
