#!/usr/bin/env node
// One command releases a version: `npm run release -- 0.2.0` (or patch | minor | major).
//
// It refuses unless the tree is clean, the branch is main and equal to origin/main, the last
// CI run on main passed, and CHANGELOG.md has an unreleased entry for that version. Then it
// dates the entry, sets the version everywhere the repository states it, runs the tests,
// commits, tags, and pushes. The release workflow does the publishing; nothing here talks to
// a registry. `--dry-run` prints the plan and changes nothing.
//
// Same file in every Bubblegunn repository. Node built-ins only.
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { compareVersions } from "./version.mjs";

const root = process.cwd();
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const spec = args.find((a) => !a.startsWith("--"));

const fail = (message) => {
  console.error(`release: ${message}`);
  process.exit(1);
};
const git = (...a) => execFileSync("git", a, { cwd: root, encoding: "utf8" }).trim();
// npm and gh are .cmd shims on Windows, which spawnSync can only start through a shell.
const viaShell = process.platform === "win32";
const sh = (cmd, a, opts = {}) => {
  const r = spawnSync(cmd, a, { cwd: root, stdio: "inherit", shell: viaShell, ...opts });
  if (r.status !== 0) fail(`${cmd} ${a.join(" ")} failed`);
};
const read = (f) => readFileSync(join(root, f), "utf8");
const has = (f) => existsSync(join(root, f));

if (!spec) fail("usage: npm run release -- <X.Y.Z | patch | minor | major> [--dry-run]");

const pkg = JSON.parse(read("package.json"));
const name = pkg.name;
const current = pkg.version;
const target = (() => {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(current);
  if (!m) fail(`package.json version ${current} is not X.Y.Z`);
  const [, ma, mi, pa] = m.map(Number);
  if (spec === "major") return `${ma + 1}.0.0`;
  if (spec === "minor") return `${ma}.${mi + 1}.0`;
  if (spec === "patch") return `${ma}.${mi}.${pa + 1}`;
  if (!/^\d+\.\d+\.\d+$/.test(spec)) fail(`${spec} is not X.Y.Z, patch, minor or major`);
  return spec;
})();
const tag = `v${target}`;
// pre-commit pins a rev and installs the repository from that checkout, so the rev it pins
// has to carry the built output. See the block that creates it, below.
const hooksTag = `${tag}-pre-commit`;
if (compareVersions(target, current) < 0) fail(`${target} is lower than the current version ${current}`);

// Preconditions.
if (git("status", "--porcelain")) fail("the working tree is not clean; commit or stash first");
const branch = git("rev-parse", "--abbrev-ref", "HEAD");
if (branch !== "main") fail(`on branch ${branch}; releases are cut from main`);
git("fetch", "origin", "main", "--tags");
const head = git("rev-parse", "HEAD");
if (head !== git("rev-parse", "origin/main")) fail("main is not equal to origin/main; pull or push first");
if (git("tag", "--list", tag)) fail(`tag ${tag} already exists`);
if (has(".pre-commit-hooks.yaml") && git("tag", "--list", hooksTag)) fail(`tag ${hooksTag} already exists`);
if (process.env.RELEASE_SKIP_CI_CHECK !== "1") {
  const r = spawnSync("gh", ["run", "list", "--branch", "main", "--workflow", "ci", "--limit", "1", "--json", "conclusion,headSha,status"], {
    cwd: root,
    encoding: "utf8",
    shell: viaShell,
  });
  if (r.status !== 0) fail(`gh run list failed (is gh installed and logged in?)\n${r.stderr}`);
  const [run] = JSON.parse(r.stdout || "[]");
  if (!run) fail("no CI run found on main");
  if (run.headSha !== head) fail(`the latest CI run is for ${run.headSha.slice(0, 7)}, not HEAD ${head.slice(0, 7)}; wait for CI`);
  if (run.status !== "completed" || run.conclusion !== "success") fail(`the latest CI run on main is ${run.status} / ${run.conclusion}; releases need a green main`);
}

