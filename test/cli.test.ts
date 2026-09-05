import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, writeFile, readFile, rm, mkdir } from "node:fs/promises";
import { readFileSync } from "node:fs";
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
  assert.match(g.out, /::error file=stdin,title=ai-slop-linter::F, score \d+(\.\d+)?, 2 findings; 1 error-severity tell/);
  const over = run(["-", "--format", "github", "--max-score", "1"], { input: "Let's dive in now.\n" });
  assert.match(over.out, /::error file=stdin,title=ai-slop-linter::.*score above max-score 1/);
  const fine = run(["-", "--format", "github"], { input: "Plain words here.\n" });
  assert.match(fine.out, /^::notice file=stdin,title=ai-slop-linter::A, score 0, 0 findings$/m);
  assert.equal(fine.code, 0);
});

test("markdown format is a pasteable table with the same facts", () => {
  const m = run(["-", "--format", "markdown"], { input: "Let's dive in — now.\n" });
  assert.equal(m.code, 1);
  assert.match(m.out, /^\*\*ai-slop-linter\*\*: 2 findings in 1 text, 1 failing\.$/m);
  assert.match(m.out, /^\| stdin \| F \(fails\) \| \d+(\.\d+)? \| 2 \|$/m);
  assert.match(m.out, /^\| stdin:1 \| dash \| error \| em dash[^|]*\|$/m);
  assert.match(m.out, /does not judge who wrote/);
  const clean = run(["-", "--format", "markdown"], { input: "Plain words here.\n" });
  assert.match(clean.out, /0 findings in 1 text\.$/m);
  assert.ok(!/\| where \|/.test(clean.out), "no findings table when there is nothing to list");
});

