import type { LintResult, Rule } from "./index.js";
export declare function renderSarif(results: LintResult[], ruleSet: readonly Rule[], version: string): string;
