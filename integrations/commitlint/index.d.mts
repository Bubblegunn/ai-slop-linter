/** What commitlint hands a rule: the parsed message, with `raw` as the full text. */
export interface ParsedCommit {
  raw?: string;
  header?: string | null;
  body?: string | null;
  footer?: string | null;
}

export interface TellsOptions {
  /** Fail above this weighted score per 1,000 words (default 10). */
  maxScore?: number;
  /** Rule ids to skip. */
  ignore?: string[];
}

export type RuleOutcome = [valid: boolean, message: string];

export declare function tells(parsed: ParsedCommit, when?: "always" | "never", value?: TellsOptions): RuleOutcome;

declare const plugin: { rules: { "ai-slop-linter/tells": typeof tells } };
export default plugin;
