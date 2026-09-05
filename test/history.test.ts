import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { history, stripTrailers, renderHistory, configuredIdentity } from "../src/history.js";

const cli = join(process.cwd(), "dist", "src", "cli.js");

/**
 * A repository whose commits are dated in two different months, written by two people, one
 * of whom writes plainly and one of whom writes with tells.
 */
function fixture(): string {
  const dir = mkdtempSync(join(tmpdir(), "slop-history-"));
  const git = (...args: string[]) => execFileSync("git", args, { cwd: dir, encoding: "utf8" });
  git("init", "--quiet", "-b", "main");
  git("config", "user.email", "ada@example.com");
  git("config", "user.name", "Ada");

  const commit = (file: string, message: string, date: string, who?: { name: string; email: string }) => {
    writeFileSync(join(dir, file), `${file}\n`);
    git("add", "-A");
    const env = { ...process.env, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date, ...(who ? { GIT_AUTHOR_NAME: who.name, GIT_AUTHOR_EMAIL: who.email } : {}) };
    execFileSync("git", ["commit", "--quiet", "-m", message], { cwd: dir, env });
  };

  const plain = [
    "fix(parser): stop dropping the last row of a file with no trailing newline",
    "",
    "The reader split on newlines and threw away the empty tail, which also threw away a",
    "final row when the file did not end in one. It now keeps a tail that has content.",
    "A test writes a file both ways and asserts the same row count.",
    "",
    "Co-Authored-By: Someone Else <else@example.com>",
  ].join("\n");

  const telly = [
    "feat: enhance the export pipeline",
    "",
    "This commit delves into a comprehensive refactor of the export pipeline — a robust,",
    "seamless solution that leverages a cutting-edge approach. It's worth noting that this",
    "not only improves throughput but also unlocks a myriad of possibilities going forward.",
    "Let me know if you need anything else!",
  ].join("\n");

  commit("a.txt", plain, "2026-03-04T10:00:00+03:00");
  commit("b.txt", plain, "2026-03-11T10:00:00+03:00");
  commit("c.txt", telly, "2026-04-02T10:00:00+03:00");
  commit("d.txt", telly, "2026-04-09T10:00:00+03:00");
  commit("e.txt", telly, "2026-04-16T10:00:00+03:00", { name: "Bob", email: "bob@example.com" });
  return dir;
}

test("stripTrailers drops the trailer block and nothing else", () => {
  assert.equal(stripTrailers("Subject\n\nBody line.\n\nCo-Authored-By: A <a@b.c>\nSigned-off-by: B <b@c.d>\n"), "Subject\n\nBody line.\n");
  // A colon inside the prose is not a trailer.
  assert.equal(stripTrailers("Subject\n\n- Ne yapıldı: bir şey\n"), "Subject\n\n- Ne yapıldı: bir şey");
  // A line that looks like a trailer but sits above prose stays.
  assert.equal(stripTrailers("Subject\n\nRefs: #12\nand then more prose.\n"), "Subject\n\nRefs: #12\nand then more prose.");
  assert.equal(stripTrailers("Co-Authored-By: A <a@b.c>\n"), "");
});

test("history buckets an author's own messages by period and counts tells", () => {
  const dir = fixture();
  try {
    const h = history({ cwd: dir, authors: ["ada@example.com"] });
    assert.deepEqual(
      h.periods.map((p) => p.period),
      ["2026-03", "2026-04"],
    );
    assert.equal(h.messages, 4, "Bob's commit is not Ada's");
    const [march, april] = h.periods;
    assert.equal(march!.messages, 2);
    assert.equal(april!.messages, 2);
    assert.equal(march!.findings, 0, "the plain messages carry no tell");
    assert.ok(april!.findings > 0, "the padded messages do");
    assert.ok((april!.per1000 ?? 0) > (march!.per1000 ?? 0), "April reads worse than March");
    assert.ok(april!.rules.length > 0);

    // Naming the other author reads only his.
    const bob = history({ cwd: dir, authors: ["bob@example.com"] });
    assert.equal(bob.messages, 1);
    assert.deepEqual(
      bob.periods.map((p) => p.period),
      ["2026-04"],
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("trailers are not counted in the word total", () => {
  const dir = fixture();
  try {
    const h = history({ cwd: dir, authors: ["ada@example.com"] });
    const words = h.periods[0]!.words;
    assert.ok(words > 0);
    // "Co-Authored-By: Someone Else <else@example.com>" would add words if it were counted.
    assert.ok(!JSON.stringify(h).includes("Someone Else"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("buckets by quarter and year, and honours --since", () => {
  const dir = fixture();
  try {
    const q = history({ cwd: dir, authors: ["ada@example.com"], bucket: "quarter" });
    assert.deepEqual(
      q.periods.map((p) => p.period),
      ["2026-Q1", "2026-Q2"],
    );
    const y = history({ cwd: dir, authors: ["ada@example.com"], bucket: "year" });
    assert.deepEqual(
      y.periods.map((p) => p.period),
      ["2026"],
    );
    const since = history({ cwd: dir, authors: ["ada@example.com"], since: "2026-04-01" });
    assert.deepEqual(
      since.periods.map((p) => p.period),
      ["2026-04"],
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("the render carries the caveat, and a lone period gets no bar", () => {
  const dir = fixture();
  try {
    const two = renderHistory(history({ cwd: dir, authors: ["ada@example.com"] }));
    assert.match(two, /not a verdict on a person/);
    assert.match(two, /cannot tell\nyou who wrote anything/);
    assert.ok(two.includes("█"), "two periods can be compared, so they get a bar");

    const one = renderHistory(history({ cwd: dir, authors: ["bob@example.com"] }));
    assert.ok(!one.includes("█"), "one period has nothing to compare against");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("configuredIdentity reads the repository's own address", () => {
  const dir = fixture();
  try {
    assert.equal(configuredIdentity(dir), "ada@example.com");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("--history defaults to you, never exits 1, and answers json", () => {
  const dir = fixture();
  try {
    const run = (args: string[]) => spawnSync("node", [cli, ...args], { cwd: dir, encoding: "utf8" });
    const text = run(["--history"]);
    assert.equal(text.status, 0, "a description of writing never fails a build");
    assert.match(text.stdout, /ada@example\.com/);
    assert.match(text.stdout, /2026-03/);
    assert.ok(!text.stdout.includes("bob@example.com"), "the default is your own writing only");

    const json = run(["--history", "--format", "json"]);
    const parsed = JSON.parse(json.stdout);
    assert.deepEqual(parsed.identity, ["ada@example.com"]);
    assert.equal(parsed.bucket, "month");
    assert.equal(parsed.periods.length, 2);

    // The tells found in a period are the same rules the file path would report.
    assert.ok(parsed.periods[1].rules.some((r: { rule: string }) => r.rule === "dash"));

    assert.equal(run(["--history", "--by", "week"]).status, 2, "an unknown period is a usage error");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("--history outside a repository says so instead of throwing", () => {
  const dir = mkdtempSync(join(tmpdir(), "slop-nogit-"));
  try {
    const r = spawnSync("node", [cli, "--history", "--author", "a@b.c"], { cwd: dir, encoding: "utf8" });
    assert.equal(r.status, 2);
    assert.match(r.stderr, /could not read git history/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
