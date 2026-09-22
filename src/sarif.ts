import type { Finding, LintResult, Rule } from "./index.js";

const SCHEMA = "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json";
const WIKI = "https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing";

const levelFor = (severity: Finding["severity"]): "error" | "warning" | "note" =>
  severity === "error" ? "error" : severity === "warning" ? "warning" : "note";

const helpUri = (source: string): string | undefined =>
  source.startsWith("Wikipedia,") ? WIKI : undefined;

export function renderSarif(results: LintResult[], ruleSet: readonly Rule[], version: string): string {
  const rules = ruleSet.map((rule) => ({
    id: rule.id,
    name: rule.title,
    shortDescription: { text: rule.title },
    fullDescription: { text: rule.why },
    defaultConfiguration: { level: levelFor(rule.severity) },
    properties: { source: rule.source },
    ...(helpUri(rule.source) ? { helpUri: helpUri(rule.source) } : {}),
  }));
  const indexes = new Map(ruleSet.map((rule, index) => [rule.id, index]));
  const sarifResults = results.flatMap((result) => result.findings.map((finding) => ({
    ruleId: finding.rule,
    ruleIndex: indexes.get(finding.rule),
    level: levelFor(finding.severity),
    message: { text: finding.message },
    locations: [{
      physicalLocation: {
        artifactLocation: { uri: result.path.replaceAll("\\", "/") },
        region: { startLine: finding.line, startColumn: finding.column },
      },
    }],
  })));
  return JSON.stringify({
    $schema: SCHEMA,
    version: "2.1.0",
    runs: [{
      tool: {
        driver: {
          name: "ai-slop-linter",
          semanticVersion: version,
          informationUri: "https://github.com/Bubblegunn/ai-slop-linter",
          rules,
        },
      },
      columnKind: "utf16CodeUnits",
      defaultEncoding: "UTF-8",
      results: sarifResults,
    }],
  }, null, 2);
}
