import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { lintText, rules } from "../src/index.js";
import { prepare } from "../src/doc.js";
import { EXCLUDED, NOT_ADOPTED, candidateRules, commitRules, escapeRegExp, lintCommitMessage, phrasePattern } from "../src/commits.js";
import { PHRASES } from "../src/commit-phrases.js";

const idsOf = (text: string) => new Set(lintCommitMessage("commit message", text).findings.map((f) => f.rule));

test("every candidate rule carries the material --explain prints, and its example trips it and its rewrite does not", () => {
  for (const r of candidateRules) {
    assert.ok(r.id.startsWith("commit-"), `${r.id} should start with commit-`);
    assert.ok(r.why.length > 40, `${r.id} has no why`);
    assert.notEqual(r.example.before, r.example.after, `${r.id} example does not change`);
    assert.ok(r.ignoreWhen.length > 20, `${r.id} does not say when to ignore it`);
    assert.ok(/MIT|Wikipedia/.test(r.source), `${r.id} does not name its source`);
    assert.ok(r.check(prepare("m", r.example.before)).length > 0, `${r.id}: its own before example does not trip it`);
    assert.equal(r.check(prepare("m", r.example.after)).length, 0, `${r.id}: its own after example still trips it`);
  }
});

test("commit rule ids never collide with a prose rule id", () => {
  const prose = new Set(rules.map((r) => r.id));
  for (const r of candidateRules) assert.ok(!prose.has(r.id), r.id);
});

test("the adopted rules are the candidates minus the ones measurement ruled out, each with a reason", () => {
  const ids = new Set(candidateRules.map((r) => r.id));
  for (const [id, reason] of Object.entries(NOT_ADOPTED)) {
    assert.ok(ids.has(id), `${id} is not a candidate`);
    assert.ok(reason.length > 20, `${id} needs a reason`);
  }
  assert.deepEqual(commitRules.map((r) => r.id), candidateRules.filter((r) => !(r.id in NOT_ADOPTED)).map((r) => r.id));
  assert.ok(commitRules.length > 0);
});

test("a phrase that was left out exists in the upstream list, and a rule keeps enough phrases to be worth having", () => {
  for (const [id, dropped] of Object.entries(EXCLUDED)) {
    const list = PHRASES[id];
    assert.ok(list, `${id} has no phrase list`);
    for (const token of dropped) assert.ok(list.tokens.includes(token), `${id}: "${token}" is not in the list`);
    assert.ok(list.tokens.length - dropped.length >= 10, `${id} is left with fewer than ten phrases`);
  }
});

test("prose never sees a commit rule: lintText on the same words finds none of them", () => {
  const text = "As part of this change, move the cache. Make it production-ready.\n";
  assert.ok(idsOf(text).has("commit-overexplanation"));
  assert.ok(idsOf(text).has("commit-marketing"));
  const prose = lintText("README.md", text).findings.map((f) => f.rule);
  assert.deepEqual(prose.filter((id) => id.startsWith("commit-")), []);
});

test("a clean message passes and a framed one is graded despite being short", () => {
  assert.deepEqual(lintCommitMessage("m", "Retry failed uploads three times\n").findings, []);
  const r = lintCommitMessage("m", "As part of this change, move the cache into its own module.\n");
  assert.equal(r.findings.length, 1);
  assert.notEqual(r.grade, null, "a short message is still graded");
  assert.ok(r.score! > 10, `score ${r.score} should exceed the default max of 10`);
});

test("prose rules still run on a commit message, and the findings are in line order", () => {
  const r = lintCommitMessage("m", "feat: thing — with a dash\n\nAs part of this change, move the cache.\n");
  assert.deepEqual(r.findings.map((f) => f.rule), ["dash", "commit-overexplanation"]);
  assert.equal(r.errors, 1);
  // A commit-rule finding that comes before a prose-rule finding must be listed first.
  const early = lintCommitMessage("m", "As part of this change, move the cache.\n\nI hope this helps!\n");
  assert.deepEqual(early.findings.map((f) => f.line), [1, 3]);
});

test("ignore, only and the inline directive reach the commit rules", () => {
  const text = "As part of this change, move the cache.\n";
  assert.deepEqual([...idsOf(text)], ["commit-overexplanation"]);
  assert.deepEqual(lintCommitMessage("m", text, { ignore: ["commit-overexplanation"] }).findings, []);
  assert.deepEqual(lintCommitMessage("m", text, { only: ["dash"] }).findings, []);
  assert.deepEqual(lintCommitMessage("m", `<!-- slop-ignore commit-overexplanation -->\n${text}`).findings, []);
});

test("phrase tokens are matched as literal text: metacharacters are escaped and the match is on word boundaries", () => {
  assert.equal(escapeRegExp("a.b (c)?"), "a\\.b \\(c\\)\\?");
  const id = "commit-test-escape";
  PHRASES[id] = { source: "test", ignorecase: false, tokens: ["a.b", "which makes it easier"] };
  try {
    const pattern = phrasePattern(id);
    assert.ok(new RegExp(pattern.source).test("so a.b is the key"));
    assert.ok(!new RegExp(pattern.source).test("so axb is the key"), "the dot must not match any character");
    assert.ok(!new RegExp(pattern.source).test("xa.b is the key"), "a token must start on a word boundary");
    assert.ok(new RegExp(pattern.source).test("which makes it easier to read"));
  } finally {
    delete PHRASES[id];
  }
});

test("words are matched on boundaries and trailers are left alone", () => {
  assert.ok(!idsOf("Xas part of this change, move the cache\n").has("commit-overexplanation"));
  assert.ok(idsOf("as part of this change, move the cache\n").has("commit-overexplanation"));
});

test("trailer lines are not read as prose: a token that matches trailer text is injected and proven live", () => {
  // No shipped token matches trailer text, so the injection is what gives this test its bite.
  // The injected token must fire on an ordinary line, or the injection itself is not live.
  const id = "commit-marketing";
  const original = PHRASES[id]!;
  PHRASES[id] = { ...original, tokens: [...original.tokens, "Opus"] };
  try {
    const trailers = [
      "Fix the retry",
      "",
      "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>",
      "Signed-off-by: A B <a@b.c>",
      "Fixes: #12",
      "Generated with [Claude Code](https://claude.com/claude-code)",
      "",
    ].join("\n");
    assert.deepEqual(lintCommitMessage("m", trailers).findings, []);
    const prose = lintCommitMessage("m", "Opus is the model used for this change.\n");
    assert.ok(prose.findings.some((f) => f.rule === "commit-marketing"), "the injected token must fire on an ordinary line");
  } finally {
    PHRASES[id] = original;
  }
});

test("every commit rule is a warning", () => {
  for (const r of commitRules) assert.equal(r.severity, "warning", r.id);
});

test("the attribution of the borrowed phrase lists survives in the shipped file", () => {
  const header = readFileSync(join(process.cwd(), "src", "commit-phrases.ts"), "utf8").slice(0, 2500);
  assert.match(header, /Copyright \(c\) 2025-2026 Tony Burns/);
  assert.match(header, /MIT License/);
  assert.match(header, /The above copyright notice and this permission notice shall be included/);
  assert.match(header, /51f646e366ba7c9dcb078ebeae345b7ff353eb3b/);
});
