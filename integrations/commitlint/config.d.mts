import type { TellsOptions } from "./index.mjs";

declare const config: {
  plugins: { rules: Record<string, unknown> }[];
  rules: { "ai-slop-linter/tells": [level: 2, applicable: "always", value: TellsOptions] };
};
export default config;
