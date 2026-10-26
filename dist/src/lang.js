import { findFrontMatter } from "./frontmatter.js";
const MIN_TOKENS = 25;
export const MIN_SHARE = 0.12;
const MIN_RATIO = 1.5;
// Function words per language. A word that appears in two or more lists is
// dropped from all of them before scoring (see buildIndex).
const LISTS = {
    en: [
        "the", "and", "of", "to", "is", "in", "that", "it", "for", "with", "as", "on",
        "are", "this", "be", "by", "not", "or", "from", "have", "has", "they", "we",
        "you", "he", "she", "which", "but", "their", "were", "been", "will", "would",
        "if", "there", "these", "can", "its", "at", "our", "one", "when", "what",
        "more", "than", "into", "about",
    ],
    fr: [
        "le", "la", "les", "des", "une", "est", "et", "que", "pour", "pas", "dans",
        "sur", "avec", "nous", "vous", "qui", "ne", "ce", "au", "aux", "du", "en",
        "de", "il", "elle", "mais", "ou", "très", "cette", "ces", "sa", "ses", "leur",
        "leurs", "été", "être", "avoir", "plus", "comme", "aussi", "donc", "notre",
        "votre", "ont", "dont", "lors", "sans", "nos", "vos",
    ],
    es: [
        "el", "la", "los", "las", "de", "que", "y", "en", "un", "una", "es", "por",
        "con", "para", "no", "se", "su", "al", "lo", "como", "pero", "más", "del",
        "sin", "ni", "muy", "ya", "son", "fue", "porque", "entre", "cuando", "todo",
        "hay", "nos", "sus", "ser", "tiene", "todos", "esta", "este", "era", "hasta",
        "desde", "hace", "muchos", "cada", "sobre", "también", "ellos", "ese", "eso",
    ],
    de: [
        "der", "die", "das", "und", "ist", "nicht", "ein", "eine", "mit", "für", "auf",
        "den", "dem", "zu", "von", "auch", "sich", "es", "im", "in", "dass", "wir",
        "ich", "sie", "bei", "nach", "wie", "noch", "hat", "haben", "wurde", "mich",
        "mir", "ihr", "kann", "sein", "seine", "über", "durch", "war", "werden",
        "sind", "aber", "oder", "wird", "einen", "einer", "eines", "zum", "zur",
        "dann", "wenn", "dort", "hier", "diese", "dieser", "nur", "schon", "doch",
    ],
    it: [
        "di", "che", "il", "lo", "gli", "la", "non", "per", "con", "sono", "della",
        "nel", "questo", "questa", "anche", "come", "più", "ma", "ho", "ha", "dei",
        "delle", "degli", "alla", "nella", "sulla", "dal", "dalla", "perché", "molto",
        "essere", "hanno", "tutto", "quando", "ci", "mi", "ti", "tra", "è", "in",
        "un", "una", "no", "al", "se", "stato", "del", "dello",
    ],
    pt: [
        "de", "do", "da", "dos", "das", "em", "um", "uma", "não", "os", "as", "mas",
        "também", "muito", "isso", "esta", "este", "pelo", "pela", "são", "foi", "ser",
        "está", "ao", "aos", "nos", "nas", "na", "ele", "ela", "eles", "elas", "você",
        "por", "para", "com", "como", "que", "o", "é", "há", "tem", "seu", "sua", "mais",
        "quando", "já", "onde", "porque", "pois",
    ],
    nl: [
        "de", "het", "een", "en", "van", "is", "dat", "die", "niet", "op", "te", "zijn",
        "ook", "met", "voor", "maar", "bij", "naar", "wat", "er", "hij", "zij", "wij",
        "ik", "je", "jij", "dit", "deze", "door", "uit", "over", "nog", "als", "om",
        "al", "nu", "wel", "geen", "meer", "heeft", "hebben", "worden", "zou", "kan",
        "in", "zich", "onze", "hun",
    ],
};
// Keep only words that belong to exactly one language list.
function buildIndex() {
    const owners = new Map();
    for (const [lang, words] of Object.entries(LISTS)) {
        for (const w of new Set(words)) {
            const list = owners.get(w);
            if (list)
                list.push(lang);
            else
                owners.set(w, [lang]);
        }
    }
    const index = new Map();
    for (const [w, langs] of owners) {
        if (langs.length === 1 && langs[0] !== undefined)
            index.set(w, langs[0]);
    }
    return index;
}
const INDEX = buildIndex();
/**
 * Every function word of every listed language, shared ones included: a word in this set is
 * evidence of a language the paragraph guess knows. The English list is the one the dash rule is
 * about; the others keep a declared-English file's Spanish or French paragraph out of looksForeign,
 * where a declared language is never overridden by a guess.
 */
