/**
 * Turns the choices made on this page into a `.slop.json` the repository can keep,
 * so the same decisions hold the next time the linter runs in CI, in the hook or
 * on the command line.
 *
 * Pure on purpose: no DOM, no storage, no network. The test imports it under Node
 * and feeds what it produces through the CLI's own `settingsFor()` resolver, which
 * is the only way to know the file means there what it meant here. Asserting a
 * JSON literal would only prove this module agrees with itself.
 */

/**
 * @param {{ ignoredRules?: Iterable<string>, language?: string }} choices
 * @returns {{ ignore?: string[], language?: string }}
 */
export function configFromState(choices = {}) {
  const config = {};
  const language = choices.language;
  // "en" is the default the linter already assumes; writing it down would be noise
  // that looks like a decision.
  if (language && language !== "en") config.language = language;
  const ignore = [...(choices.ignoredRules ?? [])].filter(Boolean).sort();
  if (ignore.length) config.ignore = ignore;
  return config;
}

/** The file, ready to paste, or an empty string when nothing was chosen. */
export function configText(choices = {}) {
  const config = configFromState(choices);
  if (Object.keys(config).length === 0) return "";
  return `${JSON.stringify(config, null, 2)}\n`;
}

/**
 * What this file does NOT carry. Each one is a real limit rather than a rough
 * edge, and the page prints all three: a config that silently dropped two thirds
 * of the choices would misrepresent what the reader is keeping.
 */
export const CONFIG_OMISSIONS = [
  "Findings you dismissed one at a time are not in it. Turning a rule off is a setting; setting aside one sentence is not, and the linter records those in a baseline file instead.",
  "The kind of text you picked is not in it. Reading something as a commit message lowers the bar for length, and that is a flag on a run rather than a field in the file.",
  "The changes you accepted are not in it. Those are edits to your text, and the Copy button above hands you the text itself.",
];
