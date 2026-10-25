import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { commitRules } from "../dist/src/commits.js";
import { lintText, rules } from "../dist/src/index.js";

// The linter reads a `slop-ignore` comment on any line, including one that a README shows as an
// example inside a code block. An example that names a real rule therefore switches that rule off
// for the rest of the file. The README did this: after its Configuration example the `dash` and
// `emoji` rules were off for the last third of the file, so "grade A" said less than it seemed to.
// Examples use a placeholder (`RULE`), and these tests prove the rules are on at the end of each file.
const FILES = ["README.md", "README.tr.md", "CONTRIBUTING.md", ...readdirSync("docs").filter((f) => f.endsWith(".md")).map((f) => `docs/${f}`)];
const IDS = new Set([...rules, ...commitRules].map((r) => r.id));
// The same id grammar the scanner in src/doc.ts accepts, so this guard scans everything the
// scanner treats as a directive.
const DIRECTIVE = /<!--\s*slop-ignore(?:-next-line)?\s+([-\w,\s/]+?)\s*-->/g;

for (const file of FILES) {
  test(`${file}: no ignore comment names a real rule`, () => {
    const named = [];
    for (const m of readFileSync(file, "utf8").matchAll(DIRECTIVE)) for (const id of m[1].split(/[,\s]+/)) if (IDS.has(id)) named.push(id);
    assert.deepEqual(named, [], `${file} switches off ${named.join(", ")}`);
  });
}

test("a dash added at the end of the README and of the Turkish README is still found", () => {
  for (const file of ["README.md", "README.tr.md"]) {
    const text = `${readFileSync(file, "utf8")}\nA dash — here.\n`;
    assert.ok(lintText(file, text).findings.some((f) => f.rule === "dash"), `${file}: the dash rule is switched off somewhere above the end of the file`);
  }
});

test("a per-file directive can name a pack rule whose id carries a slash", () => {
  // Pack rule ids are prefixed with their language (fr/closer), so the directive grammar has to
  // express a slash. The sentence is the pack-listing fixture's, which the SARIF test proves
  // triggers the rule.
  const text = "Essayez Calbo dès aujourd'hui pour vos classes.\n";
  const bare = lintText("note.md", text, { language: "fr" }).findings.filter((f) => f.rule === "fr/closer");
  assert.equal(bare.length, 1, "the fixture must trigger fr/closer, or nothing here is tested");
  const ignored = lintText("note.md", `<!-- slop-ignore fr/closer -->\n${text}`, { language: "fr" }).findings.filter((f) => f.rule === "fr/closer");
  assert.deepEqual(ignored, [], "fr/closer fired inside a file that ignores it from the first line");
});
