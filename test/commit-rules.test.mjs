import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { alreadyFlagged, hitsPerRule, splitMachine, tokenHits } from "../bench/commit-rules-lib.mjs";
import { candidateRules, commitRules, lintCommitMessage, NOT_ADOPTED } from "../dist/src/commits.js";

const rule = (id) => candidateRules.find((r) => r.id === id);
const idsOf = (text) => new Set(lintCommitMessage("commit message", text).findings.map((f) => f.rule));

test("the machine fixture splits into its four messages", () => {
  assert.equal(splitMachine(readFileSync("bench/corpus/machine/commit-messages.md", "utf8")).length, 4);
  assert.deepEqual(splitMachine("a\n---\nb\n---\n\n"), ["a", "b"]);
});

test("a message counts once per rule however many times the rule fires in it", () => {
  const one = "As part of this change, move it. As part of this change, move it again.";
  const counts = hitsPerRule([one, "Retry failed uploads", "as part of this effort, tidy"], [rule("commit-overexplanation"), rule("commit-marketing")]);
  assert.deepEqual(counts, { "commit-overexplanation": 2, "commit-marketing": 0 });
});

test("token hits use the full upstream list and report each phrase's message count", () => {
  const hits = tokenHits(["Add comprehensive tests", "More comprehensive tests here", "Nothing special"]);
  assert.deepEqual(hits["commit-buzzwords"].find((t) => t.token === "comprehensive tests"), { token: "comprehensive tests", messages: 2 });
  assert.deepEqual(hits["commit-hedging"], []);
});

test("every rule kept out names a candidate and gives a reason, and the rest are the adopted rules", () => {
  for (const [id, reason] of Object.entries(NOT_ADOPTED)) {
    assert.ok(candidateRules.some((r) => r.id === id), `${id} is not a candidate rule`);
    assert.ok(reason.trim().length > 0, `${id} has no reason`);
  }
  assert.equal(commitRules.length + Object.keys(NOT_ADOPTED).length, candidateRules.length);
});

test("a rule with no phrase list reports 0 of 0 rather than failing", () => {
  assert.deepEqual(alreadyFlagged("commit-unquantified"), { flagged: 0, total: 0 });
  const covered = alreadyFlagged("commit-self-reference");
  assert.ok(covered.total >= 60 && covered.flagged <= covered.total);
});

test("the README commit-rules table lists exactly the adopted commit rules, in order", () => {
  const readme = readFileSync("README.md", "utf8");
  const start = readme.indexOf("## Commit message rules");
  assert.ok(start >= 0, "README has no commit message rules section");
  const end = readme.indexOf("\n## ", start + 1);
  const section = readme.slice(start, end === -1 ? undefined : end);
  const ids = [...section.matchAll(/^\| `([a-z-]+)` \|/gm)].map((m) => m[1]);
  assert.ok(ids.length > 0, "the commit rules table has no rows");
  assert.deepEqual(ids, commitRules.map((r) => r.id));
});

test("commit-procedural-assurance fires on every frame verb pair, including sentence-initial capitalisation", () => {
  for (const v of ["preserving", "retaining", "maintaining", "ensuring"]) {
    assert.ok(idsOf(`Rewrote the parser while ${v} the original behavior.`).has("commit-procedural-assurance"), v);
  }
  for (const v of ["changing", "breaking", "altering"]) {
    assert.ok(idsOf(`Shipped the upgrade without ${v} the public API.`).has("commit-procedural-assurance"), v);
  }
  // The case axis: sentence-initial capitalisation is the common spelling in a message.
  assert.ok(idsOf("While preserving the old flags, the migration keeps every script working.").has("commit-procedural-assurance"), "sentence-initial While");
});

test("commit-procedural-assurance never fires on the bare verbs, other frames, code spans or a trailer line", () => {
  for (const text of [
    "The migration preserves the original meaning.",
    "Preserving the cache was the point, and retaining it sped up the tests.",
    "We ensured the flag stayed set, altered the order, and broke nothing by hand.",
    "The daemon stays up while shipping metrics.",
    "The upgrade lands without comment.",
  ]) {
    assert.ok(!idsOf(text).has("commit-procedural-assurance"), text);
  }
  // Inside inline code the phrase is a quotation, not a tell.
  assert.ok(!idsOf("Quoted the tell `while preserving` in the notes.").has("commit-procedural-assurance"), "code span");
  // A trailer line is tooling, not prose: the construction inside a Co-Authored-By is not read.
  const trailer = "Fix the retry\n\nCo-Authored-By: Someone (while preserving the world) <a@b.c>\n";
  assert.ok(!idsOf(trailer).has("commit-procedural-assurance"), "trailer line");
});

test("commit-procedural-assurance surfaces warning severity and the inline directive silences it", () => {
  const found = lintCommitMessage("m", "We rewrote the engine while preserving the original meaning.\n").findings.filter((f) => f.rule === "commit-procedural-assurance");
  assert.equal(found.length, 1);
  assert.equal(found[0].severity, "warning");
  const suppressed = "<!-- slop-ignore commit-procedural-assurance -->\nWe rewrote the engine while preserving the original meaning.\n";
  assert.ok(!idsOf(suppressed).has("commit-procedural-assurance"), "directive");
});

test("commit-procedural-assurance names Wikipedia as its source, not the borrowed phrase-list upstream", () => {
  // The generic gate cannot check truth: UPSTREAM contains MIT and satisfies it. This rule's
  // source is pinned so --explain prints the authority the rule was actually built from.
  assert.equal(
    rule("commit-procedural-assurance")?.source,
    'Wikipedia, Signs of AI writing: Specific mentions of "preserved" or "retained" information, "avoided" mistakes, and other procedural statements',
  );
});
