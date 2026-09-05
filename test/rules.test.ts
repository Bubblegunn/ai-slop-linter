import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { lintText, fixText, rules, gradeFor, prepare } from "../src/index.js";

const fixture = (name: string) => readFileSync(join(import.meta.dirname, "..", "..", "test", "fixtures", name), "utf8");
const sloppy = fixture("sloppy.md");
const clean = fixture("clean.md");

const idsIn = (text: string) => new Set(lintText("x.md", text).findings.map((f) => f.rule));

test("every rule fires at least once on the sloppy fixture", () => {
  const ids = idsIn(sloppy);
  for (const r of rules) assert.ok(ids.has(r.id), `rule ${r.id} did not fire on the fixture`);
});

test("the clean fixture has no error-severity findings and grades A", () => {
  const r = lintText("clean.md", clean);
  assert.equal(r.errors, 0, JSON.stringify(r.findings, null, 2));
  assert.equal(r.grade, "A", `score ${r.score}: ${JSON.stringify(r.findings)}`);
});

test("masking: patterns inside code blocks, inline code, URLs and front matter are not flagged", () => {
  const r = lintText("s.md", sloppy);
  const codeLines = new Set<number>();
  sloppy.split("\n").forEach((l, i) => {
    if (/this — is code|code — with a dash|example\.com|^title:/.test(l)) codeLines.add(i + 1);
  });
  for (const f of r.findings) assert.ok(!codeLines.has(f.line) || f.rule === "dash" && !/code|example|title/.test(f.excerpt), `${f.rule} fired on masked line ${f.line}: ${f.excerpt}`);
  // the fenced block line with "let's dive in" must not produce an announcing finding
  assert.ok(!r.findings.some((f) => f.rule === "announcing" && f.excerpt.includes("is code")));
});

test("dash rule: fixes between words to a comma, drops after punctuation, leaves ranges and line-opening dashes", () => {
  const r = fixText("d.md", "Rates rose — sharply — in May. 2019–2021 was flat.\n— A line that opens with a dash\nThe end—\n");
  assert.equal(r.text, "Rates rose, sharply, in May. 2019–2021 was flat.\n— A line that opens with a dash\nThe end.\n");
  const left = r.result.findings.filter((f) => f.rule === "dash");
  assert.equal(left.length, 1, JSON.stringify(left));
  assert.equal(left[0]?.line, 2);
  assert.equal(left[0]?.fix, undefined);
});

test("fixes are idempotent: fixing twice equals fixing once", () => {
  const once = fixText("s.md", sloppy);
  const twice = fixText("s.md", once.text);
  assert.equal(twice.text, once.text);
  assert.equal(twice.applied, 0);
  const prose = once.text.split("\n").filter((l) => !/is code|with a dash|example\.com/.test(l)).join("\n");
  assert.ok(!prose.includes("—"), "em dashes outside code are gone");
  assert.ok(once.text.includes("this — is code"), "code blocks are left alone");
  assert.ok(!/[“”‘’]/.test(once.text));
  assert.ok(/\bto achieve this\b/i.test(once.text) && !/in order to/i.test(once.text));
});

test("not-x-but-y catches the three shapes and leaves plain contrast alone", () => {
  assert.ok(idsIn("It's not just a tool, but a habit.").has("not-x-but-y"));
  assert.ok(idsIn("It's not a manual. It's a promise.").has("not-x-but-y"));
  assert.ok(idsIn("We did this not because it was easy, because it was needed.").has("not-x-but-y"));
  assert.ok(!idsIn("The test is not green, but the build passes.").has("not-x-but-y"));
});

test("triad flags parallel single words with a shared suffix and ignores plain lists", () => {
  assert.ok(idsIn("Be careful, thoughtful, and mindful.").has("triad"));
  assert.ok(!idsIn("We ship web, mobile, and backend code.").has("triad"));
  assert.ok(!idsIn("Bring bread, cheese and wine.").has("triad"));
});

test("vague-source is silent when the line carries a link", () => {
  assert.ok(idsIn("Studies show the effect is small.").has("vague-source"));
  assert.ok(!idsIn("Studies show the effect is small ([Smith 2024](https://example.org/x)).").has("vague-source"));
});

test("title-case headings are flagged, sentence case and ALL CAPS are not", () => {
  assert.ok(idsIn("## Strategic Negotiations And Global Partnerships\n").has("title-case-heading"));
  assert.ok(!idsIn("## Strategic negotiations and global partnerships\n").has("title-case-heading"));
  assert.ok(!idsIn("## FAQ AND NOTES\n").has("title-case-heading"));
});

test("inline directives suppress findings", () => {
  const next = "<!-- slop-ignore-next-line -->\nLet's dive in — now.\n";
  assert.equal(lintText("i.md", next).findings.length, 0);
  const rule = "<!-- slop-ignore dash -->\nA — B\nLet's dive in\n";
  const ids = idsIn(rule);
  assert.ok(!ids.has("dash") && ids.has("announcing"));
  const nextRule = "<!-- slop-ignore-next-line announcing -->\nLet's dive in — now.\n";
  const ids2 = idsIn(nextRule);
  assert.ok(ids2.has("dash") && !ids2.has("announcing"));
});

test("score and grade thresholds", () => {
  assert.equal(gradeFor(0), "A");
  assert.equal(gradeFor(2.9), "A");
  assert.equal(gradeFor(3), "B");
  assert.equal(gradeFor(14.9), "C");
  assert.equal(gradeFor(30), "F");
  const r = lintText("s.md", sloppy);
  assert.equal(r.grade, "F");
  assert.ok(r.score > 30);
  const short = lintText("t.md", "Let's dive in.");
  // 50-word floor: one warning over 50 words = 20 per thousand
  assert.equal(short.score, 20);
});

test("prepare counts words on the masked text and records ignore directives", () => {
  const d = prepare("p.md", "---\ntitle: x\n---\nOne two `three` four https://a.b/c\n<!-- slop-ignore foo, bar -->\n");
  assert.equal(d.words, 3);
  assert.deepEqual([...d.ignoredRules.keys()], ["foo", "bar"]);
});
