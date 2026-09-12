/**
 * The playground runs the same engine as the command line, and asks the network for nothing.
 * Issue #20.
 *
 * WHAT THESE TESTS CANNOT DO. No browser is launched here. They assemble the page, walk what was
 * copied, and run the copied engine under Node. So they establish that the served engine and the
 * CLI agree on findings and offsets, that no Node-only or third-party module reached the page,
 * and that no source line in the page can make a network request or turn text into markup. They
 * establish nothing about the page *in a browser*: rendering, keyboard operation, the network
 * panel being empty, working offline after the first load, right-to-left text, small screens, and
 * whether regex lookbehind and `Intl.Segmenter` behave in a given engine are all unverified and
 * must be checked by a person with a browser.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { lintText } from "../src/index.js";

const ROOT = process.cwd();
const BUILD = join(ROOT, "scripts", "playground-build.mjs");

/** Every file under a directory, as forward-slash relative paths, sorted. */
function walk(dir: string, base = dir): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p, base));
    else out.push(relative(base, p).split(sep).join("/"));
  }
  return out.sort();
}

function assemble(): string {
  const dir = mkdtempSync(join(tmpdir(), "slop-playground-"));
  const out = join(dir, "site");
  const r = spawnSync(process.execPath, [BUILD, "--out", out], { cwd: ROOT, encoding: "utf8" });
  assert.equal(r.status, 0, `playground-build failed:\n${r.stdout}\n${r.stderr}`);
  return out;
}

