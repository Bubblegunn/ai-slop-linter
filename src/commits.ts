import type { Doc, Finding, Rule } from "./doc.js";
import { prepare, scan, suppressed } from "./doc.js";
import { GRADE_FLOOR, WEIGHTS, gradeFor, lintText } from "./index.js";
import type { LintOptions, LintResult } from "./index.js";
import { PHRASES } from "./commit-phrases.js";

/**
 * Rules that only make sense in a commit message or a pull request description. They are not in
 * `rules` on purpose: "This commit adds" is a tell in a commit and ordinary prose in a changelog
 * about commits, so a README must never see them. `lintCommitMessage` is the one entry that runs them.
 *
 * Phrase lists come from tbhb/vale-ai-tells (MIT), see commit-phrases.ts. Two regex rules are
 * ported by hand from the same style, with the same notice.
 */
const UPSTREAM = "tbhb/vale-ai-tells ai-tells-commits (MIT)";

/**
 * Tokens left out of a phrase list because they matched pre-2021 human commit messages in the tuning
 * sample (bench/COMMIT-RULES.md has the count for each). Keyed by rule id.
 */
export const EXCLUDED: Record<string, readonly string[]> = {
  "commit-self-reference": ["In this commit", "This change addresses", "This commit adds", "This commit enhances", "This commit implements", "This commit removes"],
  "commit-buzzwords": ["properly handle", "corresponding tests", "update relevant"],
};

/**
 * Candidate rules that measurement kept out, with the reason. A rule here is still written and
 * still measured, so the report can show why it is not used.
 */
export const NOT_ADOPTED: Record<string, string> = {
  "commit-self-reference": "2 messages in the held-out sample, over the limit of 1, even after the phrases that matched the tuning sample were left out",
  "commit-buzzwords": "3 messages in the held-out sample, over the limit of 1, even after the phrases that matched the tuning sample were left out",
  "commit-test-enumeration": "matched a human commit message in the tuning sample, and a regular expression has no phrase to drop",
};

/** Escape every regex metacharacter, so a token is always matched as the literal text it spells. */
export function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function phrasePattern(id: string): RegExp {
  const list = PHRASES[id];
  if (!list) throw new Error(`commit-phrases.ts has no list for ${id}`);
  const drop = new Set(EXCLUDED[id] ?? []);
  const tokens = list.tokens.filter((t) => !drop.has(t)).map(escapeRegExp);
  return new RegExp(`\\b(?:${tokens.join("|")})\\b`, list.ignorecase ? "gi" : "g");
}

interface Spec {
  id: string;
  title: string;
  why: string;
  example: { before: string; after: string };
  ignoreWhen: string;
  hint: string;
}

function phraseRule(spec: Spec): Rule {
  // Built at check time, not at load time, so a list changed at run time is seen by the rule.
  const rule: Rule = {
    id: spec.id,
    title: spec.title,
    severity: "warning",
    source: UPSTREAM,
    why: spec.why,
    example: spec.example,
    ignoreWhen: spec.ignoreWhen,
    check(doc: Doc): Finding[] {
      return scan(doc, rule, phrasePattern(spec.id), (m) => `"${m[0]}": ${spec.hint}`);
    },
  };
  return rule;
}

function regexRule(spec: Spec, pattern: RegExp): Rule {
  const rule: Rule = {
    id: spec.id,
    title: spec.title,
    severity: "warning",
    source: UPSTREAM,
    why: spec.why,
    example: spec.example,
    ignoreWhen: spec.ignoreWhen,
    check(doc: Doc): Finding[] {
      return scan(doc, rule, pattern, (m) => `"${m[0]}": ${spec.hint}`);
    },
  };
  return rule;
}

