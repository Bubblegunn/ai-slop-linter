// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// The Action is a bash script inside action.yml, and no other test runs it. These run that
// script as written, with the CLI from this checkout in place of the published one (the
// `package` input), so a change to how the Action reads its inputs is tested before it ships.
// The CI job `action` runs the real Action with `uses: ./`; this covers the argument handling
// in more cases than a workflow can cheaply assert.
const root = join(import.meta.dirname, "..");
const fixtures = join(root, "test", "fixtures");

// Every release from v0.1.0 to v0.1.7 shipped an action.yml that YAML parsers reject: the
// `comment` input's description was an unquoted scalar containing `pull-requests: write`, and a
// colon followed by a space ends a plain scalar. PyYAML and Ruby's Psych both stop at line 17,
// column 131. No test parsed the file, and the repository has no YAML parser among its
// dependencies, so this checks the one rule that broke it: an unquoted value may not contain
// ": " or " #".
test("action.yml has no unquoted value that a YAML parser would read as a mapping or a comment", () => {
  const bad = readFileSync(join(root, "action.yml"), "utf8")
    .split("\n")
    .map((line, i) => ({ line, n: i + 1 }))
    .filter(({ line }) => {
      const m = /^\s*(?:- )?[\w-]+: (.+)$/.exec(line);
      if (!m) return false;
      const value = m[1];
      if (/^["'|>]/.test(value)) return false;
      return /: |\s#/.test(value.replace(/\$\{\{.*?\}\}/g, ""));
    });
  assert.deepEqual(bad, [], "quote these values");
});

/** The `run: |` block of the Action's only step, de-indented. */
function actionScript() {
  const yml = readFileSync(join(root, "action.yml"), "utf8");
  const at = yml.indexOf("\n      run: |\n");
  assert.ok(at !== -1, "action.yml has no `run: |` block where this test expects one");
  return yml
    .slice(at + "\n      run: |\n".length)
    .split("\n")
    .map((l) => l.replace(/^ {8}/, ""))
    .join("\n");
}

/** Runs the Action's script in `cwd` with the given `files` input; returns exit code, output and the findings output. */
function runAction(cwd, files, { warn = "false" } = {}) {
  const out = join(cwd, "github-output");
  writeFileSync(out, "");
  // As GitHub runs a composite step with `shell: bash`: -e and pipefail are on.
  const r = spawnSync("bash", ["--noprofile", "--norc", "-eo", "pipefail", "-c", actionScript()], {
    cwd,
    encoding: "utf8",
    env: {
      ...process.env,
      GITHUB_OUTPUT: out,
      GH_TOKEN: "",
      REPO: "owner/repo",
      EVENT: "push",
      PR: "",
      FILES: files,
      PR_BODY: "false",
      COMMENT: "false",
      BASELINE: "",
      MAX: "10",
      WARN: warn,
      VERSION: "0.0.0-not-used",
      PACKAGE: root,
      // Each run installs the package through npx into its own cache. With the shared cache,
      // two runs installing the same tarball at once raced on macOS CI (2026-10-14): one ran
      // `.bin/ai-slop-linter` before the other had made it executable, "Permission denied".
      npm_config_cache: join(cwd, "npm-cache"),
    },
  });
  const findings = /^findings=(.*)$/m.exec(readFileSync(out, "utf8"))?.[1];
  return { code: r.status, out: r.stdout + r.stderr, findings };
}

/** What the CLI from this checkout counts on the same files, the way the Action counts. */
function cliCount(cwd, paths) {
  const r = spawnSync(process.execPath, [join(root, "dist", "src", "cli.js"), "--format", "json", "--warn", ...paths], { cwd, encoding: "utf8" });
  return String(JSON.parse(r.stdout).reduce((n, f) => n + f.findings.length, 0));
}

const skip = process.platform === "win32" ? "the Action runs on bash; Windows is covered by the CI job" : false;

function sandbox() {
  const dir = mkdtempSync(join(tmpdir(), "slop-action-"));
  copyFileSync(join(fixtures, "sloppy.md"), join(dir, "my notes.md"));
  copyFileSync(join(fixtures, "sloppy.md"), join(dir, "a.md"));
  copyFileSync(join(fixtures, "clean.md"), join(dir, "clean.md"));
  return dir;
}

test("files on one line keep working, and the findings output equals the CLI's count", { skip }, () => {
  const dir = sandbox();
  try {
    const r = runAction(dir, "a.md clean.md");
    assert.equal(r.code, 1, r.out);
    assert.equal(r.findings, cliCount(dir, ["a.md", "clean.md"]));
    assert.notEqual(r.findings, "0");
    const clean = runAction(dir, "clean.md");
    assert.equal(clean.code, 0, clean.out);
    assert.equal(clean.findings, "0");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a path with a space on a one-line files input is rejected with a message that says how to pass it", { skip }, () => {
  const dir = sandbox();
  try {
    const r = runAction(dir, "my notes.md clean.md", { warn: "true" });
    assert.equal(r.code, 2, r.out);
    assert.match(r.out, /::error title=ai-slop-linter::files: "my" does not exist\..*one path per line/);
    assert.equal(r.findings, undefined, "nothing was linted, so no findings count is written");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("one path per line supports a path with a space", { skip }, () => {
  const dir = sandbox();
  try {
    const r = runAction(dir, "my notes.md\n  clean.md  \n\n");
    assert.equal(r.code, 1, r.out);
    assert.equal(r.findings, cliCount(dir, ["my notes.md", "clean.md"]));
    assert.match(r.out, /file=my notes\.md/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a missing path in a list fails instead of being skipped, and a glob is left to the CLI", { skip }, () => {
  const dir = sandbox();
  try {
    const missing = runAction(dir, "a.md gone.md", { warn: "true" });
    assert.equal(missing.code, 2, missing.out);
    assert.match(missing.out, /"gone\.md" does not exist/);
    const glob = runAction(dir, "*.md", { warn: "true" });
    assert.equal(glob.code, 0, glob.out);
    assert.equal(glob.findings, cliCount(dir, ["a.md", "clean.md", "my notes.md"]));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