test("the assembled page carries the engine and nothing that needs Node", () => {
  const site = assemble();
  try {
    const files = walk(site);
    assert.deepEqual(files, [
      "engine/doc.js",
      "engine/index.js",
      "engine/meta.js",
      "engine/rules/constructions.js",
      "engine/rules/dashes.js",
      "engine/rules/formatting.js",
      "engine/rules/residue.js",
      "engine/rules/vocabulary.js",
      "index.html",
      "playground.js",
      "samples.js",
    ]);
    // The three modules that would break the page: cli.js pulls node:child_process, node:fs,
    // node:path and node:url; glob.js and history.js pull node:fs and node:child_process.
    for (const banned of ["engine/cli.js", "engine/glob.js", "engine/history.js"]) {
      assert.ok(!files.includes(banned), `${banned} was copied into the page`);
    }
    for (const f of files.filter((p) => p.endsWith(".js"))) {
      const body = readFileSync(join(site, f), "utf8");
      assert.ok(!/["']node:/.test(body), `${f} contains a node: specifier`);
      assert.ok(!/\brequire\s*\(/.test(body), `${f} contains a require call`);
      assert.ok(!/\bprocess\s*\./.test(body), `${f} reads process`);
      // Anchored to the start of a line and requiring the keyword, because a bare `from\s*"..."`
      // also matches inside a word list: `constructions.js` and `formatting.js` both contain
      // ["the", "and", "from", "into", ...], where `from", "` looked like an import of ", ".
      // Compiled output puts every real import and re-export at the start of its own line.
      for (const m of body.matchAll(/^\s*(?:import|export)\b[^\n]*?\bfrom\s*["']([^"']+)["']/gm)) {
        assert.ok(m[1]!.startsWith("."), `${f} imports the bare specifier "${m[1]}"`);
      }
    }
  } finally {
    rmSync(site, { recursive: true, force: true });
  }
});

test("the served engine and the CLI report the same findings at the same offsets", async () => {
  const site = assemble();
  try {
    const engine = await import(pathToFileURL(join(site, "engine", "index.js")).href);
    const fixtures = ["test/fixtures/sloppy.md", "test/fixtures/clean.md", "test/fixtures/quoted-code.md", "test/fixtures/short.md", "bench/corpus/machine/pull-request.md", "bench/corpus/human/darwin-origin-of-species.md"];

    // The CLI's own JSON, from the binary people install, on the same files in one run.
    let stdout: string;
    try {
      stdout = execFileSync(process.execPath, [join(ROOT, "dist/src/cli.js"), ...fixtures, "--format", "json"], { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    } catch (e) {
      // The fixtures have errors, so the CLI exits 1 and execFileSync throws. The output we want
      // is on the error.
      const out = (e as { stdout?: string }).stdout;
      assert.equal(typeof out, "string", String(e));
      stdout = out!;
    }
    const fromCli = JSON.parse(stdout) as Array<{ path: string; words: number; score: number | null; grade: string | null; stoodDown: string[]; findings: Array<Record<string, unknown>> }>;
    assert.equal(fromCli.length, fixtures.length);

    for (const result of fromCli) {
      const text = readFileSync(join(ROOT, result.path), "utf8");
      const mine = engine.lintText(result.path, text);
      // Same shape the CLI prints: the fix object becomes a `fixable` flag.
      const shaped = mine.findings.map((f: Record<string, unknown> & { fix?: unknown }) => ({
        rule: f.rule, severity: f.severity, line: f.line, column: f.column, excerpt: f.excerpt, message: f.message, fixable: !!f.fix,
      }));
      assert.deepEqual(shaped, result.findings, `${result.path}: the page's engine and the CLI disagree`);
      assert.equal(mine.words, result.words, `${result.path}: word count`);
      assert.equal(mine.score, result.score, `${result.path}: score`);
      assert.equal(mine.grade, result.grade, `${result.path}: grade`);
      assert.deepEqual(mine.stoodDown, result.stoodDown, `${result.path}: rules that stood down`);
      // And the copy agrees with the module this test imported directly, so the copy is a copy.
      assert.deepEqual(shaped, lintText(result.path, text).findings.map((f) => ({
        rule: f.rule, severity: f.severity, line: f.line, column: f.column, excerpt: f.excerpt, message: f.message, fixable: !!f.fix,
      })));
    }
  } finally {
    rmSync(site, { recursive: true, force: true });
  }
});

test("the page states the version and rule set it is actually running", async () => {
  const site = assemble();
  try {
    const meta = await import(pathToFileURL(join(site, "engine", "meta.js")).href);
    const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as { version: string };
    assert.equal(meta.VERSION, pkg.version, "the page would advertise a version it is not running");
    const engine = await import(pathToFileURL(join(site, "engine", "index.js")).href);
    assert.equal(engine.rules.length, 20);
    // Every rule the page can show a panel for carries the material that panel needs.
    for (const r of engine.rules) {
      assert.ok(r.why && r.source && r.ignoreWhen && r.example?.before && r.example?.after, `${r.id} is missing --explain material`);
    }
  } finally {
    rmSync(site, { recursive: true, force: true });
  }
});

test("samples are generated from files in this repository and are labelled synthetic", async () => {
  const site = assemble();
  try {
    const { SAMPLES } = await import(pathToFileURL(join(site, "samples.js")).href);
    assert.ok(SAMPLES.length >= 3, "there should be more than one shape to try");
    for (const s of SAMPLES) {
      assert.equal(s.text, readFileSync(join(ROOT, s.source), "utf8"), `${s.id}: the sample drifted from ${s.source}`);
      assert.ok(s.note.length > 20, `${s.id}: a sample has to say what it is`);
    }
  } finally {
    rmSync(site, { recursive: true, force: true });
  }
});

test("no source line in the page can make a request or turn text into markup", () => {
  // Issue #20's privacy contract, as far as reading the source can establish it: no account, no
  // analytics, no automatic storage, and the text never leaves the device. This is static
  // analysis of the two files that are authored by hand. A browser's network panel is the other
  // half of the check and is NOT RUN here.
  const html = readFileSync(join(ROOT, "playground", "index.html"), "utf8");
  const js = readFileSync(join(ROOT, "playground", "playground.js"), "utf8");

  for (const [name, body] of [["index.html", html], ["playground.js", js]] as const) {
    for (const pattern of [/\bfetch\s*\(/, /XMLHttpRequest/, /\bWebSocket\b/, /sendBeacon/, /EventSource/, /new\s+Image\s*\(/, /navigator\.geolocation/, /gtag|googletagmanager|google-analytics|plausible|posthog|sentry/i]) {
      assert.ok(!pattern.test(body), `${name} matches ${pattern}, which could carry text off the device`);
    }
    // No automatic storage: nothing the user typed outlives the tab.
    for (const pattern of [/localStorage/, /sessionStorage/, /indexedDB/, /document\.cookie/]) {
      assert.ok(!pattern.test(body), `${name} matches ${pattern}, and the page stores nothing`);
    }
    // User text must never be parsed as markup.
    for (const pattern of [/innerHTML/, /outerHTML/, /insertAdjacentHTML/, /document\.write/, /\beval\s*\(/, /new\s+Function\s*\(/]) {
      assert.ok(!pattern.test(body), `${name} matches ${pattern}, which would make user text executable`);
    }
  }

  // No third-party resource: no stylesheet link, no remote font, no remote script. The one
  // external reference allowed is a link a person clicks, which fetches nothing until then.
  assert.ok(!/<link\b/i.test(html), "index.html links an external resource");
  assert.ok(!/@import/i.test(html), "index.html imports a remote stylesheet");
  assert.ok(!/url\(\s*['"]?https?:/i.test(html), "index.html loads a remote asset from CSS");
  for (const m of html.matchAll(/<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi)) {
    assert.ok(m[1]!.startsWith("./"), `index.html loads the script ${m[1]}, which is not local`);
  }
  for (const m of html.matchAll(/\bhref\s*=\s*["'](https?:[^"']+)["']/gi)) {
    assert.match(m[1]!, /^https:\/\/github\.com\/Bubblegunn\/ai-slop-linter/, `index.html points at ${m[1]}`);
  }
  // The engine is imported, not reimplemented: no rule pattern is restated in the page.
  assert.ok(/from\s+"\.\/engine\/index\.js"/.test(js), "the page must import the engine");
  assert.ok(!/Signs of AI writing/.test(js), "a rule's source string appears in the page, so a rule was copied");
});

test("assembling twice produces identical bytes, so the page has no build timestamp in it", () => {
  const a = assemble();
  const b = assemble();
  try {
    const files = walk(a);
    assert.deepEqual(files, walk(b));
    for (const f of files) {
      assert.equal(readFileSync(join(a, f), "utf8"), readFileSync(join(b, f), "utf8"), `${f} differs between two builds`);
    }
  } finally {
    rmSync(a, { recursive: true, force: true });
    rmSync(b, { recursive: true, force: true });
  }
});

test("the build refuses a module that needs Node, and one outside the allowlist", () => {
  // Each guard in the build script, seen failing. A guard nobody has watched fail is not known to
  // work, and this one is the only thing standing between the page and `node:child_process`.
  // Line endings are normalised on the way in. A Windows checkout carries CRLF, and this test
  // matches source text, so without this the patch found nothing and the guard went unwatched
  // on one of the three operating systems the suite runs on.
  const script = readFileSync(BUILD, "utf8").replace(/\r\n/g, "\n");
  const allowlistEnd = `  "rules/formatting.js",\n];`;
  assert.ok(script.includes(allowlistEnd), "the ENGINE allowlist is not in the shape this test patches");

  /** A throwaway tree that looks enough like the repository for the build script to run in it. */
  const scaffold = (patchedScript: string, patchIndex: boolean): { status: number | null; stderr: string; stdout: string; dir: string } => {
    const dir = mkdtempSync(join(tmpdir(), "slop-playground-bad-"));
    mkdirSync(join(dir, "scripts"), { recursive: true });
    const target = join(dir, "scripts", "playground-build.mjs");
    writeFileSync(target, patchedScript);
    cpSync(join(ROOT, "package.json"), join(dir, "package.json"));
    cpSync(join(ROOT, "dist"), join(dir, "dist"), { recursive: true });
    cpSync(join(ROOT, "playground"), join(dir, "playground"), { recursive: true });
    cpSync(join(ROOT, "bench"), join(dir, "bench"), { recursive: true });
    cpSync(join(ROOT, "test", "fixtures"), join(dir, "test", "fixtures"), { recursive: true });
    if (patchIndex) {
      // Make the engine's entrypoint actually reach history.js, so the graph walk arrives there
      // rather than stopping at "copied but never imported".
      const entry = join(dir, "dist", "src", "index.js");
      writeFileSync(entry, `import "./history.js";\n${readFileSync(entry, "utf8")}`);
    }
    const r = spawnSync(process.execPath, [target, "--out", join(dir, "site")], { cwd: dir, encoding: "utf8" });
    return { status: r.status, stderr: r.stderr, stdout: r.stdout, dir };
  };

  // A file reached by the graph that is not on the allowlist: history.js, imported but not copied.
  const outside = scaffold(script, true);
  try {
    assert.equal(outside.status, 1, `an import outside the allowlist should fail the build:\n${outside.stdout}\n${outside.stderr}`);
    assert.match(outside.stderr, /outside the engine allowlist/);
  } finally {
    rmSync(outside.dir, { recursive: true, force: true });
  }

  // And with history.js allowlisted as well, the walk reaches its node: import and still refuses.
  const nodeOnly = scaffold(script.replace(allowlistEnd, `  "rules/formatting.js",\n  "history.js",\n];`), true);
  try {
    assert.equal(nodeOnly.status, 1, `a node: import should fail the build:\n${nodeOnly.stdout}\n${nodeOnly.stderr}`);
    assert.match(nodeOnly.stderr, /imports "node:child_process", which a browser cannot resolve/);
  } finally {
    rmSync(nodeOnly.dir, { recursive: true, force: true });
  }

  // A file copied that nothing imports is also refused, so the allowlist cannot rot quietly.
  const unused = scaffold(script.replace(allowlistEnd, `  "rules/formatting.js",\n  "history.js",\n];`), false);
  try {
    assert.equal(unused.status, 1, `an unreachable allowlist entry should fail the build:\n${unused.stdout}\n${unused.stderr}`);
    assert.match(unused.stderr, /copied but never imported: history\.js/);
  } finally {
    rmSync(unused.dir, { recursive: true, force: true });
  }
});
