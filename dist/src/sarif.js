import { rulePageUrl, ruleHelpText, ruleHelpMarkdown } from "./rule-pages.js";
const SCHEMA = "https://docs.oasis-open.org/sarif/sarif/v2.1.0/errata01/os/schemas/sarif-schema-2.1.0.json";
const levelFor = (severity) => severity === "error" ? "error" : severity === "warning" ? "warning" : "note";
export function renderSarif(results, ruleSet, version) {
    const rules = ruleSet.map((rule) => ({
        id: rule.id,
        name: rule.title,
        shortDescription: { text: rule.title },
        fullDescription: { text: rule.why },
        defaultConfiguration: { level: levelFor(rule.severity) },
        properties: { source: rule.source },
        helpUri: rulePageUrl(rule.id),
        help: { text: ruleHelpText(rule), markdown: ruleHelpMarkdown(rule) },
    }));
    const indexes = new Map(ruleSet.map((rule, index) => [rule.id, index]));
    const sarifResults = results.flatMap((result) => result.findings.map((finding) => ({
        ruleId: finding.rule,
        ruleIndex: indexes.get(finding.rule),
        level: levelFor(finding.severity),
        message: { text: finding.message },
        locations: [{
                physicalLocation: {
                    artifactLocation: { uri: result.path.replaceAll("\\", "/").split("/").map((segment) => encodeURIComponent(segment)).join("/") },
                    region: { startLine: finding.line, startColumn: finding.column, endLine: finding.endLine, endColumn: finding.endColumn },
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
