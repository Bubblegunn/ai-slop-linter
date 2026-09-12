/**
 * What `--fix` is allowed to touch, checked over every committed corpus rather than over one
 * fixture. Issue #15.
 *
 * Three of the twenty rules produce a fix: `dash` (a character swap, or a dash dropped after
 * sentence-final punctuation), `curly-quotes` (a character swap) and `filler` (the only one
 * that deletes or substitutes words). So the surface these tests have to cover is small, and
 * the point of them is that it stays small.
 *
 * The protected-field checks reuse `prepare(...).masked` from src/doc.ts instead of carrying
 * their own idea of where code lives. That is deliberate: a second list of exclusions would
 * drift from the one the rules actually run against, and then the test would pass while the
 * fixer edited a fenced block.
 *
 * WHAT THESE TESTS DO NOT PROVE
 *
 * - **Not that a fix cannot change meaning.** They are byte-level and span-level invariants.
 *   Byte invariance outside a reported span is not semantic equivalence inside it. CONTRIBUTING.md
 *   says a fix is only allowed when applying it "cannot change meaning"; nothing here establishes
 *   that, and it should not be read as establishing it.
 * - **Not that punctuation is neutral.** Replacing an em dash with a comma keeps every word and
 *   still moves the emphasis of the sentence: "Rates rose, sharply, in May" is not the parenthetical
 *   aside the dash wrote. The word-sequence check is blind to that by construction.
 * - **Not that the filler substitutions are synonyms.** "in order to" to "to" and "due to the fact
 *   that" to "because" are judgements made in `FILLERS` (src/rules/vocabulary.ts). These tests only
 *   check that no word changes except the ones a reported `filler` finding could account for.
 * - **Not that the fixed text reads better.** Nothing here measures quality; see issue #16, which
 *   needs human readers and has none yet.
 * - **Not anything about a rule with no fix.** Seventeen rules report and never rewrite, so they
 *   cannot be unsafe in this sense and are not exercised here.
 * - **Not coverage of text unlike these files.** Fifteen documents, all Markdown, almost all
 *   English. A protected construct that appears in none of them is untested.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { applyFixes, fixText, lintText, prepare } from "../src/index.js";
import type { Finding } from "../src/index.js";

const ROOT = join(import.meta.dirname, "..", "..");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
const mdIn = (dir: string) =>
  readdirSync(join(ROOT, dir))
    .filter((f) => f.endsWith(".md"))
    .sort()
    .map((f) => `${dir}/${f}`);

/** Every document the repository commits as input to the rules. */
const DOCUMENTS = [...mdIn("bench/corpus/human"), ...mdIn("bench/corpus/machine"), ...mdIn("test/fixtures")];

/**
 * The content of every masked region, in order, with its spaces dropped. Masked regions are
 * blanked to spaces of the same length by `prepare`, and newlines are kept, so a character is
 * inside one exactly when the mask holds a space where the text holds something else.
 *
 * This is the whole protected set at once: front matter, fenced blocks (including a fence inside
 * a blockquote), indented code, inline code, link targets, bare URLs, HTML tags and the contents
 * of `pre` and `code`.
 */
function protectedText(text: string): string {
  const masked = prepare("x.md", text).masked;
  let out = "";
  for (let i = 0; i < text.length; i++) if (masked[i] === " " && text[i] !== " ") out += text[i];
  return out;
}

/**
 * Words, with curly apostrophes folded to straight ones. The fold is the point: `curly-quotes`
 * swaps the character inside a word, so `it’s` and `it's` have to count as the same word for the
 * word-sequence check to be about words rather than about typography.
 */
