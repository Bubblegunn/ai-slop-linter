import { prepare, suppressed } from "./doc.js";
import { dashes } from "./rules/dashes.js";
import { notXButY, triad, reveal, ingTail, inflated } from "./rules/constructions.js";
import { aiVocabulary, sales, filler } from "./rules/vocabulary.js";
import { chatbot, announcing, closer, challenges, vagueSource, cutoff } from "./rules/residue.js";
import { boldLabel, titleCase, emoji, curlyQuotes, hyphenDensity } from "./rules/formatting.js";
export { prepare, countWords } from "./doc.js";
/** Every rule, in the order findings are reported. */
export const rules = [
    dashes,
    chatbot,
    cutoff,
    notXButY,
    triad,
    reveal,
    ingTail,
    inflated,
    aiVocabulary,
    sales,
    vagueSource,
    announcing,
    closer,
    boldLabel,
    emoji,
    filler,
    curlyQuotes,
    titleCase,
    challenges,
    hyphenDensity,
];
/**
 * Rule sets for languages other than English, keyed by the language tag used to switch them
 * on. Empty until a pack lands: issue #1 tracks the first one, and the vocabulary rules are
 * the ones that need translating, since the structural rules already work in any language.
 *
 * A pack is a file under `src/rules/<lang>.ts` exporting its rules, registered here. Every
 * rule in it carries an id prefixed with its language, so `zh/chatbot` and never `chatbot`,
 * and a source, the same requirement the English rules meet. Nothing loads a pack unless the
 * language is asked for, so an English-only repository can never see a finding from one.
 */
export const languageRules = {};
/**
 * The English rules, plus the packs for any language asked for. Throws on a language with no
 * pack rather than silently linting without it, because a repository that configured `zh` and
 * got no Chinese findings would read that as a clean file.
 */
export function rulesFor(languages = []) {
    const chosen = [...rules];
    for (const lang of languages) {
        const pack = languageRules[lang];
        if (!pack) {
            const known = Object.keys(languageRules);
            throw new Error(`no rule pack for "${lang}" (${known.length ? `have: ${known.join(", ")}` : "none exist yet; see CONTRIBUTING.md"})`);
        }
        chosen.push(...pack);
    }
    return chosen;
}
/**
 * What a pack has to satisfy before it is registered. Called by the pack's own test, so a
 * contributor sees the requirement fail rather than reading it in a document.
 */
export function checkLanguagePack(lang, pack) {
    const problems = [];
    if (pack.length === 0)
        problems.push(`${lang}: the pack is empty`);
    for (const rule of pack) {
        if (!rule.id.startsWith(`${lang}/`))
            problems.push(`${rule.id}: a rule in the ${lang} pack needs the id ${lang}/${rule.id}`);
        if (!rule.source?.trim())
            problems.push(`${rule.id}: every rule carries a source`);
        if (rules.some((r) => r.id === rule.id))
            problems.push(`${rule.id}: an English rule already has this id`);
    }
    return problems;
}
export const WEIGHTS = { error: 3, warning: 1, info: 0.3 };
/** Grade thresholds on the weighted findings-per-thousand-words score. */
export const GRADES = [
    ["A", 3],
    ["B", 8],
    ["C", 15],
    ["D", 30],
];
/**
 * A document shorter than this is not graded. Below it the denominator is small enough
 * that one finding decides the grade, so the letter says more about the length than about
 * the writing. A 12-word fragment with one em dash used to score 60 and print an F.
 */
export const GRADE_FLOOR = 50;
/** True for the default and for every English tag, "en", "en-GB", "en_US". */
export const isEnglish = (tag) => !tag || tag.toLowerCase().split(/[-_]/)[0] === "en";
export function gradeFor(score) {
    for (const [grade, limit] of GRADES)
        if (score < limit)
            return grade;
    return "F";
}
export function lintText(path, text, options = {}) {
    const doc = prepare(path, text);
    return lintDoc(doc, options);
}
export function lintDoc(doc, options = {}) {
    const ignore = new Set(options.ignore ?? []);
    const only = options.only?.length ? new Set(options.only) : undefined;
    const english = isEnglish(options.language);
    const findings = [];
    const stoodDown = [];
    for (const rule of rulesFor(options.languages)) {
        if (only && !only.has(rule.id))
            continue;
        if (ignore.has(rule.id))
            continue;
        if (rule.englishOnly && !english) {
            stoodDown.push(rule.id);
            continue;
        }
        for (const f of rule.check(doc))
            if (!suppressed(doc, f))
                findings.push(f);
    }
    findings.sort((a, b) => a.line - b.line || a.column - b.column);
    const weighted = findings.reduce((s, f) => s + WEIGHTS[f.severity], 0);
    // Two separate things: the denominator is clamped so a short text cannot explode it,
    // and a document under the floor is not graded at all.
    const denominator = Math.max(doc.words, GRADE_FLOOR) / 1000;
    const floor = options.floor ?? GRADE_FLOOR;
    const score = doc.words < floor ? null : Math.round((weighted / denominator) * 10) / 10;
    return { path: doc.path, words: doc.words, findings, stoodDown, score, grade: score === null ? null : gradeFor(score), errors: findings.filter((f) => f.severity === "error").length };
}
/** Apply every safe fix once. Overlapping fixes keep the earlier one. */
export function applyFixes(text, findings) {
    const fixes = findings.filter((f) => !!f.fix).map((f) => f.fix).sort((a, b) => a.start - b.start);
    let out = "";
    let cursor = 0;
    let applied = 0;
    for (const fix of fixes) {
        if (fix.start < cursor)
            continue;
        out += text.slice(cursor, fix.start) + fix.replacement;
        cursor = fix.end;
        applied++;
    }
    out += text.slice(cursor);
    return { text: out, applied };
}
/** Lint, fix, and lint again so the returned findings describe the fixed text. */
export function fixText(path, text, options = {}) {
    let current = text;
    let applied = 0;
    // Two passes: a fix can expose a second fixable pattern (a dash next to a curly quote).
    for (let pass = 0; pass < 2; pass++) {
        const result = lintText(path, current, options);
        const step = applyFixes(current, result.findings);
        applied += step.applied;
        current = step.text;
        if (step.applied === 0)
            break;
    }
    return { text: current, applied, result: lintText(path, current, options) };
}
