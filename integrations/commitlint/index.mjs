// commitlint plugin: one rule, `ai-slop-linter/tells`, which lints the whole commit message
// with the same twenty rules as the CLI. Fails on an error-severity tell or a score above
// `maxScore` (default 10). Node built-ins and this package only.
//
//   // commitlint.config.js
//   export default {
//     plugins: ["ai-slop-linter/commitlint"],
//     rules: { "ai-slop-linter/tells": [2, "always", { maxScore: 10, ignore: [] }] },
//   };
//
// or `extends: ["ai-slop-linter/commitlint/config"]` for exactly that.
import { lintText } from "../../dist/src/index.js";

export function tells(parsed, when = "always", value = {}) {
  const { maxScore = 10, ignore = [] } = value ?? {};
  const raw = typeof parsed?.raw === "string" ? parsed.raw : [parsed?.header, parsed?.body, parsed?.footer].filter(Boolean).join("\n\n");
  const result = lintText("commit message", raw, { ignore, floor: 0 });
  const fails = result.errors > 0 || result.score > maxScore;
  const lines = result.findings.map((f) => `${f.line}:${f.column} ${f.severity} ${f.rule}: ${f.message}`);
  const reason = fails ? `AI-writing tells (score ${result.score}, max ${maxScore}):\n  ${lines.join("\n  ")}` : "";
  const valid = when === "never" ? fails : !fails;
  return [valid, when === "never" ? (fails ? "" : "expected the message to carry a tell") : reason];
}

const plugin = { rules: { "ai-slop-linter/tells": tells } };
export default plugin;