test("--fix rewrites the file and reports what it applied", async () => {
  const dir = await mkdtemp(join(tmpdir(), "slop-"));
  try {
    const file = join(dir, "doc.md");
    await writeFile(file, "In order to help — we tried “this”, it's fine.\n");
    const r = run(["doc.md", "--fix", "--warn"], { cwd: dir });
    assert.match(r.out, /4 fixed/);
    assert.equal(await readFile(file, "utf8"), 'To help, we tried "this", it\'s fine.\n');
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

test("the text output matches the VS Code problem matcher in .vscode/tasks.json, line for line", () => {
  const tasks = JSON.parse(readFileSync(join(process.cwd(), ".vscode", "tasks.json"), "utf8"));
  const [header, finding] = tasks.tasks[0].problemMatcher.pattern.map((p: { regexp: string }) => new RegExp(p.regexp));
  const text = run([join(fixtures, "sloppy.md"), join(fixtures, "clean.md"), "--warn"]);
  const json = JSON.parse(run([join(fixtures, "sloppy.md"), join(fixtures, "clean.md"), "--format", "json", "--warn"]).out);
  const expected = json.reduce((n: number, r: { findings: unknown[] }) => n + r.findings.length, 0);
  let file = "";
  const seen: { file: string; line: number; column: number; severity: string; code: string; message: string }[] = [];
  for (const l of text.out.split("\n")) {
    const h = header.exec(l);
    if (h) {
      file = h[1]!;
      continue;
    }
    const f = finding.exec(l);
    if (f) seen.push({ file, line: Number(f[1]), column: Number(f[2]), severity: f[3]!, code: f[4]!, message: f[5]! });
    else assert.ok(l === "", `unmatched output line: ${JSON.stringify(l)}`);
  }
  assert.equal(seen.length, expected);
  assert.ok(seen.length > 10);
  assert.ok(seen.every((s) => s.file.endsWith("sloppy.md")), "every finding belongs to the file header above it");
  const dash = seen.find((s) => s.code === "dash");
  assert.ok(dash && dash.severity === "error" && dash.line > 0 && dash.column > 0 && dash.message.length > 0);
});

test("--explain teaches one rule and points at the list when the id is unknown", () => {
  const r = run(["--explain", "not-x-but-y"]);
  assert.equal(r.code, 0);
  assert.match(r.out, /^not-x-but-y {2}warning/m);
  assert.match(r.out, /Wikipedia, Signs of AI writing: Negative parallelisms/);
  assert.match(r.out, /^Why$/m);
  assert.match(r.out, /^Instead of$/m);
  assert.match(r.out, /isn't just a linter/);
  assert.match(r.out, /^Write$/m);
  assert.match(r.out, /^Ignore it when$/m);
  const missing = run(["--explain", "no-such-rule"]);
  assert.equal(missing.code, 2);
  assert.match(missing.err, /unknown rule "no-such-rule"/);
  assert.match(missing.err, /not-x-but-y/);
});

test("the text output tells the reader how to learn about a rule that fired", () => {
  const r = run(["-", "--warn"], { input: "Let's dive in and delve into the tapestry.\n" });
  assert.match(r.err, /slop --explain announcing/);
  assert.ok(!/--explain/.test(r.out), "the hint stays off stdout so the text format keeps parsing");
  const clean = run(["-", "--warn"], { input: "Plain words here.\n" });
  assert.ok(!/--explain/.test(clean.err), "no hint when nothing fired");
});

test("per-path overrides in .slop.json, and --only narrowing to one rule", async () => {
  const dir = await mkdtemp(join(tmpdir(), "slop-cfg-"));
  try {
    await mkdir(join(dir, "docs"));
    // Both files carry the same two tells: a dash (error) and a filler phrase (info).
    const text = "In order to ship — we tested.\n";
    await writeFile(join(dir, "notes.md"), text);
    await writeFile(join(dir, "docs", "guide.md"), text);
    await writeFile(
      join(dir, ".slop.json"),
      JSON.stringify({
        include: ["**/*.md"],
        ignore: ["dash"],
        maxScore: 50,
        overrides: [{ files: ["docs/**"], ignore: [], maxScore: 1 }],
      }),
    );
    const r = run(["--warn", "--format", "json"], { cwd: dir });
    const byPath = Object.fromEntries(JSON.parse(r.out).map((x: { path: string; findings: { rule: string }[] }) => [x.path, x.findings.map((f) => f.rule)]));
    assert.deepEqual(byPath["notes.md"], ["filler"], "the top-level ignore drops the dash");
    assert.ok(byPath["docs/guide.md"].includes("dash"), "the override puts the dash back for docs");
    // The override's stricter maxScore fails only the file it covers.
    const strict = run(["--format", "json"], { cwd: dir });
    assert.equal(strict.code, 1);
    // --only narrows to the named rules, whatever the config says.
    const only = run(["--warn", "--only", "dash", "--format", "json"], { cwd: dir });
    const rules = new Set(JSON.parse(only.out).flatMap((x: { findings: { rule: string }[] }) => x.findings.map((f) => f.rule)));
    assert.deepEqual([...rules], ["dash"]);
    assert.equal(run(["--warn", "--only", "no-such-rule"], { cwd: dir }).code, 2);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("--init writes a config, and the Action or the hook on request, without overwriting", async () => {
  const dir = await mkdtemp(join(tmpdir(), "slop-init-"));
  try {
    const bare = run(["--init"], { cwd: dir });
    assert.equal(bare.code, 0);
    assert.match(bare.out, /wrote \.slop\.json/);
    const config = JSON.parse(await readFile(join(dir, ".slop.json"), "utf8"));
    assert.ok(Array.isArray(config.include) && config.include.length);
    assert.equal(typeof config.maxScore, "number");
    // Running it twice must not clobber an edited config.
    await writeFile(join(dir, ".slop.json"), JSON.stringify({ include: ["mine.md"] }));
    const again = run(["--init"], { cwd: dir });
    assert.equal(again.code, 1);
    assert.match(again.err, /already exists/);
    assert.deepEqual(JSON.parse(await readFile(join(dir, ".slop.json"), "utf8")).include, ["mine.md"]);

    const action = run(["--init", "action"], { cwd: dir });
    assert.equal(action.code, 0);
    const yml = await readFile(join(dir, ".github", "workflows", "prose.yml"), "utf8");
    assert.match(yml, /uses: Bubblegunn\/ai-slop-linter@v0/);
    assert.match(action.out, /\.github\/workflows\/prose\.yml/);

    await mkdir(join(dir, ".git", "hooks"), { recursive: true });
    const hook = run(["--init", "hook"], { cwd: dir });
    assert.equal(hook.code, 0);
    const sh = await readFile(join(dir, ".git", "hooks", "commit-msg"), "utf8");
    assert.match(sh, /--commit-msg/);
    assert.equal(run(["--init", "nonsense"], { cwd: dir }).code, 2);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
