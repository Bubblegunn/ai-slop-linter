import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import AjvDraft04 from "ajv-draft-04";
import addFormats from "ajv-formats";

// The OASIS SARIF 2.1.0 schema (errata01), vendored so the check needs no network:
// https://docs.oasis-open.org/sarif/sarif/v2.1.0/errata01/os/schemas/sarif-schema-2.1.0.json
// It replaced `sarif-multitool validate`, which exits 0 on every broken file it was given and does
// not report enum violations at all (#43).
const schema = JSON.parse(readFileSync(join(process.cwd(), "test", "fixtures", "sarif-schema-2.1.0.json"), "utf8"));
// Both packages are CommonJS; under NodeNext a default import is module.exports, which holds the export as `default`.
const ajv = new AjvDraft04.default({ allErrors: true, strict: false });
// Without the formats, ajv skips every `uri`, `uri-reference` and `date-time` in the schema and says so only in a log line.
addFormats.default(ajv);
const validate = ajv.compile(schema);

const cli = join(process.cwd(), "dist", "src", "cli.js");
const sloppy = join(process.cwd(), "test", "fixtures", "sloppy.md");

const emitted = (target = sloppy) => {
  const r = spawnSync("node", [cli, "--format", "sarif", "--warn", target], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  return JSON.parse(r.stdout);
};

const errorsOf = (log: unknown) => (validate(log) ? [] : (validate.errors ?? []).map((e) => `${e.instancePath} ${e.message}`));

test("the SARIF the CLI emits validates against the 2.1.0 schema", () => {
  const log = emitted();
  assert.ok(log.runs[0].results.length > 0, "the fixture must produce results, or the results are never validated");
  assert.deepEqual(errorsOf(log), []);
});

test("the CLI emits schema-valid SARIF for paths with spaces and non-ASCII characters", async () => {
  const dir = await mkdtemp(join(tmpdir(), "slop-sarif-"));
  try {
    const source = readFileSync(sloppy, "utf8");
    for (const [name, encodedName] of [
      ["my notes.md", "my%20notes.md"],
      ["café.md", "caf%C3%A9.md"],
    ] as const) {
      const file = join(dir, name);
      await writeFile(file, source, "utf8");
      const log = emitted(file);
      assert.ok(log.runs[0].results.length > 0, `${name} must produce results, or the results are never validated`);
      assert.deepEqual(errorsOf(log), [], `${name} should produce schema-valid SARIF`);
      const uri = log.runs[0].results[0].locations[0].physicalLocation.artifactLocation.uri;
      assert.ok(uri.endsWith(`/${encodedName}`), `expected an encoded URI ending in ${encodedName}, got ${uri}`);
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

// The two parts of #63 that a run on macOS or Linux cannot reach: a Windows path arrives with
// backslashes, which must become separators before each segment is encoded (encoded whole, they
// would be `%5C`), and `$schema` must stay the URL that resolves (the old one answered 404).
test("a Windows path becomes slash-separated encoded segments, and $schema is the errata01 URL", async () => {
  const { renderSarif } = await import(join(process.cwd(), "dist", "src", "sarif.js"));
  const { rules } = await import(join(process.cwd(), "dist", "src", "index.js"));
  const rule = rules[0];
  const finding = { rule: rule.id, severity: rule.severity, line: 1, column: 1, excerpt: "x", message: "m" };
  const result = { path: "docs\\my notes\\café.md", words: 1, findings: [finding], stoodDown: [], score: null, grade: null };
  const log = JSON.parse(renderSarif([result], rules, "0.0.0"));
  assert.equal(log.runs[0].results[0].locations[0].physicalLocation.artifactLocation.uri, "docs/my%20notes/caf%C3%A9.md");
  assert.equal(log.$schema, "https://docs.oasis-open.org/sarif/sarif/v2.1.0/errata01/os/schemas/sarif-schema-2.1.0.json");
  assert.deepEqual(errorsOf(log), []);
});

// Each of these is the emitted log with one defect. If the validator ever accepts one, the test
// above is decoration: it would pass whatever the CLI wrote.
const defects: Array<[string, (log: any) => void]> = [
  ["a missing required property", (log) => delete log.runs[0].tool.driver.name],
  ["a missing top-level version", (log) => delete log.version],
  ["a result level outside the enum", (log) => (log.runs[0].results[0].level = "fatal")],
  ["a columnKind outside the enum", (log) => (log.runs[0].columnKind = "bytes")],
  ["an artifact uri that is not a URI reference", (log) => (log.runs[0].results[0].locations[0].physicalLocation.artifactLocation.uri = "my notes.md")],
];

for (const [name, breakIt] of defects) {
  test(`the schema check rejects ${name}`, () => {
    const log = emitted();
    breakIt(log);
    assert.notDeepEqual(errorsOf(log), []);
  });
}
