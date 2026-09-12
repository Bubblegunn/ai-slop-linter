#!/usr/bin/env node
// Assemble the static playground into _site/, which is gitignored. Issue #20.
//
// The page imports the same engine the CLI imports. `dist/` is gitignored, so there is no
// committed bundle to go stale: run `npm run build` first (the `playground` npm script does
// both) and this copies the built engine next to the page.
//
// Two things this script is here to enforce rather than document.
//
// 1. Only the engine is copied. `dist/src/cli.js`, `glob.js` and `history.js` import
//    node:child_process, node:fs, node:path and node:url; any one of them reaching the page
//    would break it in a browser. So the copy is an allowlist, and the import graph of what
//    was copied is walked afterwards: a relative import that leaves the allowlist, or any bare
//    or `node:` specifier, fails the build.
// 2. The page's version, rule list and samples are generated from the repository, never typed
//    in. A playground advertising a version it is not running is the same defect the README
//    demo block had.
//
// Output is deterministic: no timestamps, so a test can assemble twice and compare.
// Node built-ins only, no network.
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, posix, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

/**
 * The engine, and nothing else. Mirrors the import graph of src/index.ts: it imports doc.js and
 * the five rule files, and they import nothing but each other. Adding a file here means having
 * checked that it carries no platform import.
 */
const ENGINE = [
  "index.js",
  "doc.js",
  "rules/dashes.js",
  "rules/constructions.js",
  "rules/vocabulary.js",
  "rules/residue.js",
  "rules/formatting.js",
];

/**
 * Sample texts, so the first thing a visitor can try is not their own writing. Every one is
 * already in this repository and every one is synthetic: the four machine-corpus files were
 * written for `bench/corpus` in the shapes this tool is pointed at (see bench/corpus/MANIFEST.md),
 * and the fixture exists to trip every rule once. None of them is anybody's real writing, which
 * is the point: the page must not hold a real document that someone has to be asked about.
 */
const SAMPLES = [
  {
    id: "pull-request",
    label: "A pull request description",
    note: "Unedited model output, written for bench/corpus. Not a real pull request.",
    file: "bench/corpus/machine/pull-request.md",
  },
  {
    id: "commit-messages",
    label: "Four commit messages",
    note: "Unedited model output, written for bench/corpus. Not from any repository's history.",
    file: "bench/corpus/machine/commit-messages.md",
  },
  {
    id: "readme-section",
    label: "A project README",
    note: "Unedited model output, written for bench/corpus. The project does not exist.",
    file: "bench/corpus/machine/readme-section.md",
  },
  {
    id: "sloppy",
    label: "The test fixture (every rule at once)",
    note: "test/fixtures/sloppy.md, written to trip all twenty rules once. Nobody would write this.",
    file: "test/fixtures/sloppy.md",
  },
  {
    id: "clean",
    label: "A document that passes",
    note: "test/fixtures/clean.md. A clean pass means the listed tells are absent, nothing more.",
    file: "test/fixtures/clean.md",
  },
];

const argOut = (() => {
  const i = process.argv.indexOf("--out");
  return i === -1 ? "_site" : process.argv[i + 1];
})();
if (!argOut) {
  console.error("playground-build: --out needs a directory");
  process.exit(2);
}
const out = resolve(root, argOut);

if (!existsSync(join(root, "dist/src/index.js"))) {
  console.error("playground-build: dist/src/index.js is missing. Run `npm run build` first (or use `npm run playground`).");
  process.exit(1);
}

rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, "engine/rules"), { recursive: true });

for (const rel of ENGINE) cpSync(join(root, "dist/src", rel), join(out, "engine", rel));

// The import-graph walk, over what was actually copied rather than over the source tree.
const SPECIFIER = /(?:^|[\s;}])(?:import|export)\b[^'"`]*?from\s*["']([^"']+)["']|(?:^|[\s;}])import\s*["']([^"']+)["']|\bimport\(\s*["']([^"']+)["']\s*\)/gm;
const seen = new Set();
const queue = ["index.js"];
const offenders = [];
while (queue.length) {
  const rel = queue.shift();
  if (seen.has(rel)) continue;
  seen.add(rel);
  const body = readFileSync(join(out, "engine", rel), "utf8");
  for (const m of body.matchAll(SPECIFIER)) {
    const spec = m[1] ?? m[2] ?? m[3];
    if (!spec) continue;
    if (!spec.startsWith(".")) {
      offenders.push(`engine/${rel} imports "${spec}", which a browser cannot resolve`);
      continue;
    }
    const target = posix.normalize(posix.join(posix.dirname(rel), spec));
    if (!ENGINE.includes(target)) {
      offenders.push(`engine/${rel} imports "${spec}" (${target}), which is outside the engine allowlist`);
      continue;
    }
    queue.push(target);
  }
}
const unreached = ENGINE.filter((f) => !seen.has(f));
if (unreached.length) offenders.push(`copied but never imported: ${unreached.join(", ")}`);
if (offenders.length) {
  for (const o of offenders) console.error(`playground-build: ${o}`);
  process.exit(1);
}

// The engine's own rule list is the authority on what runs; the page reads it from the engine.
// Only what the engine cannot know about itself is generated here.
const pkg = JSON.parse(read("package.json"));
writeFileSync(
  join(out, "engine/meta.js"),
  [
    "// Generated by scripts/playground-build.mjs. Do not edit.",
    `export const VERSION = ${JSON.stringify(pkg.version)};`,
    `export const ENGINE_FILES = ${JSON.stringify(ENGINE)};`,
    "",
  ].join("\n"),
);

writeFileSync(
  join(out, "samples.js"),
  [
    "// Generated by scripts/playground-build.mjs from files in this repository. Do not edit.",
    `export const SAMPLES = ${JSON.stringify(
      SAMPLES.map((s) => ({ id: s.id, label: s.label, note: s.note, source: s.file, text: read(s.file) })),
      null,
      2,
    )};`,
    "",
  ].join("\n"),
);

for (const f of readdirSync(join(root, "playground"))) cpSync(join(root, "playground", f), join(out, f));

const rel = relative(process.cwd(), out) || ".";
console.log(`playground-build: ok, ${ENGINE.length} engine files, ${SAMPLES.length} samples, version ${pkg.version} into ${rel}`);
console.log(`serve it with: npx --yes http-server ${rel} -p 8080   (or: python3 -m http.server 8080 --directory ${rel})`);
