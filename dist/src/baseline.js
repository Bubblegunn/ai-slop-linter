import { GRADE_FLOOR, gradeFor, WEIGHTS } from "./index.js";
export const normaliseExcerpt = (excerpt) => excerpt.replace(/\s+/g, " ").trim().toLowerCase();
const keyOf = (file, rule, excerpt) => `${file} ${rule} ${normaliseExcerpt(excerpt)}`;
export function createBaseline(results) {
    const findings = [];
    for (const r of results)
        for (const f of r.findings)
            findings.push({ file: r.path, rule: f.rule, excerpt: normaliseExcerpt(f.excerpt) });
    findings.sort((a, b) => a.file.localeCompare(b.file) || a.rule.localeCompare(b.rule) || a.excerpt.localeCompare(b.excerpt));
    return { version: 1, findings };
}
export function parseBaseline(text) {
    let parsed;
    try {
        parsed = JSON.parse(text);
    }
    catch (err) {
        throw new Error(`baseline is not valid JSON: ${err instanceof Error ? err.message : String(err)}`);
    }
    const b = parsed;
    if (!b || b.version !== 1 || !Array.isArray(b.findings))
        throw new Error("baseline must be { version: 1, findings: [...] }");
    for (const e of b.findings)
        if (typeof e.file !== "string" || typeof e.rule !== "string" || typeof e.excerpt !== "string")
            throw new Error("every baseline finding needs file, rule and excerpt");
    return b;
}
/**
 * Drop the findings the baseline already lists. A baseline entry is consumed once, so two
 * identical tells in one file need two entries; the third one is new. Scores and grades are
 * recomputed over what remains, and `baselined` says how many were set aside.
 */
export function applyBaseline(results, baseline) {
    const pool = new Map();
    for (const e of baseline.findings) {
        const k = keyOf(e.file, e.rule, e.excerpt);
        pool.set(k, (pool.get(k) ?? 0) + 1);
    }
    let baselined = 0;
    const out = results.map((r) => {
        const kept = [];
        let mine = 0;
        for (const f of r.findings) {
            const k = keyOf(r.path, f.rule, f.excerpt);
            const n = pool.get(k) ?? 0;
            if (n > 0) {
                pool.set(k, n - 1);
                mine++;
            }
            else
                kept.push(f);
        }
        baselined += mine;
        const weighted = kept.reduce((s, f) => s + WEIGHTS[f.severity], 0);
        const score = r.words < GRADE_FLOOR ? null : Math.round((weighted / (r.words / 1000)) * 10) / 10;
        return { ...r, findings: kept, score, grade: score === null ? null : gradeFor(score), errors: kept.filter((f) => f.severity === "error").length, baselined: mine };
    });
    return { results: out, baselined };
}
