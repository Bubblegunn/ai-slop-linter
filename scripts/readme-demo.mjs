#!/usr/bin/env node
// The README's demo block must be what the tool actually prints. It is the first thing a
// visitor reads, and it went stale twice: the fixture's score and word count moved when the
// rules changed in 0.1.4 while the block still showed the old numbers, so anyone who ran the
// command got different output from the one advertised.
//
// `--check` fails when the committed block no longer matches a fresh run; without it, the
// block and the sentence above it are rewritten. Same shape as bench/precision.mjs.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const FIXTURE = "test/fixtures/sloppy.md";
const LINES = 12; // the summary line plus the first eleven findings

// The fixture has findings, so the CLI exits 1 and execFileSync throws. That is the expected
// path here: the output we want is on the error's stdout.
let stdout;
try {
  stdout = execFileSync(process.execPath, [join(root, "dist/src/cli.js"), FIXTURE], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
} catch (e) {
  if (typeof e.stdout !== "string" || e.stdout === "") throw e;
  stdout = e.stdout;
}
const run = stdout.split("\n").slice(0, LINES).join("\n").trimEnd();

const words = /,\s*(\d+)\s+words,/.exec(run.split("\n")[0]);
if (!words) {
  console.error("readme-demo: could not read the word count out of the run's first line");
  process.exit(1);
}

const path = join(root, "README.md");
const readme = readFileSync(path, "utf8");

const intro = /^Real output on \[`test\/fixtures\/sloppy\.md`\]\(test\/fixtures\/sloppy\.md\), a (\d+)-word file$/m.exec(readme);
if (!intro) {
  console.error("readme-demo: the 'Real output on ...' sentence is not in README.md in the expected shape");
  process.exit(1);
}

const fenceStart = readme.indexOf("```\n", intro.index);
const fenceEnd = readme.indexOf("```\n", fenceStart + 4);
if (fenceStart === -1 || fenceEnd === -1) {
  console.error("readme-demo: no fenced block follows the 'Real output on ...' sentence");
  process.exit(1);
}
const committed = readme.slice(fenceStart + 4, fenceEnd).trimEnd();

const check = process.argv.includes("--check");
const sameBlock = committed === run;
const sameCount = intro[1] === words[1];

if (sameBlock && sameCount) {
  console.log(`readme-demo: ok, the block matches a fresh run (${words[1]} words)`);
  process.exit(0);
}

if (check) {
  console.error("readme-demo: README.md does not match a fresh run. Run `node scripts/readme-demo.mjs` to update it.\n");
  if (!sameCount) console.error(`  word count: README says ${intro[1]}, the run says ${words[1]}`);
  if (!sameBlock) {
    const a = committed.split("\n");
    const b = run.split("\n");
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      if (a[i] !== b[i]) {
        console.error(`  first difference on line ${i + 1}:\n    README: ${a[i] ?? "(missing)"}\n    run:    ${b[i] ?? "(missing)"}`);
        break;
      }
    }
  }
  process.exit(1);
}

const updated =
  readme.slice(0, intro.index) +
  intro[0].replace(`a ${intro[1]}-word file`, `a ${words[1]}-word file`) +
  readme.slice(intro.index + intro[0].length, fenceStart + 4) +
  run + "\n" +
  readme.slice(fenceEnd);
writeFileSync(path, updated);
console.log(`readme-demo: README.md updated from a fresh run (${words[1]} words)`);
