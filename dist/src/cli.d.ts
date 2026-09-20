#!/usr/bin/env node
import { type Bucket } from "./history.js";
import type { LintResult, Rule } from "./index.js";
interface Options {
    targets: string[];
    commit: boolean;
    commitMsg?: string;
    pr?: string;
    fix: boolean;
    format: "text" | "json" | "github" | "markdown";
    ignore: string[];
    only: string[];
    languages: string[];
    language?: string;
    maxScore: number | undefined;
    warn: boolean;
    baseline: boolean;
    baselineWrite: boolean;
    baselineFile?: string;
    cwd: string;
    listRules: boolean;
    explain?: string;
    init?: string;
    historyMode: boolean;
    authors: string[];
    bucket?: Bucket;
    since?: string;
}
export declare function parse(argv: string[]): Options;
interface Rules {
    ignore?: string[];
    only?: string[];
    maxScore?: number;
}
interface Override extends Rules {
    /** Globs, matched against the path as reported, with forward slashes. */
    files: string[];
}
interface Config extends Rules {
    include?: string[];
    /** Language rule packs to switch on besides English. */
    languages?: string[];
    /**
     * The language this repository's prose is written in, a BCP 47 tag, default "en". Not the
     * same as `languages`, which switches extra rule packs on: this one says what the text is,
     * and rules whose evidence is English stand down when it is not English.
     */
    language?: string;
    baseline?: string;
    /** Applied in order to a file that matches; a later entry wins over an earlier one. */
    overrides?: Override[];
}
/** The rule settings for one path: the top level, then every override that matches it. */
export declare function settingsFor(config: Config, path: string): {
    ignore: string[];
    only: string[];
    maxScore: number | undefined;
};
/** One rule, in full, for someone who has just been told their text has it. */
export declare function explain(rule: Rule): string;
export declare function renderGithub(results: LintResult[], maxScore: number): string;
/** A Markdown table for a pull request comment or an issue; the same facts as the text output. */
export declare function renderMarkdown(results: LintResult[], maxScore: number): string;
/** `--init`: the config, and on request the workflow or the commit-msg hook. */
export declare function init(cwd: string, what: "config" | "action" | "hook"): string[];
export {};
