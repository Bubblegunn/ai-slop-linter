import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, writeFile, readFile, rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const cli = join(process.cwd(), "dist", "src", "cli.js");
const fixtures = join(process.cwd(), "test", "fixtures");

const run = (args: string[], opts: { cwd?: string; input?: string } = {}) => {
  const r = spawnSync("node", [cli, ...args], { cwd: opts.cwd ?? process.cwd(), input: opts.input, encoding: "utf8" });
  return { code: r.status, out: r.stdout, err: r.stderr };
};

test("lints files, exits 1 on errors, 0 on clean, --warn always 0", () => {
  const bad = run([join(fixtures, "sloppy.md")]);
  assert.equal(bad.code, 1);
  assert.match(bad.out, /sloppy\.md {2}F \(score/);
  assert.match(bad.out, /dash/);
  const good = run([join(fixtures, "clean.md")]);
  assert.equal(good.code, 0);
  assert.match(good.out, /clean\.md {2}A/);
  assert.equal(run([join(fixtures, "sloppy.md"), "--warn"]).code, 0);
});

test("stdin, json and github formats", () => {
  const j = run(["-", "--format", "json"], { input: "Let's dive in — now.\n" });
  const parsed = JSON.parse(j.out);
  assert.equal(parsed[0].path, "stdin");
  assert.deepEqual(parsed[0].findings.map((f: { rule: string }) => f.rule).sort(), ["announcing", "dash"]);
  assert.equal(parsed[0].findings.find((f: { rule: string }) => f.rule === "dash").fixable, true);
  const g = run(["-", "--format", "github"], { input: "Let's dive in — now.\n" });
  assert.match(g.out, /::error file=stdin,line=1,col=\d+,title=dash::/);
  assert.match(g.out, /::warning file=stdin,line=1,col=1,title=announcing::/);
});

test("--fix rewrites the file and reports what it applied", async () => {
  const dir = await mkdtemp(join(tmpdir(), "slop-"));
  try {
    const file = join(dir, "doc.md");
    await writeFile(file, "In order to help — we tried “this”.\n");
    const r = run(["doc.md", "--fix", "--warn"], { cwd: dir });
    assert.match(r.out, /4 fixed/);
    assert.equal(await readFile(file, "utf8"), 'To help, we tried "this".\n');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("--commit reads the last commit, --commit-msg the file a hook hands over; .slop.json supplies ignore and include", async () => {
  const dir = await mkdtemp(join(tmpdir(), "slop-git-"));
  try {
    execFileSync("git", ["init", "-q", "-b", "main"], { cwd: dir });
    await writeFile(join(dir, "a.txt"), "x\n");
    execFileSync("git", ["add", "."], { cwd: dir });
    execFileSync("git", ["-c", "user.name=T", "-c", "user.email=t@example.com", "commit", "-q", "-m", "feat: thing — with a dash\n\nI hope this helps!"], { cwd: dir });
    const last = run(["--commit"], { cwd: dir });
    assert.equal(last.code, 1);
    assert.match(last.out, /last commit/);
    assert.match(last.out, /chatbot/);
    await writeFile(join(dir, "MSG"), "fix: plain message\n# comment lines are dropped — even with dashes\n");
    const edit = run(["--commit-msg", "MSG"], { cwd: dir });
    assert.equal(edit.code, 0, edit.out);
    await mkdir(join(dir, "docs"));
    await writeFile(join(dir, "docs", "n.md"), "Certainly! A — B\n");
    await writeFile(join(dir, "CHANGELOG.md"), "Certainly!\n");
    await writeFile(join(dir, ".slop.json"), JSON.stringify({ ignore: ["chatbot"], include: ["**/*.md"], maxScore: 1000 }));
    const cfg = run([], { cwd: dir });
    assert.match(cfg.out, /docs\/n\.md/);
    assert.ok(!cfg.out.includes("CHANGELOG"), "CHANGELOG is skipped by default");
    assert.ok(!cfg.out.includes("chatbot"), "ignored rule stays silent");
    assert.equal(cfg.code, 1, "the dash is still an error");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("--rules lists every rule with its source; unknown options exit 2", () => {
  const r = run(["--rules"]);
  assert.equal(r.code, 0);
  assert.match(r.out, /dash\s+error/);
  assert.match(r.out, /Wikipedia/);
  assert.equal(run(["--bogus"]).code, 2);
});
