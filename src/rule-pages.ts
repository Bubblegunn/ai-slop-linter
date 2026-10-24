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
export const SITE_ROOT = "https://bubblegunn.github.io/ai-slop-linter/";

/** The URL of a rule's page: the site root, then the page path the build writes for the id. */
export const rulePageUrl = (id: string): string => `${SITE_ROOT}rules/${id}/`;

/** Escape text for use between HTML tags and inside quoted attribute values. */
export const escapeHtml = (text: string): string =>
  text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const WIKI = "https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing";

/** The sections --explain prints, so a page and the SARIF help carry the same material. */
const indent2 = (text: string) => text.split("\n").map((line) => `  ${line}`).join("\n");

/**
 * Plain text help: the same fields --explain prints, in its shape. SARIF 2.1.0 requires text
 * whenever help is present, so a caller never sends this without it.
 */
export function ruleHelpText(rule: Rule): string {
  return [
    `${rule.id}  ${rule.severity}  ${rule.title}`,
    `source: ${rule.source}`,
    "",
    "Why",
    indent2(rule.why),
    "",
    "Instead of",
    indent2(rule.example.before.trimEnd()),
    "",
    "Write",
    indent2(rule.example.after.trimEnd()),
    "",
    "Ignore it when",
    indent2(rule.ignoreWhen),
    "",
    `Switch it off with --ignore ${rule.id}, or per file with <!-- slop-ignore ${rule.id} -->.`,
  ].join("\n");
}

/**
 * Markdown help, the same fields. Where a rule's source is Wikipedia's Signs of AI writing,
 * the citation is a clickable link here: SARIF output is not part of the site, so it is not
 * bound by the page contract that keeps the generated pages link-free.
 */
export function ruleHelpMarkdown(rule: Rule): string {
  const source = rule.source.startsWith("Wikipedia,")
    ? `${rule.source}, in [Wikipedia: Signs of AI writing](${WIKI})`
    : rule.source;
  return [
    `\`${rule.id}\` (${rule.severity}): ${rule.title}`,
    "",
    `Source: ${source}`,
    "",
    "## Why",
    "",
    rule.why,
    "",
    "## Instead of",
    "",
    "```",
    rule.example.before.trimEnd(),
    "```",
    "",
    "## Write",
    "",
    "```",
    rule.example.after.trimEnd(),
    "```",
    "",
    "## Ignore it when",
    "",
    rule.ignoreWhen,
  ].join("\n");
}

/**
 * The page for one rule, in the playground's own visual style: the system font stack, the same
 * light and dark palettes, and nothing that loads from anywhere. The examples are quoted in
 * code blocks, like the README quotes them, and the source is text rather than a link, because
 * the page contract forbids a third-party link on a page. Every word comes from the rule.
 */
export function renderRulePage(rule: Rule): string {
  const esc = escapeHtml;
  return [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<meta name="referrer" content="no-referrer">',
    `<title>${esc(rule.id)} (ai-slop-linter rule)</title>`,
    `<meta name="description" content="${esc(rule.title)}. ${esc(rule.why)}">`,
    "<style>",
    ":root { --bg: #fbfbfa; --fg: #17171a; --dim: #5c5c66; --line: #dededa; --mono: ui-monospace, SFMono-Regular, \"SF Mono\", Menlo, Consolas, monospace; --sans: system-ui, -apple-system, \"Segoe UI\", Roboto, Helvetica, Arial, sans-serif; }",
    "@media (prefers-color-scheme: dark) { :root { --bg: #16161a; --fg: #eeeef2; --dim: #a2a2ae; --line: #33333c; } }",
    "* { box-sizing: border-box; }",
    "body { margin: 0; background: var(--bg); color: var(--fg); font: 16px/1.55 var(--sans); }",
    ".wrap { max-width: 60rem; margin: 0 auto; padding: 2rem 1rem 4rem; }",
    "h1 { font-size: 1.5rem; margin: 0 0 .25rem; letter-spacing: -.01em; }",
    "h2 { font-size: 1.05rem; margin: 2rem 0 .5rem; }",
    "p { margin: .5rem 0; }",
    ".dim { color: var(--dim); }",
    "code, pre { font-family: var(--mono); }",
    "pre { border: 1px solid var(--line); border-radius: 6px; padding: .75rem 1rem; overflow-x: auto; }",
    "</style>",
    "</head>",
    "<body>",
    '<div class="wrap">',
    `<h1><code>${esc(rule.id)}</code></h1>`,
    `<p class="lede">${esc(rule.title)}</p>`,
    `<p class="dim">severity: ${esc(rule.severity)}</p>`,
    `<p>Source: ${esc(rule.source)}</p>`,
    "<h2>Why</h2>",
    `<p>${esc(rule.why)}</p>`,
    "<h2>Instead of</h2>",
    `<pre><code>${esc(rule.example.before.trimEnd())}</code></pre>`,
    "<h2>Write</h2>",
    `<pre><code>${esc(rule.example.after.trimEnd())}</code></pre>`,
    "<h2>Ignore it when</h2>",
    `<p>${esc(rule.ignoreWhen)}</p>`,
    "</div>",
    "</body>",
    "</html>",
    "",
  ].join("\n");
}
