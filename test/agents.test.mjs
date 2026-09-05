import { test } from "node:test";
import assert from "node:assert/strict";
import { declaresAgent, trailerBlock, splitCommits, pairedOnly, ratesByRule } from "../bench/agents.mjs";

test("a commit declares an agent through a trailer, an author name, or a bot address", () => {
  assert.equal(declaresAgent({ name: "Efe Genc", email: "e@example.com", message: "fix: thing\n\nCo-Authored-By: Claude <noreply@anthropic.com>" })?.signal, "trailer");
  assert.equal(declaresAgent({ name: "Efe Genc", email: "e@example.com", message: "fix: thing\n\nCo-authored-by: Copilot <copilot@users.noreply.github.com>" })?.signal, "trailer");
  assert.equal(declaresAgent({ name: "Bob (aider)", email: "b@example.com", message: "fix: thing" })?.signal, "author-name");
  assert.equal(declaresAgent({ name: "Devin", email: "devin-ai-integration[bot]@users.noreply.github.com", message: "fix: thing" })?.signal, "author-email");
  assert.equal(declaresAgent({ name: "Efe Genc", email: "e@example.com", message: "fix: thing\n\nCo-Authored-By: Ada Lovelace <ada@example.com>" }), null);
  assert.equal(declaresAgent({ name: "Efe Genc", email: "e@example.com", message: "fix: a plain message" }), null);
});

test("a dependency bot is not an agent, because its messages are a template and not prose", () => {
  // Counting dependabot would measure a template that never changes and report it as a
  // habit models have. The question is about writing, so only writing agents count.
  assert.equal(declaresAgent({ name: "dependabot[bot]", email: "49699333+dependabot[bot]@users.noreply.github.com", message: "chore(deps): bump x from 1 to 2" }), null);
  assert.equal(declaresAgent({ name: "renovate[bot]", email: "renovate[bot]@users.noreply.github.com", message: "chore(deps): update x" }), null);
});

test("a trailer quoted inside prose is not a trailer, so it does not declare anything", () => {
  // The same rule stripTrailers uses: only the contiguous block at the end is a trailer.
  // Without this, a message explaining the convention would be counted as an agent's.
  const quoted = "docs: explain the convention\n\nWe ask contributors to add\nCo-Authored-By: Claude <noreply@anthropic.com>\nwhen an agent helped.\n";
  assert.equal(trailerBlock(quoted), "");
  assert.equal(declaresAgent({ name: "Efe Genc", email: "e@example.com", message: quoted }), null);
});

test("splitting keeps the two sides disjoint and strips the label before counting", () => {
  const commits = [
    { name: "Efe Genc", email: "e@example.com", message: "feat: add a thing\n\nIt does the thing.\n\nCo-Authored-By: Claude <noreply@anthropic.com>" },
    { name: "Efe Genc", email: "e@example.com", message: "fix: a plain message\n\nOne sentence of why." },
  ];
  const { declared, undeclared } = splitCommits(commits);
  assert.equal(declared.length, 1);
  assert.equal(undeclared.length, 1);
  // The trailer is the label. Measuring it would report a difference that exists by
  // construction, so the text handed to the linter must not contain it.
  assert.ok(!declared[0].text.includes("Co-Authored-By"));
  assert.match(declared[0].text, /It does the thing\./);
});

test("a repository with only one side is dropped, and says why", () => {
  const perRepo = [
    { repo: "both", declared: [{ text: "a" }], undeclared: [{ text: "b" }] },
    { repo: "declared-only", declared: [{ text: "a" }], undeclared: [] },
    { repo: "undeclared-only", declared: [], undeclared: [{ text: "b" }] },
  ];
  const { kept, dropped } = pairedOnly(perRepo);
  assert.deepEqual(kept.map((r) => r.repo), ["both"]);
  assert.deepEqual(
    dropped.map((r) => `${r.repo}: ${r.reason}`),
    ["declared-only: no undeclared commits", "undeclared-only: no declared commits"],
  );
});

test("rates are per 1,000 words on each side, with the counts that produced them", () => {
  const rows = ratesByRule({
    declared: { words: 2000, rules: new Map([["dash", 4]]) },
    undeclared: { words: 1000, rules: new Map([["dash", 1]]) },
  });
  const dash = rows.find((r) => r.rule === "dash");
  assert.equal(dash.declaredCount, 4);
  assert.equal(dash.undeclaredCount, 1);
  assert.equal(dash.declaredPer1000, 2);
  assert.equal(dash.undeclaredPer1000, 1);
  assert.equal(dash.ratio, 2);
});

test("a rule absent from one side reports no ratio rather than infinity", () => {
  const rows = ratesByRule({
    declared: { words: 1000, rules: new Map([["chatbot", 3]]) },
    undeclared: { words: 1000, rules: new Map() },
  });
  const chatbot = rows.find((r) => r.rule === "chatbot");
  assert.equal(chatbot.undeclaredPer1000, 0);
  // A ratio against zero is not a number anyone should quote, and printing Infinity in a
  // table invites exactly that.
  assert.equal(chatbot.ratio, null);
});
