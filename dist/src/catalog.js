/**
 * The machine-readable tell catalogs behind `--verify`: `skills/ai-slop-linter/references/<lang>.tells.txt`.
 * One entry per line, a case-insensitive phrase or `re:<pattern>`; `#` starts a comment.
 * A scan reads the document's masked text (code, front matter, URLs and comments already blanked
 * by `prepare`) and also blanks quoted text and dialogue lines, so a quoted tell is never a hit.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { position, suppressed } from "./doc.js";
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** Where the catalogs live, relative to dist/src/ in the installed package. */
export const REFERENCES_DIR = fileURLToPath(new URL("../../skills/ai-slop-linter/references/", import.meta.url));
/** The compiled entries for one language tag; a missing or unreadable file gives none. */
export function loadCatalog(tag, dir = REFERENCES_DIR) {
    const lang = tag.split(/[-_]/)[0].toLowerCase();
    if (!/^[a-z]{2,3}$/.test(lang))
        return [];
    const file = join(dir, `${lang}.tells.txt`);
    let text;
    try {
        if (!existsSync(file))
            return [];
        text = readFileSync(file, "utf8");
    }
    catch {
        return [];
    }
    const out = [];
    for (const raw of text.split(/\r?\n/)) {
        const line = raw.trim();
        if (!line || line.startsWith("#"))
            continue;
        const source = line.startsWith("re:") ? line.slice(3) : `(?<![\\p{L}\\p{N}])${escape(line)}(?![\\p{L}\\p{N}])`;
        try {
            out.push(new RegExp(source, "giu"));
        }
        catch {
            // A broken entry is skipped; the rest of the catalog still runs.
        }
    }
    return out;
}
// A straight quote right after a digit is an inch mark (5"), never an opener.
const QUOTES = /(?<!\d)"[^"\n]*"|“[^”\n]*”|«[^«»\n]*»|„[^„“”\n]*[“”]|‹[^‹›\n]*›/g;
/** The masked text with quoted spans and dialogue lines blanked (same length). */
export function exempt(doc) {
    const blank = (s) => s.replace(/[^\n]/g, " ");
    return doc.masked
        .split("\n")
        .map((line) => (/^\s*[—–]/.test(line) ? blank(line) : line.replace(QUOTES, blank)))
        .join("\n");
}
/** Catalog hits in a document, in reading order. */
export function scanCatalog(doc, tag, dir) {
    const entries = loadCatalog(tag, dir);
    if (!entries.length)
        return [];
    const text = exempt(doc);
    const hits = [];
    for (const re of entries) {
        for (const m of text.matchAll(re)) {
            if (m[0] === "")
                continue;
            const { line, column } = position(doc, m.index);
            if (suppressed(doc, { rule: "catalog", severity: "error", line, column, excerpt: "", message: "" }))
                continue;
            hits.push({ line, column, phrase: m[0], at: m.index });
        }
    }
    hits.sort((a, b) => a.at - b.at);
    return hits.map(({ line, column, phrase }) => ({ line, column, phrase }));
}
