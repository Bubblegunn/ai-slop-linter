import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { lintText, fixText, rules, gradeFor, prepare, rulesFor, languageRules, checkLanguagePack, countWords } from "../src/index.js";

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

test("word count: a word is a word in every script", () => {
  // The old counter matched [A-Za-z0-9'’]+, so a run of Japanese was one token and a
  // Turkish word split at every non-ASCII letter. A 3,300 character Japanese document
  // counted as one word and was pinned at F whatever its length.
  const count = (s: string) => prepare("x.md", s).words;

  // Scripts that separate words are tokenised, and a word keeps its accents.
  assert.equal(count("the quick brown fox"), 4);
  assert.equal(count("naïve café résumé"), 3);
  assert.equal(count("değişiklik güncelleştirme çalışması İstanbul'da yapıldı"), 5);
  assert.equal(count("한국어 문서 예시"), 3);
  assert.equal(count("מסמך בעברית כאן"), 3);
  assert.equal(count("مستند بالعربية هنا"), 3);

  // Scripts that do not separate words are segmented, so length counts for something.
  const ja = "これは日本語の文書です。読みやすさを測るための文章を書いています。";
  const zh = "这是一个中文文档，用于测试分词是否正确地工作。";
  assert.ok(count(ja) >= 10, `japanese counted ${count(ja)}`);
  assert.ok(count(zh) >= 8, `chinese counted ${count(zh)}`);
  // Twice the text is about twice the words, which is what the old counter could not do.
  assert.ok(count(ja + ja) > count(ja) * 1.5, `${count(ja + ja)} vs ${count(ja)}`);

  // Latin and Japanese mixed in one line: both halves are counted.
  assert.ok(count(`the CLI 使い方 guide`) >= 4);
});

test("a segmenter without the dictionary for a script falls back to the estimate", () => {
  // Intl.Segmenter existing is not the same as ICU carrying word dictionaries: a Node built
  // with small ICU constructs the segmenter and then returns the whole run as one segment,
  // which is the "a Japanese document is one word" bug again, without a symptom. So the
  // result is checked per run rather than trusted.
  const noDictionary = {
    segment: (s: string) => [{ segment: s, index: 0, input: s, isWordLike: true }],
  } as unknown as Intl.Segmenter;
  const japanese = "経理担当者が一か月分の予約を表計算ファイルとして取得できます";
  assert.equal(countWords(japanese, noDictionary), Math.ceil([...japanese].length / 2));
  assert.ok(countWords(japanese, noDictionary) > 5, "a long run must never count as one word");
  // A real segmenter still decides for itself, and a short run it calls one word stays one.
  assert.ok(countWords(japanese) > 5);
  assert.equal(countWords("東京", noDictionary), 1);
});

test("language packs are off unless asked for, and a pack has to be well formed", () => {
  // No pack ships yet; issue #1 tracks the first. The mechanism is tested with a stand-in so
  // the infrastructure is proven without inventing rules for a language nobody sourced.
  assert.deepEqual(Object.keys(languageRules), []);
  assert.deepEqual(rulesFor(), rules, "English is the whole set when nothing is asked for");
  assert.throws(() => rulesFor(["zz"]), /no rule pack for "zz"/);

  const stand_in = {
    id: "zz/greeting",
    title: "Greeting residue",
    severity: "warning" as const,
    source: "A style guide that would be named here",
    why: "why",
    example: { before: "b", after: "a" },
    ignoreWhen: "when",
    check: () => [],
  };
  assert.deepEqual(checkLanguagePack("zz", [stand_in]), []);
  assert.deepEqual(checkLanguagePack("zz", []), ["zz: the pack is empty"]);
  assert.deepEqual(checkLanguagePack("zz", [{ ...stand_in, id: "greeting" }]), [
    "greeting: a rule in the zz pack needs the id zz/greeting",
  ]);
  assert.deepEqual(checkLanguagePack("zz", [{ ...stand_in, source: "  " }]), ["zz/greeting: every rule carries a source"]);
  assert.deepEqual(checkLanguagePack("zz", [{ ...stand_in, id: "dash" }]), [
    "dash: a rule in the zz pack needs the id zz/dash",
    "dash: an English rule already has this id",
  ]);

  try {
    languageRules.zz = [stand_in];
    assert.equal(rulesFor(["zz"]).length, rules.length + 1);
    // Asking for the pack does not change what an English-only run sees.
    assert.deepEqual(rulesFor(), rules);
  } finally {
    delete languageRules.zz;
  }
});

