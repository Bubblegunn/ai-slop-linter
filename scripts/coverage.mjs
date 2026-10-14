// @ts-check
// Runs the test suite under Node's built-in coverage and fails below the thresholds.
//
// The test files are read from the `test` script in package.json rather than listed again here,
// so a test added there is covered here without a second edit. Coverage is measured on the
// compiled dist/src, the code the package ships; the CLI tests spawn it as a subprocess, and
// those runs count, because the test runner collects through NODE_V8_COVERAGE, which the
// subprocesses inherit.
//
// The thresholds are checked here, from the lcov totals, and not with Node's own
// --test-coverage-lines and friends: Node 24 reads those as whole numbers, so a threshold of
// 98.9 is enforced as 98, and a run that lost a test and fell to 98.84 % passed it.
//
// The thresholds are the values measured on 2026-10-14 with Node 24, on macOS and in a Linux
// container, which agreed exactly. Raise them when coverage rises; lowering one needs a reason
// in the commit that does it.
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const thresholds = { lines: 98.96, branches: 89.86, functions: 98.83 };

const root = join(import.meta.dirname, "..");
const script = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).scripts.test;
const marker = "node --test ";
const at = script.indexOf(marker);
if (at === -1) {
  console.error(`coverage: the test script no longer contains "${marker}", so the test files cannot be found: ${script}`);
  process.exit(2);
}
const files = script.slice(at + marker.length).trim().split(/\s+/);

const dir = mkdtempSync(join(tmpdir(), "slop-coverage-"));
const lcov = join(dir, "lcov.info");
let code = 0;
try {
  const args = [
    "--test",
    "--experimental-test-coverage",
    "--test-coverage-include=dist/src/**",
    "--test-reporter=spec",
    "--test-reporter-destination=stdout",
    "--test-reporter=lcov",
    `--test-reporter-destination=${lcov}`,
    ...files,
  ];
  const run = spawnSync(process.execPath, args, { cwd: root, stdio: "inherit" });
  code = run.status ?? 1;
  if (code === 0) code = check();
} finally {
  rmSync(dir, { recursive: true, force: true });
}
process.exit(code);

/** Compares the lcov totals with the thresholds and returns the exit code. */
function check() {
  /** @type {Record<string, number>} */
  const total = {};
  for (const m of readFileSync(lcov, "utf8").matchAll(/^(LF|LH|BRF|BRH|FNF|FNH):(\d+)$/gm)) total[m[1]] = (total[m[1]] ?? 0) + Number(m[2]);
  /** @param {string} hit @param {string} found */
  const pct = (hit, found) => (total[found] ? Math.round((10000 * (total[hit] ?? 0)) / total[found]) / 100 : 0);
  const measured = { lines: pct("LH", "LF"), branches: pct("BRH", "BRF"), functions: pct("FNH", "FNF") };
  if (!total.LF) {
    console.error("coverage: the lcov report counted no lines, so nothing was measured");
    return 1;
  }
  let failed = false;
  for (const key of /** @type {const} */ (["lines", "branches", "functions"])) {
    const ok = measured[key] >= thresholds[key];
    if (!ok) failed = true;
    console.log(`coverage ${key}: ${measured[key].toFixed(2)} % (threshold ${thresholds[key].toFixed(2)} %) ${ok ? "ok" : "BELOW THRESHOLD"}`);
  }
  return failed ? 1 : 0;
}