// The CHANGELOG entry: the first "## " heading must be this version, not yet dated.
const changelog = read("CHANGELOG.md");
const heading = /^## +(\S+)(.*)$/m.exec(changelog);
if (!heading) fail("CHANGELOG.md has no '## ' heading");
const [headingLine, headingVersion, headingRest] = heading;
if (headingVersion !== target) fail(`the top CHANGELOG entry is ${headingVersion}, not ${target}; write the entry first`);
if (/\d{4}-\d{2}-\d{2}/.test(headingRest)) fail(`CHANGELOG entry ${target} is already dated (${headingRest.trim()})`);
const entryBody = changelog.slice(heading.index + headingLine.length).split(/^## /m)[0].trim();
if (!entryBody) fail(`CHANGELOG entry ${target} is empty`);

const today = new Date().toISOString().slice(0, 10);
const plan = [`CHANGELOG.md: "${headingLine}" -> "## ${target} (${today})"`, `package.json: ${current} -> ${target}`];
if (has("package-lock.json")) plan.push(`package-lock.json: ${target}`);
if (has("CITATION.cff")) plan.push(`CITATION.cff: version ${target}, date-released ${today}`);
if (has("action.yml") && /^  version:\n/m.test(read("action.yml"))) plan.push(`action.yml: version input default ${target}`);
if (has("python/pyproject.toml")) plan.push(`python/pyproject.toml: version ${target}`);
if (has(".claude-plugin/plugin.json")) plan.push(`.claude-plugin/plugin.json: version ${target}`);
const readmes = readdirSync(root).filter((f) => /^README(\.[a-zA-Z-]+)?\.md$/.test(f));
const pinned = new RegExp(`Bubblegunn/${name}@v\\d+\\.\\d+\\.\\d+`);
const pinnedAll = new RegExp(pinned.source, "g");
for (const f of readmes) if (pinned.test(read(f))) plan.push(`${f}: Bubblegunn/${name}@${tag}`);
if (pkg.scripts?.["release:prepare"]) plan.push("npm run release:prepare");
const major = `v${target.split(".")[0]}`;
if (has(".pre-commit-hooks.yaml")) plan.push(`tag ${hooksTag} at a commit carrying the built output, and push it (main and the working tree are not touched)`);
plan.push("npm test", `commit "chore(release): ${target}"`, `tag ${tag} (annotated, message = the CHANGELOG entry)`, "git push origin main --follow-tags", `move ${major} to ${tag} and force-push it (the moving tag Actions users pin)`);

console.log(`release ${name} ${current} -> ${target}${dryRun ? " (dry run)" : ""}`);
for (const p of plan) console.log(`  - ${p}`);
if (dryRun) process.exit(0);

// Apply.
const replaceIn = (f, from, to, label) => {
  const before = read(f);
  // A file already carrying the target value is normal: the repository sets the version
  // when the entry is written. Only a pattern that matches nothing is a mistake.
  const matched = typeof from === "string" ? before.includes(from) : from.test(before);
  if (!matched) fail(`${f}: nothing matched for ${label}`);
  const after = before.replace(from, to);
  if (after !== before) writeFileSync(join(root, f), after);
};
replaceIn("CHANGELOG.md", headingLine, `## ${target} (${today})`, "the entry heading");
sh("npm", ["version", target, "--no-git-tag-version", "--allow-same-version"], { stdio: "ignore" });
if (has("CITATION.cff")) {
  replaceIn("CITATION.cff", /^version: .*$/m, `version: "${target}"`, "version");
  replaceIn("CITATION.cff", /^date-released: .*$/m, `date-released: "${today}"`, "date-released");
}
if (has("action.yml") && /^  version:\n/m.test(read("action.yml"))) {
  replaceIn("action.yml", /(^  version:\n(?:    (?!default:).*\n)*    default: ")[^"]*(")/m, `$1${target}$2`, "the version input default");
}
if (has("python/pyproject.toml")) replaceIn("python/pyproject.toml", /^version = ".*"$/m, `version = "${target}"`, "version");
if (has(".claude-plugin/plugin.json")) replaceIn(".claude-plugin/plugin.json", /"version": "[^"]*"/, `"version": "${target}"`, "version");
for (const f of readmes) {
  const text = read(f);
  if (pinned.test(text)) writeFileSync(join(root, f), text.replace(pinnedAll, `Bubblegunn/${name}@${tag}`));
}
// A README that pins the pre-commit rev moves with it. Conditional: most repositories do not.
const pinnedHooks = /rev: v\d+\.\d+\.\d+-pre-commit/g;
for (const f of readmes) {
  const text = read(f);
  if (pinnedHooks.test(text)) writeFileSync(join(root, f), text.replace(pinnedHooks, `rev: ${hooksTag}`));
}
if (pkg.scripts?.["release:prepare"]) sh("npm", ["run", "release:prepare"]);
sh("npm", ["test"]);

const message = [
  `chore(release): ${target}`,
  "",
  `CHANGELOG entry dated ${today}; version set to ${target} in ${plan
    .filter((p) => /^[\w./-]+: /.test(p) && !p.startsWith("CHANGELOG"))
    .map((p) => p.split(":")[0])
    .join(", ")}.`,
  "",
  "For the customer:",
  `What changed: Version ${target} is tagged; the release workflow publishes it with provenance.`,
  `Why it matters: \`npx ${name}@${target}\` installs exactly this commit, and the CHANGELOG says what is in it.`,
  "",
  "Sade dil (teknik olmayan biri için):",
  `- Ne yapıldı: ${target} sürümü etiketlendi; yayın otomatik olarak kayıt defterine çıkar.`,
  "- Ne işe yarar: Kullanıcılar bu sürümü tek komutla kurar ve içinde ne olduğunu CHANGELOG'dan okur.",
  "",
].join("\n");
const dir = mkdtempSync(join(tmpdir(), "release-"));
try {
  writeFileSync(join(dir, "commit.txt"), message);
  writeFileSync(join(dir, "tag.txt"), `${name} ${target}\n\n${entryBody}\n`);
  git("add", "-A");
  sh("git", ["commit", "--quiet", "-F", join(dir, "commit.txt")]);
  sh("git", ["tag", "-a", tag, "-F", join(dir, "tag.txt")]);
  sh("git", ["push", "origin", "main", "--follow-tags"]);
  // The major tag moves from here, not from the workflow: release tags are admin-only by
  // ruleset, and the person running this command is the admin. A workflow token could not.
  sh("git", ["tag", "--force", major, "HEAD"], { stdio: "ignore" });
  sh("git", ["push", "--force", "origin", `refs/tags/${major}`]);
  // pre-commit installs a hook repository from a git checkout, and a checkout of a package
  // whose build output is gitignored contains no executable: npm links nothing and the hook
  // reports "Executable not found". Measured in ai-slop-linter#29, together with the reason a
  // `prepare` script is not the way out — npm 12 ships `allow-git = "none"` and lifecycle
  // scripts off by default, so an install-time build has a shelf life.
  //
  // So the rev pre-commit pins carries the built output. It is written through a temporary
  // index rather than by committing on main: the branch stays clean, and this command never
  // touches the working tree or the real index.
  if (has(".pre-commit-hooks.yaml")) {
    const binTargets = [...new Set(Object.values(pkg.bin ?? {}))].map((b) => b.replace(/^\.\//, ""));
    if (binTargets.length === 0) fail(".pre-commit-hooks.yaml is present but package.json declares no bin");
    sh("npm", ["run", "build"]);
    for (const b of binTargets) if (!has(b)) fail(`the build did not produce ${b}, which package.json bin points at`);
    const shipped = (pkg.files ?? []).filter((f) => has(f));
    if (shipped.length === 0) fail("package.json declares no files, so there is nothing to put in the tag");
    const index = join(dir, "pre-commit-index");
    const withIndex = (...a) => execFileSync("git", a, { cwd: root, encoding: "utf8", env: { ...process.env, GIT_INDEX_FILE: index } }).trim();
    withIndex("read-tree", "HEAD");
    withIndex("add", "--force", ...shipped);
    const tree = withIndex("write-tree");
    writeFileSync(join(dir, "hooks-commit.txt"), `chore(release): ${target} with the built output pre-commit needs\n\nNot on main. This commit exists so that \`rev: ${hooksTag}\` resolves to a tree that\ncontains ${binTargets.join(", ")}; a checkout of main does not, and nothing builds it\nat install time.\n`);
    const commit = withIndex("commit-tree", tree, "-p", git("rev-parse", "HEAD"), "-F", join(dir, "hooks-commit.txt"));
    writeFileSync(join(dir, "hooks-tag.txt"), `${name} ${target} for pre-commit\n\nSame release as ${tag}, plus the built output. Pin this rev in .pre-commit-config.yaml.\n`);
    sh("git", ["tag", "-a", "-F", join(dir, "hooks-tag.txt"), hooksTag, commit]);
    sh("git", ["push", "origin", `refs/tags/${hooksTag}`]);
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}
const repo = String(pkg.repository?.url ?? pkg.repository ?? "")
  .replace(/^git\+/, "")
  .replace(/\.git$/, "");
if (has(".pre-commit-hooks.yaml")) console.log(`${hooksTag} pushed: the same release with the built output, for pre-commit users.`);
console.log(`\n${tag} pushed and ${major} moved to it. Watch the release workflow: ${repo}/actions/workflows/release.yml`);