test("dash rule: a nested list marker is a bullet, not a dash", () => {
  // An ordinary nested bullet list is a hyphen preceded only by indentation. Reading it as a
  // spaced hyphen gave every README with a nested list three errors and an F, which is the
  // complaint a launch thread would have led with.
  const nested = "- top level\n  - two space nested\n    - four space nested\n\n1. ordered\n   - nested under ordered\n\n* star\n  * star nested\n";
  const dashes = lintText("n.md", nested).findings.filter((f) => f.rule === "dash");
  assert.deepEqual(dashes, [], JSON.stringify(dashes));

  // A hyphen with words on both sides is still the tell the rule exists for.
  const prose = lintText("p.md", "Rates rose - sharply - in May.\n").findings.filter((f) => f.rule === "dash");
  assert.equal(prose.length, 2, JSON.stringify(prose));
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

test("curly quotes: a consistently typographic document is left alone, a mixed one is flagged", () => {
  // Nineteenth-century prose and anything typeset properly uses curly marks throughout.
  const typographic = "\u201CI am not afraid,\u201D she said. \u201CIt\u2019s the waiting that tires me.\u201D";
  assert.equal(lintText("book.md", typographic).findings.filter((f) => f.rule === "curly-quotes").length, 0);
  // A repository file that otherwise uses straight marks: the curly ones were pasted in.
  const mixed = "The flag is \"--fix\" and it's safe. The model said \u201Cthis is fine\u201D about it.";
  const found = lintText("README.md", mixed).findings.filter((f) => f.rule === "curly-quotes");
  assert.equal(found.length, 2, JSON.stringify(found));
});

test("not-x-but-y catches the contracted forms, which are the common ones", () => {
  assert.ok(idsIn("DataFlow isn't just another library, it's a paradigm shift.").has("not-x-but-y"));
  assert.ok(idsIn("This doesn't just save time, but it changes the workflow.").has("not-x-but-y"));
  assert.ok(idsIn("The change wasn't only about speed, it was about clarity.").has("not-x-but-y"));
  assert.ok(!idsIn("The build isn't green yet.").has("not-x-but-y"));
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
  assert.ok(r.score !== null && r.score > 30);

  // Under the floor the denominator is small enough that one finding decides the letter,
  // so the document is not graded rather than given an invented F. The findings stand.
  const short = lintText("t.md", "Let's dive in.");
  assert.equal(short.score, null);
  assert.equal(short.grade, null);
  assert.equal(short.findings.length, 1);

  // Just over the floor it is graded again.
  const long = lintText("u.md", `${"word ".repeat(60)}Let's dive in.`);
  assert.ok(long.words >= 50);
  assert.equal(typeof long.score, "number");
});

test("prepare counts words on the masked text and records ignore directives", () => {
  const d = prepare("p.md", "---\ntitle: x\n---\nOne two `three` four https://a.b/c\n<!-- slop-ignore foo, bar -->\n");
  assert.equal(d.words, 3);
  assert.deepEqual([...d.ignoredRules.keys()], ["foo", "bar"]);
});

test("masking is linear: thousands of unclosed openers do not make prepare quadratic", () => {
  const hostile = "<!-- ".repeat(20000) + "](" .repeat(20000) + "<a ".repeat(20000);
  const t0 = performance.now();
  const d = prepare("h.md", hostile);
  assert.ok(performance.now() - t0 < 1000, "prepare took too long on crafted input");
  assert.equal(d.masked.length, hostile.length);
  const normal = "See [the guide](https://x.y/z) and <b>bold</b> <!-- note --> plus `code`.";
  const m = prepare("n.md", normal).masked;
  assert.equal(m.length, normal.length);
  assert.ok(!m.includes("https://x.y/z") && !m.includes("note") && !m.includes("<b>") && !m.includes("code"));
  assert.ok(m.includes("the guide") && m.includes("bold"));
});

test("every rule carries the material --explain prints", () => {
  for (const r of rules) {
    assert.ok(r.why && r.why.length > 40, `${r.id} has no why`);
    assert.ok(r.example?.before && r.example.after, `${r.id} has no before/after example`);
    assert.notEqual(r.example.before, r.example.after, `${r.id} example does not change`);
    assert.ok(r.ignoreWhen && r.ignoreWhen.length > 20, `${r.id} does not say when to ignore it`);
    // The example must actually trip the rule it illustrates.
    const ids = new Set(lintText("example.md", r.example.before).findings.map((f) => f.rule));
    assert.ok(ids.has(r.id), `${r.id}: its own before example does not trip it`);
  }
});

test("filler: \"in order to\" is the padded infinitive, not \"in order\" followed by \"to\"", () => {
  assert.ok(idsIn("In order to run the tests, install the dependencies.").has("filler"));
  assert.ok(!idsIn("Overrides are applied in order to any file whose path matches.").has("filler"));
  assert.ok(!idsIn("The steps run in order to the end of the list.").has("filler"));
});

test("code quoted by indentation, inside a blockquote or in an HTML block is masked", () => {
  const text = fixture("quoted-code.md");
  const r = lintText("quoted-code.md", text);
  const lines = text.split("\n");
  for (const f of r.findings) {
    const line = lines[f.line - 1] ?? "";
    assert.ok(
      !/^(?: {4}|\t|>|<pre)/.test(line) && !/^title = /.test(line),
      `${f.rule} fired inside quoted code at line ${f.line}: ${JSON.stringify(line)}`,
    );
  }
  // Prose after the blocks is not code, and its spaced hyphen still counts.
  const proseLine = lines.findIndex((l) => l.startsWith("Prose outside every block")) + 1;
  assert.ok(r.findings.some((f) => f.rule === "dash" && f.line === proseLine), "masking swallowed prose outside the blocks");
});

test("masking survives CRLF line endings, which is how the fixture arrives on Windows", () => {
  const crlf = fixture("quoted-code.md").replace(/\r?\n/g, "\r\n");
  const r = lintText("quoted-code.md", crlf);
  const lines = crlf.split("\r\n");
  const proseLine = lines.findIndex((l) => l.startsWith("Prose outside every block")) + 1;
  assert.ok(r.findings.some((f) => f.rule === "dash" && f.line === proseLine), "a fence failed to close on CRLF and swallowed the rest");
  for (const f of r.findings) {
    assert.ok(!/^(?: {4}|\t|>|<pre)/.test(lines[f.line - 1] ?? ""), `${f.rule} fired inside quoted code at line ${f.line}`);
  }
});

test("a declared language stands the English typography rule down", () => {
  // Measured in bench/TYPOGRAPHY.md: `dash` fires 73.5 times per 1,000 words on correct
  // Polish, 52.1 on Hungarian and 24.0 on Russian, against 1.0 on the English baseline,
  // because the mark is ordinary punctuation there and in Russian stands in for the verb.
  // The language is configuration, never a guess: a README with English headings over
  // French prose defeats detection in both directions.
  const french = "Le service — celui-ci — permet aux clients de voir leur commande.";
  const asEnglish = lintText("README.md", french);
  assert.equal(asEnglish.findings.filter((f) => f.rule === "dash").length, 2);
  assert.deepEqual(asEnglish.stoodDown, []);

  const declared = lintText("README.md", french, { language: "fr" });
  assert.deepEqual(declared.findings, []);
  assert.deepEqual(declared.stoodDown, ["dash"]);

  // English is the default and every English tag keeps the rule on.
  for (const tag of ["en", "en-GB", "EN_us"]) {
    assert.equal(lintText("README.md", french, { language: tag }).findings.length, 2, tag);
  }
  // Only rules whose evidence is English stand down; the rest still run.
  const mixed = lintText("README.md", "Nous allons dive right in — c'est parti. Let's dive in.", { language: "fr" });
  assert.ok(mixed.findings.every((f) => f.rule !== "dash"));
});

test("curly quotes are judged against the straight form of their own family", () => {
  // Chinese quotes with the curly double marks and nests straight apostrophes inside them,
  // which is correct Chinese and not a paste artifact. Judging both families together
  // reported every quotation mark in the file: 21.7 per 1,000 words on the Chinese text in
  // bench/TYPOGRAPHY.md, now zero.
  const chinese = "他说：“这是 'a' 的意思。”我们照做了。";
  assert.deepEqual(lintText("zh.md", chinese).findings.filter((f) => f.rule === "curly-quotes"), []);
  // The English case the rule was written for still fires: straight and curly doubles mixed.
  const pasted = 'The flag is "--fix". The model said “this is fine” about it.';
  assert.equal(lintText("README.md", pasted).findings.filter((f) => f.rule === "curly-quotes").length, 2);
  // And the apostrophe family on its own.
  const apostrophes = "it's here and it’s there";
  assert.equal(lintText("README.md", apostrophes).findings.filter((f) => f.rule === "curly-quotes").length, 1);
});

test("hyphen-density counts compounds in any alphabet", () => {
  // The pattern was [a-z]+-[a-z]+, so "peut-être" and every other non-ASCII compound was
  // invisible and the rule quietly did nothing outside English.
  const words = Array.from({ length: 120 }, (_, i) => `mot${i}`).join(" ");
  const compounds = Array.from({ length: 8 }, () => "peut-être").join(" ");
  const found = lintText("fr.md", `${compounds} ${words}`).findings.filter((f) => f.rule === "hyphen-density");
  assert.equal(found.length, 1, JSON.stringify(found));
});
