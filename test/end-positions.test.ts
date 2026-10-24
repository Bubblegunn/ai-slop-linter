import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { lintDoc, lintText, prepare, rules } from "../src/index.js";
import { renderSarif } from "../src/sarif.js";
import { handleMessage } from "../src/mcp.js";

const cli = join(process.cwd(), "dist", "src", "cli.js");
const sloppy = join(process.cwd(), "test", "fixtures", "sloppy.md");

const run = (args: string[], opts: { input?: string } = {}) => {
  const r = spawnSync("node", [cli, ...args], { input: opts.input, encoding: "utf8" });
  return { code: r.status, out: r.stdout };
};

interface Reply { jsonrpc: string; id: unknown; result?: any; error?: { code: number; message: string } }

// Reads the end position off a finding, so the failure is an assertion about the missing
// field and not a type error: Finding does not carry the fields yet.
const endOf = (f: { rule: string; endLine?: number; endColumn?: number }) => {
  assert.equal(typeof f.endLine, "number", `${f.rule}: finding carries no endLine`);
  assert.equal(typeof f.endColumn, "number", `${f.rule}: finding carries no endColumn`);
  return { endLine: f.endLine!, endColumn: f.endColumn! };
};

// 1-based line and column back to the absolute offset the range starts or stops at.
const offsetAt = (doc: ReturnType<typeof prepare>, line: number, column: number) => doc.lineStarts[line - 1]! + column - 1;

test("on the sloppy fixture the range of every finding is the text it matched", () => {
  const text = readFileSync(sloppy, "utf8");
  const doc = prepare("sloppy.md", text);
  const result = lintDoc(doc);
  assert.ok(result.findings.length > 10, "the fixture must produce findings, or the property is never checked");
  for (const f of result.findings) {
    const { endLine, endColumn } = endOf(f);
    const start = offsetAt(doc, f.line, f.column);
    const end = offsetAt(doc, endLine, endColumn);
    assert.ok(end > start, `${f.rule}: empty range at line ${f.line}, column ${f.column}`);
    // A span that starts on line L and ends on line E covers at most E - L + 1 lines, so a
    // range can never leave the lines it reports.
    const slice = text.slice(start, end);
    assert.ok(slice.split("\n").length <= endLine - f.line + 1, `${f.rule}: range leaves the reported lines (${f.line} to ${endLine})`);
    // Where a fix exists the range is exactly the fix range: the matched characters. The
    // excerpt is trimmed and may carry an ellipsis, so the source text is the only oracle.
    if (f.fix) {
      assert.equal(start, f.fix.start, `${f.rule}: range does not start at the fix`);
      assert.equal(end, f.fix.end, `${f.rule}: range does not end at the fix`);
      assert.equal(slice, text.slice(f.fix.start, f.fix.end));
      assert.equal(endColumn - f.column, text.slice(f.fix.start, f.fix.end).length, `${f.rule}: endColumn - column is not the phrase length in UTF-16 code units`);
    }
  }
});

test("a match at end of line ends one past the last character", () => {
  const result = lintText("doc.md", "The plan is solid \u2014\n");
  const dash = result.findings.find((f) => f.rule === "dash");
  assert.ok(dash, "the dash rule must fire");
  assert.equal(dash.line, 1);
  // The dash rule's match takes the space before the dash with it, so the finding sits on
  // the space; the range still ends one past the last character of the line.
  assert.equal(dash.column, 18);
  const { endLine, endColumn } = endOf(dash);
  assert.equal(endLine, 1);
  assert.equal(endColumn, 20, "one past the dash that closes the line");
  assert.equal(endColumn - dash.column, 2, "the match is the space and the dash");
});

test("the title case finding covers the whole heading line", () => {
  const heading = "## Getting Started With The Parser";
  const result = lintText("doc.md", `${heading}\n`);
  const tc = result.findings.find((f) => f.rule === "title-case-heading");
  assert.ok(tc, "the title case rule must fire");
  const { endLine, endColumn } = endOf(tc);
  assert.equal(tc.line, 1);
  assert.equal(tc.column, 1);
  assert.equal(endLine, 1);
  assert.equal(endColumn, heading.length + 1, "one past the last character of the heading");
});

