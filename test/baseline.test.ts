import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { lintText } from "../src/index.js";
import { createBaseline, applyBaseline, parseBaseline } from "../src/baseline.js";

const cli = join(process.cwd(), "dist", "src", "cli.js");
const run = (args: string[], cwd: string) => {
  const r = spawnSync("node", [cli, ...args], { cwd, encoding: "utf8" });
  return { code: r.status, out: r.stdout, err: r.stderr };
};

test("a baseline keys findings by file, rule and normalised excerpt, not by line", () => {
  const before = lintText("a.md", "Intro.\n\nLet's dive in — now.\n");
  const baseline = createBaseline([before]);
  assert.equal(baseline.version, 1);
  assert.deepEqual(baseline.findings.map((f) => f.rule).sort(), ["announcing", "dash"]);
  // Two lines inserted above: same tells, new line numbers, nothing new.
  const moved = lintText("a.md", "Intro.\n\nMore.\n\nMore.\n\nLet's dive in — now.\n");
  const { results, baselined } = applyBaseline([moved], baseline);
  assert.equal(baselined, 2);
  assert.deepEqual(results[0]!.findings, []);
  assert.equal(results[0]!.grade, "A");
  assert.equal(results[0]!.errors, 0);
  // A second dash is new: one entry per tell, consumed once.
  const twice = lintText("a.md", "Let's dive in — now.\n\nAnd — again.\n");
  const second = applyBaseline([twice], baseline);
  assert.equal(second.baselined, 2);
  assert.equal(second.results[0]!.findings.length, 1);
  assert.equal(second.results[0]!.findings[0]!.rule, "dash");
  assert.equal(second.results[0]!.errors, 1);
  // A different file is not covered.
  const other = applyBaseline([lintText("b.md", "Let's dive in — now.\n")], baseline);
  assert.equal(other.baselined, 0);
});

test("parseBaseline rejects other shapes with a plain message", () => {
  assert.throws(() => parseBaseline("{"), /not valid JSON/);
  assert.throws(() => parseBaseline('{"version":2,"findings":[]}'), /version: 1/);
  assert.throws(() => parseBaseline('{"version":1,"findings":[{"file":"a"}]}'), /file, rule and excerpt/);
});

test("--baseline-write records today's findings; --baseline fails only on new ones", async () => {
  const dir = await mkdtemp(join(tmpdir(), "slop-baseline-"));
  try {
    await writeFile(join(dir, "old.md"), "Let's dive in — now.\n");
    const first = run(["old.md", "--baseline-write"], dir);
    assert.equal(first.code, 0, first.out + first.err);
    assert.match(first.out, /wrote 2 findings to \.slop-baseline\.json/);
    const stored = JSON.parse(await readFile(join(dir, ".slop-baseline.json"), "utf8"));
    assert.equal(stored.findings.length, 2);
    const same = run(["old.md", "--baseline"], dir);
    assert.equal(same.code, 0, same.out);
    assert.match(same.out, /2 baselined/);
    await writeFile(join(dir, "old.md"), "Let's dive in — now.\n\nA new — dash.\n");
    const changed = run(["old.md", "--baseline"], dir);
    assert.equal(changed.code, 1);
    assert.match(changed.out, /1 finding, 2 baselined/);
    assert.match(changed.out, /3:\d+\s+error\s+dash/);
    // A named file, also through .slop.json, and a missing file is a usage error.
    const named = run(["old.md", "--baseline-write", "--baseline-file", "b.json"], dir);
    assert.equal(named.code, 0, named.out + named.err);
    await writeFile(join(dir, ".slop.json"), JSON.stringify({ baseline: "b.json", maxScore: 1000 }));
    const viaConfig = run(["old.md", "--baseline"], dir);
    assert.equal(viaConfig.code, 0, viaConfig.out);
    assert.match(viaConfig.out, /3 baselined/);
    const missing = run(["old.md", "--baseline", "--baseline-file", "nope.json"], dir);
    assert.equal(missing.code, 2);
    assert.match(missing.err, /nope\.json/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
