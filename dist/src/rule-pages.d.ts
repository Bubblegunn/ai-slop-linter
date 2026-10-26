/**
 * One documentation page per rule, and the SARIF help strings, from rule metadata alone.
 *
 * This module is the single definition shared by src/sarif.ts (the helpUri and help producer)
 * and the site build (scripts/playground-build.mjs imports it from dist/src/), so a rule's
 * page, its SARIF help and --explain all draw on the same fields and the site root is written
 * down in one place. It carries no node: import, so the browser could use it too.
 */
import type { Rule } from "./doc.js";
/**
 * The published site root, the one place it is spelled out. test/pages-seo.test.mjs pins the
 * sitemap the build emits from it.
 */
export declare const SITE_ROOT = "https://bubblegunn.github.io/ai-slop-linter/";
/** The URL of a rule's page: the site root, then the page path the build writes for the id. */
export declare const rulePageUrl: (id: string) => string;
/** Escape text for use between HTML tags and inside quoted attribute values. */
export declare const escapeHtml: (text: string) => string;
/**
 * Plain text help: the same fields --explain prints, in its shape. SARIF 2.1.0 requires text
 * whenever help is present, so a caller never sends this without it.
 */
export declare function ruleHelpText(rule: Rule): string;
/**
 * Markdown help, the same fields. Where a rule's source is Wikipedia's Signs of AI writing,
 * the citation is a clickable link here: SARIF output is not part of the site, so it is not
 * bound by the page contract that keeps the generated pages link-free.
 */
export declare function ruleHelpMarkdown(rule: Rule): string;
/**
 * The page for one rule, in the playground's own visual style: the system font stack, the same
 * light and dark palettes, and nothing that loads from anywhere. The examples are quoted in
 * code blocks, like the README quotes them, and the source is text rather than a link, because
 * the page contract forbids a third-party link on a page. Every word comes from the rule.
 */
export declare function renderRulePage(rule: Rule): string;