const KNOWN_WORDS = new Set(Object.values(LISTS).flat());
/**
 * Whether `text` is plausibly written in a language this tool has no word list for (Turkish,
 * Finnish, Polish): at least `minTokens` word tokens, not one function word of any listed language
 * (English included), and at least one letter outside ASCII. One such function word is enough to
 * say it is not.
 */
export function looksForeign(text, minTokens = 8) {
    let words = 0;
    let nonAscii = false;
    for (const match of text.matchAll(TOKEN)) {
        const token = match[0].replace(/’/g, "'").replace(/^'+|'+$/g, "").toLowerCase();
        if (token === "")
            continue;
        words++;
        if (KNOWN_WORDS.has(token))
            return false;
        if (/[^\u0000-\u007f]/.test(token))
            nonAscii = true;
    }
    return words >= minTokens && nonAscii;
}
const LANGS = Object.keys(LISTS);
// Combining marks belong to the word they sit on, so NFD text tokenises like NFC text.
const TOKEN = /[\p{L}\p{M}'’]+/gu;
/**
 * Paragraph mode: a short paragraph is called foreign only on three distinct function words
 * of that language and at least three hits, so one word such as "over" (Dutch) or "plus"
 * (French) inside English prose cannot decide it.
 */
export const PARAGRAPH_DETECT = { minTokens: 12, minDistinct: 3, minHits: 3 };
/**
 * The language of `text`, or a null tag when no language is clear. A number is `minTokens`,
 * the word count below which nothing is said; the default is the whole-file floor, and a
 * paragraph passes a smaller one. An options object adds the distinct-word and hit counts.
 */
export function detectLanguage(text, limits = MIN_TOKENS) {
    const { minTokens = MIN_TOKENS, minDistinct = 0, minHits = 0 } = typeof limits === "number" ? { minTokens: limits } : limits;
    const hits = new Map();
    const distinct = new Map();
    let words = 0;
    if (text) {
        for (const match of text.matchAll(TOKEN)) {
            const token = match[0].replace(/’/g, "'").replace(/^'+|'+$/g, "").toLowerCase();
            if (token === "")
                continue;
            words++;
            const lang = INDEX.get(token);
            if (lang !== undefined) {
                hits.set(lang, (hits.get(lang) ?? 0) + 1);
                let seen = distinct.get(lang);
                if (!seen)
                    distinct.set(lang, (seen = new Set()));
                seen.add(token);
            }
        }
    }
    const ranked = LANGS.map((lang) => ({ lang, count: hits.get(lang) ?? 0 })).sort((a, b) => b.count - a.count || (a.lang < b.lang ? -1 : 1));
    const best = ranked[0];
    const second = ranked[1];
    if (best === undefined || words === 0)
        return { tag: null, confidence: 0, words };
    const confidence = best.count / words;
    const clear = words >= minTokens &&
        best.count > 0 &&
        best.count >= minHits &&
        (distinct.get(best.lang)?.size ?? 0) >= minDistinct &&
        confidence >= MIN_SHARE &&
        best.count >= MIN_RATIO * (second?.count ?? 0);
    return { tag: clear ? best.lang : null, confidence, words };
}
/**
 * The share of the words of `text` that are function words of `tag`, 0 when there are none.
 * Words that two languages' lists share count for neither, as in detectLanguage.
 */
export function functionWordShare(text, tag) {
    let words = 0;
    let hits = 0;
    for (const match of text.matchAll(TOKEN)) {
        const token = match[0].replace(/’/g, "'").replace(/^'+|'+$/g, "").toLowerCase();
        if (token === "")
            continue;
        words++;
        if (INDEX.get(token) === tag)
            hits++;
    }
    return words === 0 ? 0 : hits / words;
}
/**
 * Function words for the languages compare reads beyond detectLanguage's list: Polish, Indonesian,
 * Turkish. A word that any detectLanguage list also holds is dropped, as buildIndex does.
 */
const COMPARE_LISTS = {
    pl: [
        "i", "w", "nie", "na", "się", "że", "to", "z", "do", "jest", "jak", "co", "ale", "po", "za", "od", "przez", "dla", "tak", "już",
        "czy", "tylko", "jego", "jej", "ich", "też", "być", "przy", "lub", "oraz", "który", "która", "które", "tym", "ten", "ta", "te",
        "bardzo", "może", "są", "był", "była", "było",
    ],
    id: [
        "yang", "dan", "di", "dengan", "untuk", "dari", "ini", "itu", "tidak", "akan", "pada", "adalah", "ke", "juga", "dalam", "oleh",
        "sebagai", "atau", "ada", "saya", "kami", "kita", "mereka", "sudah", "telah", "bisa", "dapat", "karena", "lebih",
    ],
    tr: [
        "ve", "bir", "bu", "için", "ile", "de", "da", "çok", "daha", "ama", "gibi", "olarak", "olan", "en", "ne", "mi", "kadar", "sonra",
        "her", "ise", "değil", "var", "çünkü", "ancak", "veya", "bazı",
    ],
};
/** Each compare-only word with the one language list it belongs to (none when a detectLanguage list also has it). */
const COMPARE_INDEX = (() => {
    const known = new Set(Object.values(LISTS).flat());
    const owners = new Map();
    for (const [lang, words] of Object.entries(COMPARE_LISTS)) {
        for (const w of new Set(words)) {
            if (known.has(w))
                continue;
            owners.set(w, [...(owners.get(w) ?? []), lang]);
        }
    }
    const index = new Map();
    for (const [w, langs] of owners) {
        if (langs.length === 1 && langs[0] !== undefined)
            index.set(w, langs[0]);
    }
    return index;
})();
/**
 * The language of `text` for compare only: Polish, Indonesian or Turkish, by the same rule as
 * detectLanguage (at least 25 words, function words at least 12 percent of them, at least 1.5 times
 * the second of the three). Null for every other language or when none is clear. detectLanguage
 * itself is unchanged, so the linter's dash rule does not move.
 */
export function guessCompareLanguage(text) {
    const hits = new Map();
    let words = 0;
    for (const match of text.matchAll(TOKEN)) {
        const token = match[0].replace(/’/g, "'").replace(/^'+|'+$/g, "").toLowerCase();
        if (token === "")
            continue;
        words++;
        const lang = COMPARE_INDEX.get(token);
        if (lang !== undefined)
            hits.set(lang, (hits.get(lang) ?? 0) + 1);
    }
    if (words < MIN_TOKENS)
        return null;
    const ranked = Object.keys(COMPARE_LISTS)
        .map((lang) => ({ lang, count: hits.get(lang) ?? 0 }))
        .sort((a, b) => b.count - a.count || (a.lang < b.lang ? -1 : 1));
    const best = ranked[0];
    const second = ranked[1];
    if (best === undefined || best.count === 0)
        return null;
    if (best.count / words < MIN_SHARE)
        return null;
    if (best.count < MIN_RATIO * (second?.count ?? 0))
        return null;
    return best.lang;
}
const LANG_KEY = /^(?:lang|language)[ \t]*:[ \t]*["']?([A-Za-z]{2,3}(?:[-_][A-Za-z0-9-]+)?)["']?[ \t]*(?:#.*)?$/;
/** The TOML form of the same key: `lang = "fr"`. */
const LANG_KEY_TOML = /^(?:lang|language)[ \t]*=[ \t]*["']?([A-Za-z]{2,3}(?:[-_][A-Za-z0-9-]+)?)["']?[ \t]*(?:#.*)?$/;
/** ISO 639-2 codes that front matter uses in place of the two-letter tag. */
const THREE_LETTER = new Map([
    ["fra", "fr"], ["fre", "fr"], ["spa", "es"], ["deu", "de"], ["ger", "de"], ["ita", "it"],
    ["por", "pt"], ["nld", "nl"], ["dut", "nl"], ["eng", "en"],
]);
/**
 * The `lang` or `language` key of a front-matter block at the top of the file (YAML `lang: fr`
 * or TOML `lang = "fr"`), as a two-letter primary subtag. A byte order mark before the opening fence is allowed. An empty block, or a
 * value that is not a two-letter code or a mapped three-letter one, gives null.
 */
export function frontMatterLanguage(text) {
    const block = findFrontMatter(text);
    if (block === null)
        return null;
    const pattern = block.fence === "---" ? LANG_KEY : LANG_KEY_TOML;
    for (const line of block.body.split(/\r?\n/)) {
        const key = pattern.exec(line);
        if (key?.[1] === undefined)
            continue;
        const primary = key[1].split(/[-_]/)[0].toLowerCase();
        if (primary.length === 2)
            return primary;
        return THREE_LETTER.get(primary) ?? null;
    }
    return null;
}
export function splitParagraphs(text) {
    const out = [];
    const push = (from, to) => {
        const slice = text.slice(from, to);
        const trimmed = slice.trim();
        if (trimmed === "")
            return;
        const start = from + (slice.length - slice.trimStart().length);
        out.push({ start, end: start + trimmed.length, text: trimmed });
    };
    let pos = 0;
    for (const sep of text.matchAll(/\r?\n[ \t]*\r?\n+/g)) {
        push(pos, sep.index);
        pos = sep.index + sep[0].length;
    }
    push(pos, text.length);
    return out;
}
