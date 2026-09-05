#!/usr/bin/env node
/**
 * Do commit messages that declare an agent carry the tells this linter looks for?
 *
 *   node bench/agents.mjs ~/src/repo-a ~/src/repo-b ...
 *   node bench/agents.mjs --dir ~/src        every git repository one level down
 *
 * Ground truth comes from the commits themselves. A message whose trailer block names a
 * coding agent, an author name carrying an agent suffix, or a known agent bot address is a
 * self-declared machine message. Nothing here detects authorship or classifies a person.
 *
 * The comparison is within a repository and never across them: a project has a house style,
 * so comparing declared commits in one project against undeclared commits in another would
 * measure the projects. A repository counts only when it has commits on both sides.
 *
 * See RESEARCH.md for the method, the licences and what this cannot show.
 */
import { execFileSync } from "node:child_process";
import { readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { lintText, WEIGHTS } from "../dist/src/index.js";
import { stripTrailers } from "../dist/src/history.js";

const RECORD = "\u001e";
const UNIT = "\u001f";

/**
 * Coding agents that sign their work, matched on the address or the marker each one
 * actually writes rather than on its name alone. The list is deliberately conservative:
 * a human called Claude must not be counted, so the Anthropic trailer is matched on the
 * domain and not on the given name.
 *
 * Under-counting is the safe direction. An agent commit this list misses lands on the
 * undeclared side, which dilutes that side toward machine writing and makes any measured
 * difference a floor rather than an estimate.
 */
export const AGENTS = [
  { id: "claude", trailer: /noreply@anthropic\.com/i, email: /noreply@anthropic\.com/i },
  { id: "copilot", trailer: /copilot(-swe-agent)?(\[bot\])?@|<copilot@/i, email: /copilot(-swe-agent)?\[bot\]@/i },
  { id: "devin", trailer: /devin-ai-integration\[bot\]@/i, email: /devin-ai-integration\[bot\]@/i },
  { id: "cursor", trailer: /<cursoragent@|cursor\[bot\]@/i, email: /cursoragent@|cursor\[bot\]@/i },
  { id: "aider", trailer: /\baider\b/i, name: /\(aider\)\s*$/i },
  { id: "codex", trailer: /<codex@|codex\[bot\]@/i, email: /<?codex(\[bot\])?@/i },
  { id: "gemini", trailer: /gemini-code-assist\[bot\]@|<jules@/i, email: /gemini-code-assist\[bot\]@/i },
];

/**
 * The contiguous `Key: value` block at the end of a message, which is what the git
 * convention calls a trailer. A line in the middle of a paragraph is prose, so a message
 * that explains the convention is not counted as an agent's work.
 */
export function trailerBlock(message) {
  const lines = message.replace(/\r\n/g, "\n").split("\n");
  while (lines.length && lines[lines.length - 1].trim() === "") lines.pop();
  let end = lines.length;
  while (end > 0 && /^[A-Za-z][A-Za-z0-9-]*:[ \t].+$/.test(lines[end - 1])) end--;
  if (end === 0) return "";
  return lines.slice(end).join("\n");
}

/** The agent a commit declares, or null. Never a guess: the commit has to say so. */
export function declaresAgent({ name = "", email = "", message = "" }) {
  const block = trailerBlock(message);
  for (const agent of AGENTS) {
    if (agent.trailer && block && agent.trailer.test(block)) return { agent: agent.id, signal: "trailer" };
  }
  for (const agent of AGENTS) {
    if (agent.name && agent.name.test(name)) return { agent: agent.id, signal: "author-name" };
  }
  for (const agent of AGENTS) {
    if (agent.email && agent.email.test(email)) return { agent: agent.id, signal: "author-email" };
  }
  return null;
}

/**
 * Two disjoint sides, with the trailer removed from the text before anything counts it.
 * The trailer is the label; a rule firing on it would report a difference that exists by
 * construction. A message with no prose left contributes to neither side.
 */
export function splitCommits(commits) {
  const declared = [];
  const undeclared = [];
  for (const commit of commits) {
    const text = stripTrailers(commit.message ?? "");
    if (!text.trim()) continue;
    const agent = declaresAgent(commit);
    if (agent) declared.push({ text, agent: agent.agent, signal: agent.signal });
    else undeclared.push({ text });
  }
  return { declared, undeclared };
}

/** Only repositories with commits on both sides, so every difference is within a project. */
export function pairedOnly(perRepo) {
  const kept = [];
  const dropped = [];
  for (const repo of perRepo) {
    if (repo.declared.length === 0) dropped.push({ repo: repo.repo, reason: "no declared commits" });
    else if (repo.undeclared.length === 0) dropped.push({ repo: repo.repo, reason: "no undeclared commits" });
    else kept.push(repo);
  }
  return { kept, dropped };
}

const round = (n) => Math.round(n * 100) / 100;

/** Rate per 1,000 words on each side, with the counts that produced it. */
export function ratesByRule({ declared, undeclared }) {
  const ids = new Set([...declared.rules.keys(), ...undeclared.rules.keys()]);
  return [...ids]
    .sort()
    .map((rule) => {
      const declaredCount = declared.rules.get(rule) ?? 0;
      const undeclaredCount = undeclared.rules.get(rule) ?? 0;
      const declaredPer1000 = declared.words ? declaredCount / (declared.words / 1000) : 0;
      const undeclaredPer1000 = undeclared.words ? undeclaredCount / (undeclared.words / 1000) : 0;
      return {
        rule,
        declaredCount,
        undeclaredCount,
        declaredPer1000: round(declaredPer1000),
        undeclaredPer1000: round(undeclaredPer1000),
        // A ratio against zero is not a number anyone should quote.
        ratio: undeclaredPer1000 > 0 ? round(declaredPer1000 / undeclaredPer1000) : null,
      };
    })
    .sort((a, b) => b.declaredCount + b.undeclaredCount - (a.declaredCount + a.undeclaredCount));
}

/** Lint every message on one side and total the findings by rule. */
export function tally(side) {
  const rules = new Map();
  let words = 0;
  let weighted = 0;
  for (const { text } of side) {
    const result = lintText("commit message", text, { floor: 0 });
    words += result.words;
    for (const f of result.findings) {
      rules.set(f.rule, (rules.get(f.rule) ?? 0) + 1);
      weighted += WEIGHTS[f.severity];
    }
  }
  return { messages: side.length, words, weighted, rules };
}

const git = (cwd, args) => execFileSync("git", args, { cwd, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });

export function readCommits(cwd) {
  const raw = git(cwd, ["log", "--no-merges", `--format=%an${UNIT}%ae${UNIT}%B${RECORD}`]);
  const commits = [];
  for (const record of raw.split(RECORD)) {
    const trimmed = record.replace(/^\n+/, "");
    if (!trimmed.trim()) continue;
    const [name, email, ...rest] = trimmed.split(UNIT);
    if (rest.length === 0) continue;
    commits.push({ name, email, message: rest.join(UNIT) });
  }
  return commits;
}

function main(argv) {
  let repos = [];
  const dirFlag = argv.indexOf("--dir");
  if (dirFlag !== -1) {
    const root = argv[dirFlag + 1];
    if (!root) throw new Error("--dir needs a directory");
    repos = readdirSync(root, { withFileTypes: true })
      .filter((e) => e.isDirectory() && existsSync(join(root, e.name, ".git")))
      .map((e) => join(root, e.name));
  } else {
    repos = argv.filter((a) => !a.startsWith("-"));
  }
  if (repos.length === 0) {
    console.error("usage: node bench/agents.mjs <repo>... | --dir <directory>");
    process.exit(2);
  }

  const perRepo = repos.map((repo) => ({ repo, ...splitCommits(readCommits(repo)) }));
  const { kept, dropped } = pairedOnly(perRepo);

  if (kept.length === 0) {
    console.error(`No repository had commits on both sides, so there is nothing to compare.`);
    for (const d of dropped) console.error(`  ${d.repo}: ${d.reason}`);
    process.exit(1);
  }

  const declared = tally(kept.flatMap((r) => r.declared));
  const undeclared = tally(kept.flatMap((r) => r.undeclared));
  const rows = ratesByRule({ declared, undeclared });

  const agents = new Map();
  for (const r of kept) for (const c of r.declared) agents.set(c.agent, (agents.get(c.agent) ?? 0) + 1);

  console.log(`${kept.length} repositories with commits on both sides; ${dropped.length} dropped for having only one.`);
  console.log(`declared   ${declared.messages.toLocaleString("en-US")} messages, ${declared.words.toLocaleString("en-US")} words`);
  console.log(`undeclared ${undeclared.messages.toLocaleString("en-US")} messages, ${undeclared.words.toLocaleString("en-US")} words`);
  console.log(`agents declared: ${[...agents].map(([a, n]) => `${a} (${n})`).join(", ") || "none"}`);
  console.log("");
  console.log("| rule | declared /1k | undeclared /1k | ratio | declared n | undeclared n |");
  console.log("|---|---:|---:|---:|---:|---:|");
  for (const r of rows) {
    console.log(`| \`${r.rule}\` | ${r.declaredPer1000} | ${r.undeclaredPer1000} | ${r.ratio ?? "-"} | ${r.declaredCount} | ${r.undeclaredCount} |`);
  }
  console.log("");
  console.log("Rates, not accuracy. A ratio near 1 is a result: it would mean commit messages are");
  console.log("too short and too templated to carry what prose carries. Read a row only when both");
  console.log("counts are large enough to mean something. The undeclared side is a mixture of human");
  console.log("and undeclared machine writing, so a difference here is a floor, not an estimate.");
  if (dropped.length) {
    console.log("");
    console.log("Dropped:");
    for (const d of dropped) console.log(`  ${d.repo}: ${d.reason}`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main(process.argv.slice(2));
