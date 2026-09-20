// What a consumer receives, installed and run. Not the source tree: `npm pack`, then a real
// `npm install` of that tarball into an empty directory, then the executable that package.json
// `bin` names, run on a file.
//
// This exists because #29 was invisible to twelve green checks. Everything else here builds
// first and then tests the build directory, so nothing ever saw the artefact a stranger gets.
// A package whose `bin` points outside `files`, or whose build output stops being packed,
// fails here and nowhere else.
//
// No network: this package has no dependencies, and the install is a local tarball.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
// npm is a .cmd shim on Windows, which spawnSync can only start through a shell.
const viaShell = process.platform === "win32";
const npm = (args, cwd) => {
  const r = spawnSync("npm", args, { cwd, encoding: "utf8", shell: viaShell });
  assert.equal(r.status, 0, `npm ${args.join(" ")} failed:\n${r.stdout}\n${r.stderr}`);
  return r.stdout;
};

test("the packed package installs and its executable runs", () => {
  const base = mkdtempSync(join(tmpdir(), "install-test-"));

  try {
    // npm 11 prints an array from `npm pack --json`; npm 12 prints an object keyed by the
    // package name. Neither shape is needed here — the file name is enough, and reading it off
    // disk keeps this test out of that argument entirely.
    const out = npm(["pack", "--pack-destination", base, "--silent"], root).trim();
    const tarball = out.split("\n").filter(Boolean).pop();
    assert.ok(tarball && tarball.endsWith(".tgz"), `npm pack did not name a tarball: ${out}`);

    // Its own directory, so the tarball sitting beside it cannot be read as a workspace member.
    const consumer = join(base, "consumer");
    mkdirSync(consumer, { recursive: true });
    npm(["init", "-y"], consumer);
    npm(["install", join(base, tarball), "--no-audit", "--no-fund", "--ignore-scripts"], consumer);

    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    const bins = Object.keys(pkg.bin ?? {});
    assert.ok(bins.length > 0, "package.json declares no bin");

    for (const name of bins) {
      const bin = join(consumer, "node_modules", ".bin", name);
      assert.ok(existsSync(bin), `${name} is not in node_modules/.bin after install`);
    }

    // An executable that exists and cannot run is the same defect one step later, so run it.
    // Eighty-one words, because this linter does not grade anything under fifty: a shorter
    // file would "pass" against an empty binary and prove nothing.
    const doc = join(consumer, "doc.md");
    writeFileSync(
      doc,
      "# Release notes\n\nIn the ever-evolving landscape of developer tooling, it is important to note " +
        "that this release is a testament to the dedication of our team. We delve into the intricacies " +
        "of the build system and unlock a seamless experience for every user who wants to leverage the " +
        "power of automation. Moreover, this update underscores our commitment to robust engineering, " +
        "and it is worth noting that the results speak for themselves across a wide range of real world " +
        "scenarios today.\n",
    );

    const first = bins[0];
    const r = spawnSync(join(consumer, "node_modules", ".bin", first), ["doc.md"], {
      cwd: consumer,
      encoding: "utf8",
      shell: viaShell,
    });

    assert.notEqual(r.status, 0, `the installed linter passed a file written to fail:\n${r.stdout}`);
    assert.match(r.stdout, /ai-vocabulary/);
    assert.match(r.stdout, /delve/);
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});
