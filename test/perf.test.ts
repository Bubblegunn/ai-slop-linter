import { test } from "node:test";
import assert from "node:assert/strict";
import { Worker } from "node:worker_threads";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { rules } from "../src/index.js";

// Every rule is a regular expression over the whole document, and rules now arrive from outside
// contributors. A pattern with nested quantifiers, or a leading `[ \t]*` that is retried from
// every position of a long run of spaces, is linear on ordinary prose and quadratic or
// exponential on one unlucky file, and no other test would notice. These inputs are the shapes
// that set such patterns off: long runs of the characters the rules look for, an unclosed fence
// (whose contents are masked to spaces), and one 100,000-character line with no newline.
//
// The budget is per rule per input and deliberately loose, so a slow CI runner does not flake:
// measured on 2026-10-14 on an Apple-silicon laptop with Node 24, the slowest pair (dash on the
// run of en dashes) took 40 ms. The two quadratic paths this test found when it was written
// took 3 to 5 s on the same machine: `dash` on a run of spaces, and an excerpt and a fix that
// each re-read the whole line for every finding on it. An exponential pattern never returns at
// all, which is why each rule runs in a worker that is terminated when it overruns, rather than
// being timed after the fact on the main thread.
const BUDGET_MS = 1000;

const N = 100_000;
const prose = "This is a word, and the delve into a rich tapestry of options. ";
const inputs: Record<string, string> = {
  "run of hyphens": "-".repeat(N),
  "run of em dashes": "—".repeat(N),
  "run of en dashes": "–".repeat(N),
  "run of commas": ",".repeat(N),
  "run of bold markers": "**".repeat(N / 2),
  "run of spaces": " ".repeat(N),
  "run of tabs": "\t".repeat(N),
  "spaced hyphens": " - ".repeat(N / 3),
  "one long word": "a".repeat(N) + "!",
  "hyphenated chain": "a-".repeat(N / 2),
  "unclosed fence": "```\n" + `${prose}\n`.repeat(N / prose.length),
  "100,000-character line with no newline": prose.repeat(Math.ceil(N / prose.length)).slice(0, N),
  "a list marker per line": "- \n".repeat(N / 3),
  "a heading marker per line": "# \n".repeat(N / 3),
};

const workerSource = `
const { parentPort, workerData } = require("node:worker_threads");
import(workerData.index).then(({ lintText }) => {
  for (const [name, text] of Object.entries(workerData.inputs)) {
    const t = performance.now();
    lintText("perf.md", text, { only: [workerData.rule] });
    parentPort.postMessage({ name, ms: performance.now() - t });
  }
  parentPort.postMessage({ done: true });
});
`;

/** Runs one rule over every input; resolves with the overruns, or with the input it hung on. */
function timeRule(rule: string): Promise<string[]> {
  const index = pathToFileURL(join(import.meta.dirname, "..", "src", "index.js")).href;
  const names = Object.keys(inputs);
  return new Promise((resolve, reject) => {
    const worker = new Worker(workerSource, { eval: true, workerData: { index, inputs, rule } });
    const slow: string[] = [];
    let at = 0;
    let watchdog: NodeJS.Timeout;
    // Module load is included in the first input's wait, never in its measured time.
    const arm = () => {
      clearTimeout(watchdog);
      watchdog = setTimeout(() => {
        void worker.terminate();
        resolve([...slow, `${names[at]}: still running after ${BUDGET_MS * 3} ms, terminated`]);
      }, BUDGET_MS * 3);
    };
    arm();
    worker.on("message", (m: { name?: string; ms?: number; done?: boolean }) => {
      if (m.done) {
        clearTimeout(watchdog);
        void worker.terminate();
        resolve(slow);
        return;
      }
      if (m.ms! > BUDGET_MS) slow.push(`${m.name}: ${Math.round(m.ms!)} ms`);
      at++;
      arm();
    });
    worker.on("error", (e) => {
      clearTimeout(watchdog);
      reject(e);
    });
  });
}

for (const rule of rules) {
  test(`${rule.id} stays within ${BUDGET_MS} ms on every adversarial input`, async () => {
    const slow = await timeRule(rule.id);
    assert.deepEqual(slow, [], `${rule.id} overran the budget:\n  ${slow.join("\n  ")}`);
  });
}

test("the adversarial inputs are the sizes they claim", () => {
  assert.equal(inputs["100,000-character line with no newline"]!.length, N);
  assert.ok(!inputs["100,000-character line with no newline"]!.includes("\n"));
  assert.ok(!inputs["unclosed fence"]!.slice(3).includes("```"), "the fence must stay open");
  for (const [name, text] of Object.entries(inputs)) assert.ok(text.length >= N * 0.99, `${name} is ${text.length} characters`);
});
