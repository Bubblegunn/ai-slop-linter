// Shareable commitlint config: `extends: ["ai-slop-linter/commitlint/config"]`.
// Adds the plugin and turns the rule on as an error with the CLI's default threshold.
import plugin from "./index.mjs";

export default {
  plugins: [plugin],
  rules: {
    "ai-slop-linter/tells": [2, "always", { maxScore: 10 }],
  },
};