/** Every rule adapted from the upstream style, adopted or not. The measurement script reads this. */
export const candidateRules: Rule[] = [
  phraseRule({
    id: "commit-self-reference",
    title: "Commit message narrates itself",
    why: "A commit message sits next to its diff. Opening with \"This commit adds\" spends the first words on what the log already says, and models do it far more often than people do.",
    example: { before: "This commit fixes the retry in the upload client.", after: "Retry failed uploads three times" },
    ignoreWhen: "You are quoting another commit, for example in a revert message.",
    hint: "say what you did, not that the commit does it",
  }),
  phraseRule({
    id: "commit-hedging",
    title: "Commit message hedges about its own change",
    why: "The change is already made. \"This should fix\" asks the reader to trust a guess, where a message can say what was tested or what was seen.",
    example: { before: "This should fix the login timeout.", after: "Raise the login timeout to 30 seconds" },
    ignoreWhen: "The fix really is unverified and you want the log to say so.",
    hint: "you made the change; state what you tested instead",
  }),
  phraseRule({
    id: "commit-overexplanation",
    title: "Filler that frames the change",
    why: "Phrases such as \"as part of this change\" or \"the purpose of this commit\" frame a sentence that would read the same without them.",
    example: { before: "As part of this change, move the cache into its own module.", after: "Move the cache into its own module" },
    ignoreWhen: "The frame names a real larger effort, such as a linked migration.",
    hint: "cut it; the message reads the same without it",
  }),
  phraseRule({
    id: "commit-marketing",
    title: "Marketing words in a commit message",
    why: "\"Production-ready\" and \"enterprise-grade\" are claims, not changes. A commit records what changed and why.",
    example: { before: "Make the parser production-ready.", after: "Make the parser reject truncated input" },
    ignoreWhen: "The phrase is a product or package name.",
    hint: "state what changed and why, not marketing copy",
  }),
  phraseRule({
    id: "commit-buzzwords",
    title: "Vague emphasis in a commit message",
    why: "\"Comprehensive tests\" says nothing about which cases are covered. Name them.",
    example: { before: "Add comprehensive tests for the parser.", after: "Add tests for empty and truncated input" },
    ignoreWhen: "The word is part of a name, such as a test suite called comprehensive.",
    hint: "be specific about what actually changed",
  }),
  phraseRule({
    id: "commit-trailing-justification",
    title: "Trailing justification",
    why: "A clause such as \", ensuring consistency\" claims a benefit the diff either shows or does not.",
    example: { before: "Validate the config on load, ensuring consistency.", after: "Validate the config on load" },
    ignoreWhen: "The consistency in question is a named invariant the reader can look up.",
    hint: "cut it; if the change is good the diff shows it",
  }),
  regexRule(
    {
      id: "commit-test-enumeration",
      title: "Test results listed in the message",
      why: "\"All tests pass\" is a CI result, not a property of the change, and it goes stale the next commit.",
      example: { before: "Rework the cache. All tests pass.", after: "Rework the cache; add a test for eviction order" },
      ignoreWhen: "The message is recording a test run on purpose, such as a bisect note.",
      hint: "link the CI run or say what coverage changed",
    },
    /\b(?:all\s+)?\d+\s*\/?\s*\d*\s*tests?\s+(?:pass(?:ing|ed)?|fail(?:ing|ed)?)\b|\b\d+\s+(?:passed|failed)\s*,\s*\d+\s+(?:passed|failed)\b|\bcoverage\s*:\s*\d+(?:\.\d+)?\s*%|\b\d+(?:\.\d+)?\s*%\s+(?:coverage|code coverage|test coverage|line coverage|branch coverage)\b|\ball\s+tests?\s+(?:pass(?:ing|ed)?|are passing|green)\b|✅\s*all\s+tests?/gi,
  ),
  regexRule(
    {
      id: "commit-unquantified",
      title: "Unquantified performance claim",
      why: "\"Significantly faster\" has no baseline. A number and what it was measured on can be checked.",
      example: { before: "Make the parser significantly faster.", after: "Parse a 1 MB file in 40 ms instead of 120 ms" },
      ignoreWhen: "The claim is qualitative on purpose and a benchmark is linked in the body.",
      hint: "back it with a number and a baseline",
    },
    /\b(?:significantly|substantially|notably|considerably|dramatically|vastly|greatly|massively|markedly)\s+(?:faster|slower|better|reduced|reduces|reducing|improved|improves|improving|increased|increases|increasing|decreased|decreases|decreasing|optimized|enhanced)\b|\bmuch\s+(?:faster|slower|better|smaller|larger|cleaner)\b|\b(?:huge|massive|major)\s+(?:performance|speed|memory|latency)\s+(?:improvement|boost|gain|reduction|increase|win)\b|\bblazing(?:ly)?\s+fast\b|\bnoticeably\s+(?:faster|slower|better)\b/gi,
  ),
  regexRule(
    {
      id: "commit-procedural-assurance",
      title: "Procedural assurance in the message",
      why: "The phrase promises that something was kept safe instead of saying what was done to it. The assurance adds no fact a reader can check. The evidence is English commit messages, and nothing is claimed for other languages.",
      example: { before: "Rewrote the parser while preserving the original behavior.", after: "Rewrote the parser; its behavior on the suite is unchanged." },
      ignoreWhen: "You are naming the construction to document it, as a style guide or this linter's own rule table does, or the promise is the point, such as a release note that commits to the public API staying stable.",
      hint: "say what was done to it instead",
    },
    /\b(?:while\s+(?:preserving|retaining|maintaining|ensuring)|without\s+(?:changing|breaking|altering))\b/gi,
  ),
];