const WORD = /[\p{L}\p{M}\p{N}'’]+/gu;
const words = (text: string): string[] => text.replace(/[‘’]/g, "'").match(WORD) ?? [];

/**
 * The words a reported `filler` finding could legitimately have added or removed: the words of
 * the phrase it matched, and the words of the replacement it proposed. Both are read back out of
 * the finding itself rather than restated here, so this does not become a second copy of FILLERS.
 */
function fillerVocabulary(texts: string[]): Set<string> {
  const out = new Set<string>();
  for (const text of texts) {
    for (const f of lintText("x.md", text).findings) {
      if (f.rule !== "filler" || !f.fix) continue;
      const matched = /^"(.*?)":/.exec(f.message)?.[1] ?? "";
      for (const w of words(matched)) out.add(w.toLowerCase());
      for (const w of words(f.fix.replacement)) out.add(w.toLowerCase());
    }
  }
  return out;
}

const fixable = (findings: Finding[]) => findings.filter((f) => f.fix);

/** The two passes `fixText` runs, so a test can see the findings of each. */
function passes(path: string, text: string): { first: Finding[]; second: Finding[]; fixed: string } {
  const first = lintText(path, text).findings;
  const mid = applyFixes(text, first).text;
  const second = lintText(path, mid).findings;
  return { first, second, fixed: fixText(path, text).text };
}

test("a fix span never covers a masked character", () => {
  // Structural, and worth pinning: every fix comes from `scan()` over `doc.masked`, so a fix that
  // reached into a fenced block would mean the masking had failed rather than that the fixer had
  // misbehaved. Whitespace inside the span is exempt because the `dash` pattern deliberately
  // swallows the spaces around the mark.
  for (const rel of DOCUMENTS) {
    const text = read(rel);
    const doc = prepare(rel, text);
    for (const f of fixable(lintText(rel, text).findings)) {
      for (let i = f.fix!.start; i < f.fix!.end; i++) {
        const ch = text[i]!;
        if (/\s/.test(ch)) continue;
        assert.equal(doc.masked[i], ch, `${rel}: ${f.rule} at ${f.line}:${f.column} covers masked offset ${i}`);
      }
    }
  }
});

test("fixing leaves every masked region byte-identical", () => {
  for (const rel of DOCUMENTS) {
    const text = read(rel);
    const fixed = fixText(rel, text).text;
    assert.equal(protectedText(fixed), protectedText(text), `${rel}: content inside code, front matter or a link target changed`);
  }
});

test("fixing changes only lines a finding reported a fix on", () => {
  for (const rel of DOCUMENTS) {
    const text = read(rel);
    const { first, second, fixed } = passes(rel, text);
    const before = text.split("\n");
    const after = fixed.split("\n");
    // No fix replacement contains a newline and no fix pattern crosses one, so a changed line
    // count would mean the fixer had moved text between lines.
    assert.equal(after.length, before.length, `${rel}: fixing changed the number of lines`);
    const reported = new Set([...fixable(first), ...fixable(second)].map((f) => f.line));
    for (let i = 0; i < before.length; i++) {
      if (before[i] === after[i]) continue;
      assert.ok(reported.has(i + 1), `${rel}: line ${i + 1} changed with no fixable finding on it\n  before: ${JSON.stringify(before[i])}\n  after:  ${JSON.stringify(after[i])}`);
    }
  }
});

test("fixing changes no word except the ones a filler finding accounts for", () => {
  for (const rel of DOCUMENTS) {
    const text = read(rel);
    const fixed = fixText(rel, text).text;
    const drop = fillerVocabulary([text, fixed]);
    const keep = (t: string) => words(t).filter((w) => !drop.has(w.toLowerCase()));
    // With no filler fix in the file the vocabulary is empty and this is the exact sequence of
    // every word, unchanged: `dash` and `curly-quotes` may only touch punctuation. With one, the
    // check is weaker by exactly the words those phrases use, which is the honest bound.
    assert.deepEqual(keep(fixed), keep(text), `${rel}: the word sequence moved outside the filler substitutions`);
  }
});

test("fixing is idempotent: fixing a fixed document changes nothing", () => {
  for (const rel of DOCUMENTS) {
    const text = read(rel);
    const once = fixText(rel, text);
    const twice = fixText(rel, once.text);
    assert.equal(twice.text, once.text, `${rel}: not a fixed point`);
    assert.equal(twice.applied, 0, `${rel}: applied ${twice.applied} more fixes on a fixed document`);
  }
});

test("every protected field survives a document whose only unprotected tell is one dash", () => {
  // One document, every protected construct, each carrying an em dash, a curly quote and a filler
  // phrase, and exactly one line of real prose. The per-corpus tests above prove the invariant
  // holds; this one names the fields, so a masking regression says which construct broke.
  const fields: [string, string][] = [
    ["YAML front matter", "title: In order to — “quote” in front matter"],
    ["inline code", "Inline `in order to — “inline”` stays."],
    ["link target", "A link [the guide](https://example.com/a—b?q=“x”) stays."],
    ["bare URL", "A bare URL https://example.com/b—c?q=“y” stays."],
    ["fenced block", "in order to — “fence”"],
    ["indented code", "    in order to — “indented”"],
    ["fence in a blockquote", "> in order to — “quoted fence”"],
    ["pre block", "in order to — “pre”"],
  ];
  const doc = [
    "---",
    fields[0]![1],
    "---",
    "",
    "# Protected fields",
    "",
    fields[1]![1],
    "",
    fields[2]![1],
    "",
    fields[3]![1],
    "",
    "```",
    fields[4]![1],
    "```",
    "",
    fields[5]![1],
    "",
    "> ```",
    fields[6]![1],
    "> ```",
    "",
    "<pre>",
    fields[7]![1],
    "</pre>",
    "",
    "Prose here — the one real finding.",
    "",
  ].join("\n");

  const r = fixText("protected.md", doc);
  for (const [name, line] of fields) {
    assert.ok(r.text.includes(line), `${name} was rewritten: the fixer reached into it`);
  }
  assert.equal(r.applied, 1, `only the prose dash is fixable here, got ${r.applied}: ${JSON.stringify(r.text)}`);
  assert.ok(r.text.includes("Prose here, the one real finding."), r.text);

  const before = doc.split("\n");
  const after = r.text.split("\n");
  const changed = before.map((l, i) => (l === after[i] ? null : i)).filter((i) => i !== null);
  assert.deepEqual(changed, [before.indexOf("Prose here — the one real finding.")], "more than the prose line changed");
});

test("the fixable surface is three rules, and only one of them touches words", () => {
  // Not a behaviour assertion so much as a tripwire. These tests are sized to `dash`,
  // `curly-quotes` and `filler`; a fourth fixable rule, or a fix on a rule that rewrites words,
  // needs its own protected-field and word-sequence reasoning rather than inheriting theirs.
  const seen = new Set<string>();
  for (const rel of DOCUMENTS) for (const f of fixable(lintText(rel, read(rel)).findings)) seen.add(f.rule);
  // Every fixable rule the corpora reach must be one this file reasoned about.
  for (const id of seen) assert.ok(["dash", "curly-quotes", "filler"].includes(id), `${id} produces a fix and is not covered by test/fixer-safety.test.ts`);
  // And the corpora do reach all three, so the tests above are not vacuous.
  assert.deepEqual([...seen].sort(), ["curly-quotes", "dash", "filler"]);
});
