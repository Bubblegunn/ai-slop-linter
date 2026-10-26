import { execFileSync } from "node:child_process";
import { lintText, WEIGHTS, GRADE_FLOOR } from "./index.js";
const RECORD = "\u001e";
const UNIT = "\u001f";
const git = (cwd, args) => execFileSync("git", args, { cwd, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
/** The address git would put on a commit made here right now. */
export function configuredIdentity(cwd) {
    try {
        const email = git(cwd, ["config", "user.email"]).trim();
        return email || null;
    }
    catch {
        return null;
    }
}
/**
 * Trailers are boilerplate a tool wrote, not prose a person wrote, so counting them would
 * measure the template. Only the contiguous block at the end goes, which is what the git
 * convention calls a trailer; a `Key: value` line in the middle of a paragraph stays.
 */
export function stripTrailers(message) {
    const lines = message.replace(/\r\n/g, "\n").split("\n");
    while (lines.length && lines[lines.length - 1].trim() === "")
        lines.pop();
    let end = lines.length;
    while (end > 0 && /^[A-Za-z][A-Za-z0-9-]*:[ \t].+$/.test(lines[end - 1]))
        end--;
    // A message that is nothing but trailers is a trailer block, not prose with a trailer.
    if (end === 0)
        return "";
    return lines.slice(0, end).join("\n");
}
const periodOf = (isoDate, bucket) => {
    const [year, month] = isoDate.split("-");
    if (bucket === "year")
        return year;
    if (bucket === "quarter")
        return `${year}-Q${Math.floor((Number(month) - 1) / 3) + 1}`;
    return `${year}-${month}`;
};
export function readCommits(opts) {
    const args = ["log", "--no-merges", `--format=%aI${UNIT}%B${RECORD}`];
    for (const a of opts.authors ?? [])
        args.push(`--author=${a}`);
    if (opts.since)
        args.push(`--since=${opts.since}`);
    const raw = git(opts.cwd, args);
    const commits = [];
    for (const record of raw.split(RECORD)) {
        const trimmed = record.replace(/^\n+/, "");
        if (!trimmed.trim())
            continue;
        const cut = trimmed.indexOf(UNIT);
        if (cut === -1)
            continue;
        // %aI is 2026-04-17T09:12:03+03:00; the first ten characters are the author's own date.
        commits.push({ date: trimmed.slice(0, 10), message: trimmed.slice(cut + 1) });
    }
    return commits;
}
export function history(opts) {
    const bucket = opts.bucket ?? "month";
    const authors = opts.authors?.length ? opts.authors : [];
    const commits = readCommits({ ...opts, authors });
    const lintOptions = {
        floor: 0,
        ...(opts.ignore ? { ignore: opts.ignore } : {}),
        ...(opts.only ? { only: opts.only } : {}),
        ...(opts.languages ? { languages: opts.languages } : {}),
    };
    const byPeriod = new Map();
    let messages = 0;
    let words = 0;
    for (const commit of commits) {
        const text = stripTrailers(commit.message);
        if (!text.trim())
            continue;
        const result = lintText("commit message", text, lintOptions);
        const key = periodOf(commit.date, bucket);
        const cell = byPeriod.get(key) ?? { messages: 0, words: 0, weighted: 0, findings: 0, rules: new Map() };
        cell.messages++;
        cell.words += result.words;
        cell.findings += result.findings.length;
        for (const f of result.findings) {
            cell.weighted += WEIGHTS[f.severity];
            cell.rules.set(f.rule, (cell.rules.get(f.rule) ?? 0) + 1);
        }
        byPeriod.set(key, cell);
        messages++;
        words += result.words;
    }
    const periods = [...byPeriod.entries()]
        .sort((a, b) => (a[0] < b[0] ? -1 : 1))
        .map(([period, cell]) => ({
        period,
        messages: cell.messages,
        words: cell.words,
        findings: cell.findings,
        // The same floor the file path uses: below it one finding decides the number.
        per1000: cell.words < GRADE_FLOOR ? null : Math.round((cell.weighted / (cell.words / 1000)) * 10) / 10,
        rules: [...cell.rules.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).map(([rule, count]) => ({ rule, count })),
    }));
    return { identity: authors, bucket, messages, words, periods };
}
const BAR = "█";
export function renderHistory(h) {
    if (h.periods.length === 0)
        return "no commit messages to read here";
    const scored = h.periods.map((p) => p.per1000).filter((n) => n !== null);
    const peak = scored.length ? Math.max(...scored, 1) : 1;
    // A bar is a comparison. With one period there is nothing to compare it against, and a
    // full-width bar would be reporting the scale rather than the writing.
    const comparable = scored.length > 1;
    const width = (n) => (n === null || !comparable ? "" : BAR.repeat(Math.max(n > 0 ? 1 : 0, Math.round((n / peak) * 24))));
    const rows = h.periods.map((p) => ({
        period: p.period,
        messages: String(p.messages),
        words: p.words.toLocaleString("en-US"),
        per: p.per1000 === null ? "-" : p.per1000.toFixed(1),
        bar: width(p.per1000),
        tells: p.rules
            .slice(0, 2)
            .map((r) => `${r.rule} (${r.count})`)
            .join(", "),
    }));
    const pad = (key, head) => Math.max(head.length, ...rows.map((r) => r[key].length));
    const w = { period: pad("period", "period"), messages: pad("messages", "messages"), words: pad("words", "words"), per: Math.max(9, pad("per", "per 1,000")) };
    const out = [];
    const who = h.identity.length ? h.identity.join(", ") : "every author in this repository";
    out.push(`${who} · ${h.messages.toLocaleString("en-US")} messages · ${h.words.toLocaleString("en-US")} words · by ${h.bucket}`);
    out.push("");
    out.push(`${"period".padEnd(w.period)}  ${"messages".padStart(w.messages)}  ${"words".padStart(w.words)}  ${"per 1,000".padStart(w.per)}  most common tell`);
    out.push("-".repeat(w.period + w.messages + w.words + w.per + 26));
    for (const r of rows) {
        const left = `${r.period.padEnd(w.period)}  ${r.messages.padStart(w.messages)}  ${r.words.padStart(w.words)}  ${r.per.padStart(w.per)}`;
        out.push(`${left}  ${r.tells}`);
        if (r.bar)
            out.push(`${" ".repeat(w.period + w.messages + w.words + w.per + 6)}${r.bar}`);
    }
    out.push("");
    const unit = h.bucket === "year" ? "years" : h.bucket === "quarter" ? "quarters" : "months";
    out.push(`Weighted tells per 1,000 words of commit message, in the author's own ${unit}.`);
    out.push("Trailers are not counted. There is no grade and no exit code here: this is a");
    out.push("description of writing over time, not a verdict on a person, and it cannot tell");
    out.push("you who wrote anything.");
    return out.join("\n");
}