/** The rules that run on commit messages: the candidates that measurement did not rule out. */
export const commitRules: Rule[] = candidateRules.filter((r) => !(r.id in NOT_ADOPTED));

/**
 * Lines a message carries for tooling rather than for the reader: trailers such as
 * `Co-Authored-By: ... <email>` or `Signed-off-by: ... <email>`, and the generator footer
 * `Generated with ...`. Commit rules do not read these lines. Returns 1-based line numbers.
 */
const TRAILER = /^(?:Co-Authored-By|Signed-off-by|Reviewed-by|Acked-by|Tested-by|Reported-by|Suggested-by|Helped-by|Cc): .*<[^>]+@[^>]+>\s*$/;
// Reference trailers carry an issue or URL rather than a person, so they have no address.
const REFERENCE = /^(?:Fixes|Closes|Refs|Reviewed-on): \S/;
const FOOTER = /^Generated with \[?Claude/;

export function trailerLines(text: string): Set<number> {
  const out = new Set<number>();
  text.split("\n").forEach((line, i) => {
    if (TRAILER.test(line) || REFERENCE.test(line) || FOOTER.test(line)) out.add(i + 1);
  });
  return out;
}

/**
 * Lint a commit message or a pull request description: the prose rules, then the commit rules,
 * graded without the fifty-word floor because a message is short by nature and the question is
 * whether it carries a tell. Same options, suppression comments and scoring as `lintText`.
 */
export function lintCommitMessage(path: string, text: string, options: LintOptions = {}): LintResult {
  const base = lintText(path, text, { ...options, floor: 0 });
  const doc = prepare(path, text);
  const ignore = new Set(options.ignore ?? []);
  const only = options.only?.length ? new Set(options.only) : undefined;
  const extra: Finding[] = [];
  const trailers = trailerLines(text);
  for (const rule of commitRules) {
    if (only && !only.has(rule.id)) continue;
    if (ignore.has(rule.id)) continue;
    for (const f of rule.check(doc)) if (!suppressed(doc, f) && !trailers.has(f.line)) extra.push(f);
  }
  if (extra.length === 0) return base;
  const findings = [...base.findings, ...extra].sort((a, b) => a.line - b.line || a.column - b.column);
  const weighted = findings.reduce((s, f) => s + WEIGHTS[f.severity], 0);
  const score = Math.round((weighted / (Math.max(base.words, GRADE_FLOOR) / 1000)) * 10) / 10;
  return { ...base, findings, score, grade: gradeFor(score), errors: findings.filter((f) => f.severity === "error").length };
}