test("the hyphen density finding spans the whole document it grades", () => {
  // Hyphen density has no phrase to underline: it judges the whole document, so its range
  // runs from the first compound to the end of the text. This pins that choice.
  const pairLine = "A well-known high-quality end-to-end pipeline offers a user-friendly interface.";
  const pad = "plain words to pad the word count ";
  const text = `${pairLine}\n${pad.repeat(15)}\n`;
  const result = lintText("doc.md", text);
  const hd = result.findings.find((f) => f.rule === "hyphen-density");
  assert.ok(hd, "the hyphen density rule must fire");
  const { endLine, endColumn } = endOf(hd);
  assert.ok(endLine > hd.line, "the range is the whole document, not one point");
  assert.equal(endLine, 3);
  assert.equal(endColumn, 1);
});

test("the json format carries the end position of every finding", () => {
  const j = run(["-", "--format", "json", "--warn"], { input: "Let's dive in \u2014 now.\n" });
  const parsed = JSON.parse(j.out);
  assert.ok(parsed[0].findings.length >= 2);
  for (const f of parsed[0].findings) {
    assert.equal(typeof f.endLine, "number", `${f.rule}: json finding carries no endLine`);
    assert.equal(typeof f.endColumn, "number", `${f.rule}: json finding carries no endColumn`);
  }
  const dash = parsed[0].findings.find((f: { rule: string }) => f.rule === "dash");
  assert.equal(dash.endLine, 1);
  // The match is " " + the dash + the space after it, the exact characters the fix replaces.
  assert.equal(dash.endColumn, 17);
});

test("the sarif region carries the end of the range", () => {
  const result = lintText("docs/example.md", "Let's dive in \u2014 now.\n");
  const log = JSON.parse(renderSarif([result], rules, "0.0.0"));
  assert.ok(log.runs[0].results.length >= 2);
  for (const r of log.runs[0].results) {
    const region = r.locations[0].physicalLocation.region;
    const finding = result.findings.find((f) => f.rule === r.ruleId)!;
    const { endLine, endColumn } = endOf(finding);
    assert.equal(region.endLine, endLine, `${r.ruleId}: sarif region endLine`);
    assert.equal(region.endColumn, endColumn, `${r.ruleId}: sarif region endColumn`);
  }
});

test("the github format prints endColumn on one line and drops it across lines", async () => {
  const g = run(["-", "--format", "github", "--warn"], { input: "Let's dive in \u2014 now.\n" });
  assert.match(g.out, /::error file=stdin,line=1,col=14,endColumn=17,title=dash::/);
  for (const line of g.out.split("\n").filter((l) => l.includes("title=") && !l.includes("title=ai-slop-linter"))) {
    assert.match(line, /endColumn=\d+/, `a same-line finding without endColumn: ${line}`);
  }
  const dir = await mkdtemp(join(tmpdir(), "slop-end-"));
  try {
    const pairLine = "A well-known high-quality end-to-end pipeline offers a user-friendly interface.";
    const pad = "plain words to pad the word count ";
    const file = join(dir, "doc.md");
    await writeFile(file, `${pairLine}\n${pad.repeat(15)}\n`);
    const h = run([file, "--format", "github", "--warn"]);
    const hdLine = h.out.split("\n").find((l) => l.includes("title=hyphen-density"));
    assert.ok(hdLine, h.out);
    assert.match(hdLine, /^::notice file=.*doc\.md,line=1,col=3,title=hyphen-density::/);
    assert.ok(!hdLine.includes("endColumn"), `a cross-line finding must not carry endColumn: ${hdLine}`);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("the mcp findings carry the end position", () => {
  const reply = handleMessage(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "check_slop", arguments: { text: "Let's dive in \u2014 now.\n" } } }), "0.0.0") as Reply | null;
  assert.ok(reply && reply.result, "the tool call got no reply");
  const payload = JSON.parse(reply.result.content[0].text);
  const dash = payload.findings.find((f: { rule: string }) => f.rule === "dash");
  assert.equal(dash.endLine, 1);
  assert.equal(dash.endColumn, 17);
});
