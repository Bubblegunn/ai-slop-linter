/**
 * Facts a text states: numbers, versions, dates, urls, issue ids, quotations, code and names.
 * Comparing a text with its rewrite shows which facts the rewrite added or lost. The method is
 * deterministic and reads the raw text: it does not judge whether a change is good.
 *
 * Known limits, on purpose:
 * - Spelled-out numbers are read by value (`three` is the number fact `3`) for English and for the
 *   declared, front matter or guessed language. The tables cover numbers two to ninety, not the one
 *   words (`one`, `un`, `een`), `once`, nor hundred, thousand or million. A word joined to another by
 *   `-` or `_` (`five-star`), and a word after `#`, is not read.
 * - Dotted thousands read as versions (`1.000.000` is a version fact, not a number).
 * - Ordinals read as numbers: `3rd` gives number `3`.
 * - `person` facts are first-person words (`our`, `we`, `ich`, `nous`), compared by count: a word
 *   that occurs more often in the rewrite is added (`In benchmarks` becoming `In our benchmarks`
 *   adds `our`, an owner the source never named), a word that occurs less often is lost. Code,
 *   urls, link targets, e-mail addresses and text in double quotation marks (straight, curly,
 *   guillemet and low quotes) are not read, so quoted speech does not count; neither is a word
 *   joined to a letter or digit by `-`, `_`, `/`, `.` or `@` (`us-east-1`, `my-app`), except a
 *   French hyphen (`contactez-nous`, `nous-mêmes`). Limits: the word lists cover English,
 *   French, Spanish, German and Turkish, chosen by the declared, front matter or detected
 *   language (English when it cannot be told, none for another detected language such as Italian; Turkish and texts under about
 *   25 words are not detected, so declare them); Turkish suffixes (`-im`) are not read; a word in
 *   an all-capitals token (`US`, `ME`) is never read; a lowercase `i` is never read; a capital
 *   `I` is skipped as a Roman numeral or list marker (`I.`, `Part I`), in `I/O` and in
 *   abbreviations (`I.T.`); single quotation marks, Markdown block quotes and indented code
 *   blocks are read; a quotation that runs over several lines is read; a stray quotation mark
 *   can hide a stretch of text.
 * - `claim` facts are claim words (`always`, `guaranteed`, `because`) and are reported only when
 *   the rewrite has more of them than the source. Removing a claim word is never reported. The
 *   list is short on purpose: `bench/COMPARE-WORDS.md` records each candidate word with its
 *   flags on honest rewrites, and a word that flagged too many honest rewrites was dropped.
 * - `qualifier` facts are an approximator or a bound right before a number (`about 40%`, `up to 3`,
 *   `bis zu 3`, `plus de 300`). A qualifier is part of the fact: `about 40%` becoming `40%` is a lost
 *   qualifier, `300` becoming `over 300` an added one. Qualifiers are grouped by meaning (about,
 *   at least, at most), so a swap within a group (`about` for `around`, `over` for `more than`) is
 *   not reported. Only a number both texts have is read: a changed number is already a lost and an
 *   added number. Only the words in QUALIFIERS are read; `bench/COMPARE-QUALIFIERS.md` records each
 *   candidate with its flags on honest rewrites. Limits: a qualifier after its number (`40 % environ`)
 *   or spelled-out numbers are not read; code, urls and quoted text are not read.
 * - In German (or Luxembourgish) text only a run of two or more capitalised words is a name:
 *   every noun is capitalised there, so a single "Kaufmann" or "Technik" says nothing, while
 *   "Herr Krause" does. A single surname alone is therefore not compared. The language is the
 *   declared one, the front matter's, or detected from the text; every other kind of fact is
 *   compared as always.
 * - A single capitalised word that opens a table cell is not a name (a run of several is). A name that starts a sentence or a list item is not extracted, and an all-capitals token (an acronym)
 *   is not a name. A name counts as lost or added only when it is absent from the other text
 *   as a whole word, so a name that moves between sentence-initial and mid-sentence is kept.
 */
import { detectLanguage, frontMatterLanguage, guessCompareLanguage } from "./lang.js";
import { UNIT_WORDS } from "./units.js";
/** Each extractor blanks what it has taken, so a later one cannot count the same text twice. */
const blank = (s) => s.replace(/[^\n]/g, " ");
// Full month names only, never abbreviations. Each language is one space-separated list; the Set drops repeats
// across languages (mai, juni, august, september, ...). Entries are regex fragments, so fr keeps its accents optional.
const MONTH_LISTS = [
    "january february march april may june july august september october november december", // en
    "janvier f[ée]vrier mars avril mai juin juillet ao[uû]t septembre octobre novembre d[ée]cembre", // fr
    "enero febrero marzo abril mayo junio julio agosto septiembre setiembre octubre noviembre diciembre", // es
    "janeiro fevereiro março abril maio junho julho agosto setembro outubro novembro dezembro", // pt
    "januar jänner februar märz april mai juni juli august september oktober november dezember", // de
    "januari februari maart april mei juni juli augustus september oktober november december", // nl
    "gennaio febbraio marzo aprile maggio giugno luglio agosto settembre ottobre novembre dicembre", // it
    "stycznia lutego marca kwietnia maja czerwca lipca sierpnia września października listopada grudnia", // pl (genitive)
    "januari februari maret april mei juni juli agustus september oktober november desember", // id
    "ocak şubat mart nisan mayıs haziran temmuz ağustos eylül ekim kasım aralık", // tr
    "января февраля марта апреля мая июня июля августа сентября октября ноября декабря", // ru (genitive)
].join(" ").split(" ");
const MONTHS = [...new Set(MONTH_LISTS)].join("|");
// Particles that may stand between a day and its month, and between the month and the year.
const DATE_PARTICLE = "(?:de|del|of|van)[ \\u00a0]+";
/** Function words that are capitalised at the start of a sentence and are not names. */
const STOPWORDS = new Set(("I A An The And Or But If In On At To For Of With By From As It This That These Those We You They He She Our Your " +
    "Their My His Her Its Is Are Was Were Be Do Not No Yes So Then When Where Why How What Who Which Also There Here Some " +
    "Any All Each Every Both Other Such Only Than Too Very Just Can Will Would Should Could Let " +
    "Le La Les Un Une Des Du De Et Ou Mais Donc Ni Car Dans Sur Sous Pour Par Avec Sans En Au Aux Ce Cet Cette Ces " +
    "Il Elle Ils Elles Nous Vous On Je Tu Qui Que Quoi Dont Son Sa Ses Leur Leurs Mon Ma Mes Ton Ta Tes Notre Votre " +
    "Nos Vos Lors Si Comme Plus Moins Pas Ne Aussi Cela Ceci Oui Non Sont Est").split(" "));
/** A word that starts with a capital and has a lowercase letter: an acronym such as NASA is not one. */
const WORD = "\\p{Lu}\\p{L}*\\p{Ll}\\p{L}*";
/** A number's group marks: a space, no-break or narrow no-break space, thin space, apostrophe, `.` or `,`. */
const GROUP_MARK = "[\\u00a0\\u202f\\u2009'’.,]";
/**
 * Digits in groups, one kind of group mark throughout (a mixed run is two numbers): the first group has one
 * to three digits, every later one exactly three, then an optional decimal part whose mark is not the group mark.
 * A plain space is not a group mark: `Chapter 3 200 pages` is two numbers, and only a no-break, narrow or
 * thin space (what French and Polish typography uses) joins digits. Uses the named group `gm` once per regex.
 */
const GROUPED = `\\d{1,3}(?<gm>${GROUP_MARK})\\d{3}(?:\\k<gm>\\d{3})*(?!\\d)(?:(?!\\k<gm>)[.,]\\d+)?`;
/** Digit groups as written: the first one to three digits, every later one exactly three. */
const groupedDigits = (parts) => parts[0].length >= 1 && parts[0].length <= 3 && parts.slice(1).every((p) => p.length === 3);
/**
 * The canonical value of a number token (digits, group marks, an optional decimal mark, an optional
 * `%`). Without a group mark it is the text as written, with the comma thousands of `1,250` removed.
 * With one, the last of `.` and `,` is the decimal mark when both occur; the other marks, and every
 * space or apostrophe, are group marks and are dropped. No float arithmetic.
 */
function canonicalNumber(value) {
    const pct = value.endsWith("%") ? "%" : "";
    const token = pct ? value.slice(0, -1) : value;
    const literal = () => token.replace(/(\d),(?=\d{3}(?!\d))/g, "$1") + pct;
    const seps = [...token.matchAll(/[^\d]/gu)].map((m) => m[0]);
    if (!seps.length)
        return value;
    const parts = token.split(/[^\d]/u);
    const last = seps[seps.length - 1];
    // Both `.` and `,` present: the last one is the decimal mark, the earlier ones are group marks.
    if (seps.length >= 2 && (last === "," || last === ".") && seps[0] !== last && seps.slice(0, -1).every((c) => c === seps[0])) {
        const whole = parts.slice(0, -1);
        return groupedDigits(whole) ? `${whole.join("")}.${parts[parts.length - 1]}${pct}` : literal();
    }
    // Only one kind of mark: a group mark when it repeats or is a space or apostrophe; a lone `.` or `,`
    // (`1.250`, `1,250`, `0,53`) is ambiguous and keeps its text.
    if (seps.every((c) => c === seps[0])) {
        const spaceLike = seps[0] !== "." && seps[0] !== ",";
        if ((seps.length >= 2 || spaceLike) && groupedDigits(parts))
            return `${parts.join("")}${pct}`;
    }
    return literal();
}
const normaliseNumber = (value) => canonicalNumber(value);
/**
 * Spelled-out numbers by language tag, read as number facts by value, so `three` and `3` are the same
 * fact. English is always read; the language of the texts is read in addition. Excluded as ambiguous:
 * every word for one, `once`, `sei` (it), `neuf` (fr), `on` (tr), `altı` and `yedi` (tr), `dos` outside es.
 */
const NUMBER_WORDS = {
    en: {
        two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
        thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20,
        thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
    },
    es: {
        dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, doce: 12, trece: 13,
        catorce: 14, quince: 15, veinte: 20, treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70,
        ochenta: 80, noventa: 90,
    },
    pt: {
        dois: 2, duas: 2, três: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, onze: 11, doze: 12,
        treze: 13, catorze: 14, quatorze: 14, quinze: 15, vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50,
        sessenta: 60, setenta: 70, oitenta: 80, noventa: 90,
    },
    de: {
        zwei: 2, drei: 3, vier: 4, fünf: 5, sechs: 6, sieben: 7, acht: 8, neun: 9, zehn: 10, elf: 11, zwölf: 12,
        dreizehn: 13, vierzehn: 14, fünfzehn: 15, sechzehn: 16, siebzehn: 17, achtzehn: 18, neunzehn: 19, zwanzig: 20,
        dreißig: 30, vierzig: 40, fünfzig: 50, sechzig: 60, siebzig: 70, achtzig: 80, neunzig: 90,
    },
    fr: {
        deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, dix: 10, onze: 11, douze: 12, treize: 13,
        quatorze: 14, quinze: 15, seize: 16, vingt: 20, trente: 30, quarante: 40, cinquante: 50, soixante: 60,
    },
    nl: {
        twee: 2, drie: 3, vier: 4, vijf: 5, zes: 6, zeven: 7, acht: 8, negen: 9, tien: 10, elf: 11, twaalf: 12,
        dertien: 13, veertien: 14, vijftien: 15, zestien: 16, zeventien: 17, achttien: 18, negentien: 19, twintig: 20,
        dertig: 30, veertig: 40, vijftig: 50, zestig: 60, zeventig: 70, tachtig: 80, negentig: 90,
    },
    it: {
        due: 2, tre: 3, quattro: 4, cinque: 5, sette: 7, otto: 8, nove: 9, dieci: 10, undici: 11, dodici: 12, tredici: 13,
        quattordici: 14, quindici: 15, sedici: 16, venti: 20, trenta: 30, quaranta: 40, cinquanta: 50, sessanta: 60,
        settanta: 70, ottanta: 80, novanta: 90,
    },
    pl: {
        dwa: 2, dwie: 2, dwóch: 2, trzy: 3, trzech: 3, cztery: 4, czterech: 4, pięć: 5, pięciu: 5, sześć: 6, sześciu: 6,
        siedem: 7, siedmiu: 7, osiem: 8, ośmiu: 8, dziewięć: 9, dziewięciu: 9, dziesięć: 10, dziesięciu: 10,
        jedenaście: 11, dwanaście: 12, trzynaście: 13, czternaście: 14, piętnaście: 15, dwadzieścia: 20,
        trzydzieści: 30, czterdzieści: 40, pięćdziesiąt: 50, sześćdziesiąt: 60, siedemdziesiąt: 70, osiemdziesiąt: 80,
        dziewięćdziesiąt: 90,
    },
    id: {
        dua: 2, tiga: 3, empat: 4, lima: 5, enam: 6, tujuh: 7, delapan: 8, sembilan: 9, sepuluh: 10, sebelas: 11,
    },
    tr: {
        iki: 2, üç: 3, dört: 4, beş: 5, sekiz: 8, dokuz: 9, yirmi: 20, otuz: 30, kırk: 40, elli: 50, altmış: 60,
        yetmiş: 70, seksen: 80, doksan: 90,
    },
};
const NO_NUMBER_WORDS = {};
/** The number words read for a text: English always, plus the language when the table has one. */
function numberWordsFor(language) {
    const base = language ? language.split(/[-_]/)[0].toLowerCase() : "en";
    // English words are read only in English text or in a language without a table: `ten` is "this" in Polish
    // and `ten minste` is "at least" in Dutch.
    const own = NUMBER_WORDS[base];
    return new Map([
        ...(own === undefined || base === "en" ? Object.entries(NUMBER_WORDS["en"] ?? NO_NUMBER_WORDS) : []),
        ...Object.entries(own ?? NO_NUMBER_WORDS),
    ]);
}
/** A currency code or sign directly before digits: not part of the number. */
const CURRENCY_BEFORE_DIGITS = /(?<![\p{L}\d])(?:Rp|USD|EUR|CHF|PLN|IDR|TRY|TL|SEK|NOK|DKK|US\$|R\$|\$|€|£)(?=\d)/gu;
/** A number token as written: grouped (`1 000`, `1.250.000`) or plain (`1.250,50`, `40%`). */
const NUMBER_TOKEN = new RegExp(`(?<![\\p{L}\\d.,])(?:${GROUPED}|\\d+(?:[.,]\\d+)*)%?`, "gu");
/** Languages that capitalise every noun: a capital in the middle of a sentence says nothing about a name. */
const CAPITALISED_NOUNS = new Set(["de", "lb"]);
/** Whether single capitalised words are no names in these texts: the language capitalises every noun. */
function namesAreNoise(before, after, language) {
    const declared = language !== undefined && language !== "" && language.toLowerCase() !== "auto" ? language : undefined;
    const tag = declared ?? frontMatterLanguage(before) ?? frontMatterLanguage(after) ?? detectLanguage(before).tag ?? detectLanguage(after).tag;
    return tag !== null && tag !== undefined && CAPITALISED_NOUNS.has(tag.split(/[-_]/)[0].toLowerCase());
}
export function extractFacts(text, options = {}) {
    const found = [];
    const add = (kind, value) => {
        if (value)
            found.push({ kind, value });
    };
    let rest = text;
    // Code is a fact itself, and nothing inside it is read as prose.
    rest = rest.replace(/^[ \t]*(`{3,}|~{3,})[^\n]*\n([\s\S]*?)^[ \t]*\1[ \t]*$/gm, (m, _fence, body) => {
        add("code", body.trim());
        return blank(m);
    });
    rest = rest.replace(/`([^`\n]+)`/g, (m, body) => {
        add("code", body.trim());
        return blank(m);
    });
    rest = rest.replace(/https?:\/\/[^\s)>\]]+/g, (m) => {
        add("url", m.replace(/[.,;:]+$/, ""));
        return blank(m);
    });
    rest = rest.replace(/(?<![\p{L}\d&])#\d+(?![\p{L}\d])/gu, (m) => {
        add("reference", m);
        return blank(m);
    });
    rest = rest.replace(/(?<![\p{L}\d-])[A-Z][A-Z0-9]+-\d+(?![\p{L}\d])/gu, (m) => {
        add("reference", m);
        return blank(m);
    });
    rest = rest.replace(/(?<!\d)\d{4}-\d{2}-\d{2}(?!\d)/g, (m) => {
        add("date", m);
        return blank(m);
    });
    // A trailing year is part of the date: "14 September, 2024" is one fact, not a date and a number.
    // The day may end in a dot ("3. Oktober"), and particles may stand before the month and before the year.
    rest = rest.replace(new RegExp(`(?<![\\p{L}\\d])\\d{1,2}\\.?[ \\u00a0]+(?:${DATE_PARTICLE})?(?:${MONTHS})(?:,?[ \\u00a0]+(?:${DATE_PARTICLE})?\\d{4}(?!\\d))?(?![\\p{L}])`, "giu"), (m) => {
        // The value drops the comma, the day's dot and the particles, and normalises the spaces. Case is kept here;
        // `keyOf` compares dates case-insensitively, because existing callers read the value as written.
        add("date", m
            .replace(/,/g, "")
            .split(/\s+/)
            .map((t) => t.replace(/^(\d{1,2})\.$/, "$1"))
            .filter((t) => !/^(?:de|del|of|van)$/i.test(t))
            .join(" "));
        return blank(m);
    });
    // A currency code or sign directly before the digits is not part of the number: `Rp1.500.000` is the
    // number 1.500.000. Only a code that is not glued to a letter or digit counts (`BUSD500` is no currency).
    rest = rest.replace(CURRENCY_BEFORE_DIGITS, blank);
    // Four dotted groups of one to three digits are an address (`192.168.100.200`), a version fact, never `192168100200`.
    // `1.000.000.000` is a number: an address starts with a group of three digits and every group is at most 255.
    rest = rest.replace(/(?<![\p{L}\d.,])\d{1,3}(?:\.\d{1,3}){3}(?![\p{L}\d%]|[.,]\d)/gu, (m) => {
        const groups = m.split(".");
        if (groups[0].length !== 3 || groups.some((g) => Number(g) > 255))
            return m;
        add("version", m);
        return blank(m);
    });
    // A dotted number is a version, unless a letter or a percent sign follows it (3.2x, 40.5%). A leading
    // `v`, or a run that is not exactly one to three digits then three-digit groups (`2.3.456`), is a version.
    // `1.250.000` is a number: the first group is one to three digits and at least two later ones are three.
    rest = rest.replace(/(?<![\p{L}\d.,])(?:v\d+(?:\.\d+)+|(?!\d{1,3}(?:\.\d{3}){2,}(?!\d|[.,]\d))\d+(?:\.\d+)+)(?![\p{L}\d%]|[.,]\d)/gu, (m) => {
        add("version", m);
        return blank(m);
    });
    // Quotations: straight, curly, guillemets and German low quotes; three or more words only.
    rest = rest.replace(/"([^"\n]+)"|“([^”\n]+)”|„([^“”\n]+)[“”"]|«([^»\n]+)»/gu, (m, a, b, c, d) => {
        const inner = a ?? b ?? c ?? d ?? "";
        const value = inner
            .replace(/[“”„«»]/g, '"')
            .replace(/[‘’]/g, "'")
            .replace(/\s+/g, " ")
            .trim();
        if (value.split(" ").length < 3)
            return m;
        add("quote", value);
        return blank(m);
    });
    // An ordered-list marker (`1.` at the start of a line) is layout, not a fact.
    rest = rest.replace(/^[ \t]*\d+[.)](?=[ \t])/gm, blank);
    // A number is digits in plain runs (`1.250,50`, `40%`) or in groups (`1 000`, `1'250`, `1.250.000`).
    // A group is a space, no-break space, thin space, apostrophe, `.` or `,` followed by exactly three digits.
    rest = rest.replace(NUMBER_TOKEN, (m) => {
        add("number", normaliseNumber(m));
        return blank(m);
    });
    // Spelled-out numbers: a whole word of the table, case-insensitive, is its value. A word joined to a letter
    // or digit by `-` or `_` (`five-star`, `three_way`) and a word after `#` are not read.
    const spelled = numberWordsFor(options.language);
    rest = rest.replace(/[\p{L}\p{M}]+/gu, (m, offset) => {
        const value = spelled.get(m.toLowerCase());
        if (value === undefined)
            return m;
        const wordChar = (c) => /[\p{L}\p{M}\p{N}]/u.test(c);
        const before1 = rest[offset - 1] ?? "";
        const before2 = rest[offset - 2] ?? "";
        const after1 = rest[offset + m.length] ?? "";
        const after2 = rest[offset + m.length + 1] ?? "";
        if (before1 === "#" || wordChar(before1))
            return m;
        if ((before1 === "-" || before1 === "_") && wordChar(before2))
            return m;
        if ((after1 === "-" || after1 === "_") && wordChar(after2))
            return m;
        // A capitalised word in the middle of a sentence is a noun or a name (German `Acht geben`, the city `Lima`).
        if (/^\p{Lu}/u.test(m)) {
            const prev = rest.slice(0, offset).replace(/[\s*_~]+$/u, "").slice(-1);
            if (/[\p{Ll}\d,;]/u.test(prev))
                return m;
        }
        add("number", String(value));
        return blank(m);
    });
    // Names: capitalised runs that do not start a sentence, a list item or a heading.
    const runs = new RegExp(`(?<![\\p{L}\\d])${WORD}(?: ${WORD})*(?![\\p{L}\\d])`, "gu");
    rest.replace(runs, (m, offset) => {
        const lineStart = rest.lastIndexOf("\n", offset - 1) + 1;
        // Emphasis markers are not text: "- **Faster rollouts:** Rollouts" starts a sentence after the colon.
        const before = rest.slice(lineStart, offset).replace(/[*_~]+/g, "").trimEnd();
        // Only list, heading, emoji, digit or dialogue marks before the word: it starts the line or a list item.
        const onlyMarks = /^[\s\p{Extended_Pictographic}\uFE0F#>+\-\d.)¿¡—–"“„«]*$/u.test(before);
        // A sentence-ending mark before the word: the word starts the next sentence. A table-cell
        // border counts too: the first word of a cell starts that cell's text.
        const afterStop = /[.!?:"“„«—–]$/.test(before);
        if (onlyMarks || afterStop)
            return m;
        // A table-cell border: one capitalised word opening a cell is the start of that cell's text
        // ("Delves into typing"), but a run of several is a name ("Mateusz Wójcik | Maintainer").
        if (/\|$/.test(before) && !m.includes(" "))
            return m;
        const words = m.split(" ");
        while (words.length && STOPWORDS.has(words[0]))
            words.shift();
        while (words.length && STOPWORDS.has(words[words.length - 1]))
            words.pop();
        // German capitalises every noun, so there only a run of several capitalised words is a name.
        if (words.length && options.names !== false && (!options.multiWordNamesOnly || words.length >= 2))
            add("name", words.join(" "));
        return m;
    });
    // The same fact counted once, whatever number of times it appears.
    const seen = new Set();
    return found.filter((f) => {
        const key = `${f.kind}\u0000${f.value}`;
        if (seen.has(key))
            return false;
        seen.add(key);
        return true;
    });
}
/**
 * Every first-person word the reader recognises, by language tag. Lowercase; a trailing apostrophe
 * is an elision (French `j'`). A language not listed here has no person facts; text whose language
 * cannot be told is read with the English list. Which of these words may raise a flag is decided
 * below, from the measurement in bench/COMPARE-WORDS.md.
 */
export const PERSON_CANDIDATES = {
    en: ["i", "i'm", "i've", "i'll", "i'd", "me", "my", "mine", "myself", "we", "we're", "we've", "we'll", "we'd", "us", "our", "ours", "ourselves"],
    fr: ["je", "j'", "nous", "notre", "nos", "mon", "ma", "mes", "moi"],
    es: ["yo", "nosotros", "nosotras", "nuestro", "nuestra", "nuestros", "nuestras", "mi", "mis"],
    de: ["ich", "wir", "unser", "unsere", "unseren", "unserem", "unserer", "mein", "meine", "meinen", "meinem", "meiner", "mich", "uns"],
    tr: ["ben", "biz", "bizim", "benim"],
    nl: ["wij", "we", "ons", "onze", "ik", "mijn"],
    pt: ["nós", "nosso", "nossa", "nossos", "nossas", "eu", "meu", "minha", "meus", "minhas"],
    it: ["noi", "nostro", "nostra", "nostri", "nostre", "io", "mio", "mia"],
    pl: ["my", "nasz", "nasza", "nasze", "naszych", "ja", "mój", "moja", "moje"],
    id: ["kami", "kita", "saya", "aku"],
};
/**
 * A Polish first-person plural past verb (`zrobiliśmy`, `byłyśmy`): the ending -liśmy or -łyśmy on a word
 * of at least eight letters. The closed form is the guard; the same structure as the Portuguese check.
 */
const PL_PLURAL_PAST_VERB = /^\p{L}+(?:liśmy|łyśmy)$/u;
export function isPolishPersonVerb(word) {
    return PL_PLURAL_PAST_VERB.test(word);
}
/**
 * A Portuguese first-person plural verb (`fizemos`, `testamos`): the ending -amos or -emos on a word
 * of at least seven letters, minus the nouns and adjectives that end the same way. A rewrite that turns
 * a passive into `we did` adds a person the source never had; compared by count, and only the
 * increase is reported. It sits outside the PERSON_* tables on purpose: those hold the words
 * measured in bench/COMPARE-WORDS.md, and the repository has no Portuguese golden to measure on.
 * The guard is the closed form (ending, length, noun list) and the tests in test/round6.test.mjs.
 */
const PT_PLURAL_VERB = /^\p{L}{3,}(?:amos|emos)$/u;
const PT_NOT_VERB = new Set(["extremos", "supremos", "ramos", "reclamos", "quilogramos", "miligramos", "telegramos", "blasfemos", "boêmos"]);
export function isPortuguesePersonVerb(word) {
    return PT_PLURAL_VERB.test(word) && !PT_NOT_VERB.has(word);
}
/**
 * Claim words and phrases measured for the precision rule, by language tag. `leading` alone is not
 * a candidate: technical text adds it honestly (`the leading slash`, `leading zeros`), and the
 * corpus has no case of it either way; `industry-leading` is the claim.
 */
export const CLAIM_CANDIDATES = {
    en: [
        "best", "fastest", "world-class", "unmatched", "unparalleled", "only", "always", "never", "every", "everyone",
        "nobody", "guaranteed", "guarantees", "proven", "revolutionary", "industry-leading", "because", "therefore", "thus",
        "ensuring", "ensures", "enabling", "enables", "so that", "which means", "as a result",
    ],
    fr: ["par conséquent", "donc", "car", "garantit", "toujours", "jamais"],
    es: ["por lo tanto", "siempre", "nunca", "garantiza"],
    de: ["daher", "deshalb", "immer", "nie", "garantiert"],
    pt: ["sempre", "nunca", "garante"],
    nl: ["altijd", "nooit", "garandeert"],
    it: ["sempre", "mai", "garantisce"],
    pl: ["zawsze", "nigdy", "gwarantuje"],
    id: ["selalu", "tidak pernah", "menjamin"],
    tr: ["her zaman", "asla"],
};
/** Person words reported when the rewrite has more of them than the source. */
export const PERSON_ADDED = {
    en: ["i'm", "i've", "i'll", "me", "my", "mine", "myself", "we", "we're", "we've", "we'll", "we'd", "us", "our", "ours", "ourselves"],
    fr: ["je", "j'", "nous", "notre", "nos", "mon", "ma", "mes", "moi"],
    es: ["yo", "nosotros", "nosotras", "nuestro", "nuestra", "nuestros", "nuestras", "mi", "mis"],
    de: ["ich", "wir", "unser", "unsere", "unseren", "unserem", "unserer", "mein", "meine", "meinen", "meinem", "meiner", "mich"],
    tr: ["ben", "biz", "bizim", "benim"],
    nl: ["wij", "we", "ons", "onze", "ik", "mijn"],
    pt: ["nós", "nosso", "nossa", "nossos", "nossas", "eu", "meu", "minha", "meus", "minhas"],
    it: ["noi", "nostro", "nostra", "nostri", "nostre", "io", "mio", "mia"],
    pl: ["my", "nasz", "nasza", "nasze", "naszych", "ja", "mój", "moja", "moje"],
    id: ["kami", "kita", "saya", "aku"],
};
/** Person words reported when the rewrite has fewer of them than the source. */
export const PERSON_LOST = {
    en: ["i'd", "us"],
    fr: ["notre"],
    de: ["uns"],
};
/** Claim words reported when the rewrite has more of them than the source (removals are never reported). */
export const CLAIM_WORDS = {
    en: ["fastest", "world-class", "unmatched", "unparalleled", "always", "never", "every", "guaranteed", "guarantees", "proven", "revolutionary", "industry-leading", "because", "therefore", "thus", "ensuring", "ensures", "enabling", "enables", "so that", "which means", "as a result"],
    fr: ["par conséquent", "donc", "car", "garantit", "toujours", "jamais"],
    es: ["por lo tanto", "siempre", "nunca", "garantiza"],
    de: ["daher", "deshalb", "immer", "nie", "garantiert"],
    pt: ["sempre", "nunca", "garante"],
    nl: ["altijd", "nooit", "garandeert"],
    it: ["sempre", "mai", "garantisce"],
    pl: ["zawsze", "nigdy", "gwarantuje"],
    id: ["selalu", "tidak pernah", "menjamin"],
    tr: ["her zaman", "asla"],
};
/**
 * Qualifier candidates: an approximator or a bound written right before a number, by language tag,
 * each mapped to its group. `approx` is "about that number", `min` "that number or more", `max` "that
 * number or less". A swap within a group is not a change of fact; a move between groups, a lost or an
 * added qualifier is. Which of these may raise a flag is decided from bench/COMPARE-QUALIFIERS.md.
 */
export const QUALIFIER_CANDIDATES = {
    en: {
        about: "approx", around: "approx", roughly: "approx", approximately: "approx", nearly: "approx", almost: "approx", "close to": "approx",
        "up to": "max", "at most": "max", under: "max", "less than": "max", "fewer than": "max",
        "at least": "min", over: "min", "more than": "min",
    },
    fr: {
        environ: "approx", "près de": "approx", presque: "approx", quasiment: "approx",
        "jusqu'à": "max", "moins de": "max", "au plus": "max",
        "plus de": "min", "au moins": "min",
    },
    de: {
        etwa: "approx", rund: "approx", ca: "approx", circa: "approx", fast: "approx", knapp: "approx", ungefähr: "approx",
        "bis zu": "max", "weniger als": "max", "höchstens": "max",
        "mehr als": "min", "mindestens": "min", "über": "min",
    },
    es: {
        unos: "approx", unas: "approx", "alrededor de": "approx", casi: "approx", aproximadamente: "approx", "cerca de": "approx",
        hasta: "max", "menos de": "max", "como máximo": "max",
        "más de": "min", "al menos": "min", "como mínimo": "min",
    },
    pt: {
        aproximadamente: "approx", "cerca de": "approx", quase: "approx", uns: "approx", umas: "approx",
        "até": "max", "menos de": "max", "no máximo": "max",
        "mais de": "min", "pelo menos": "min", "no mínimo": "min",
    },
    nl: {
        ongeveer: "approx", circa: "approx", bijna: "approx",
        tot: "max", "minder dan": "max", hooguit: "max", maximaal: "max",
        "meer dan": "min", minstens: "min", minimaal: "min", "ten minste": "min",
    },
    it: {
        circa: "approx", "intorno a": "approx", quasi: "approx",
        "fino a": "max", "meno di": "max", "al massimo": "max",
        "più di": "min", almeno: "min", oltre: "min",
    },
    pl: {
        "około": "approx", prawie: "approx", niemal: "approx",
        maksymalnie: "max", "mniej niż": "max", "co najwyżej": "max",
        "więcej niż": "min", ponad: "min", "co najmniej": "min", przynajmniej: "min",
    },
    id: {
        sekitar: "approx", "kira-kira": "approx", hampir: "approx",
        hingga: "max", "kurang dari": "max", maksimal: "max", "paling banyak": "max",
        "lebih dari": "min", minimal: "min", setidaknya: "min", "paling sedikit": "min",
    },
    tr: {
        "yaklaşık": "approx", neredeyse: "approx",
        "en fazla": "max", "en çok": "max",
        "en az": "min",
    },
};
/**
 * Qualifiers reported when a rewrite drops or adds one next to a number both texts have. English `about`
 * and `approximately` are not here: `about` flagged an honest round 1 rewrite, and without it a swap of
 * `approximately` for `about` would flag (bench/COMPARE-QUALIFIERS.md).
 */
export const QUALIFIERS = {
    en: ["around", "roughly", "nearly", "almost", "close to", "up to", "at most", "under", "less than", "fewer than", "at least", "over", "more than"],
    fr: ["environ", "près de", "presque", "quasiment", "jusqu'à", "moins de", "au plus", "plus de", "au moins"],
    de: ["etwa", "rund", "ca", "circa", "fast", "knapp", "ungefähr", "bis zu", "weniger als", "höchstens", "mehr als", "mindestens", "über"],
    es: ["unos", "unas", "alrededor de", "casi", "aproximadamente", "cerca de", "hasta", "menos de", "como máximo", "más de", "al menos", "como mínimo"],
    pt: ["aproximadamente", "cerca de", "quase", "uns", "umas", "até", "menos de", "no máximo", "mais de", "pelo menos", "no mínimo"],
    nl: ["ongeveer", "circa", "bijna", "tot", "minder dan", "hooguit", "maximaal", "meer dan", "minstens", "minimaal", "ten minste"],
    it: ["circa", "intorno a", "quasi", "fino a", "meno di", "al massimo", "più di", "almeno", "oltre"],
    pl: ["około", "prawie", "niemal", "maksymalnie", "mniej niż", "co najwyżej", "więcej niż", "ponad", "co najmniej", "przynajmniej"],
    id: ["sekitar", "kira-kira", "hampir", "hingga", "kurang dari", "maksimal", "paling banyak", "lebih dari", "minimal", "setidaknya", "paling sedikit"],
    tr: ["yaklaşık", "neredeyse", "en fazla", "en çok", "en az"],
};
/** Verbs and nouns after which English `about` means "on the subject of": `talked about 3 options`. */
const ABOUT_TOPIC = /(?:^|[^\p{L}])(?:talk|talks|talked|talking|think|thinks|thought|thinking|write|writes|wrote|written|writing|ask|asks|asked|asking|know|knows|knew|known|learn|learns|learned|learnt|read|reads|reading|hear|hears|heard|care|cares|cared|worry|worries|worried|complain|complains|complained|say|says|said|tell|tells|told|story|stories|question|questions|post|posts|article|articles|note|notes|more|all)\s+$/iu;
/** Units of time after which `over` and `über` mean "across" (`over 2 weeks`), not "more than". */
const SPAN_UNIT = /^\s*(?:minutes?|hours?|days?|nights?|weeks?|months?|years?|decades?|quarters?|sprints?|releases?|versions?|Minuten|Stunden|Tagen?|Wochen|Monaten?|Jahren?|Jahrzehnten?|Quartalen?|Sprints?|Releases?|Versionen)(?![\p{L}])/iu;
/** Qualifiers that are also a date bound (`until 2025`), by language tag. */
const YEAR_BOUND = { es: ["hasta"], pt: ["até"], nl: ["tot"], it: ["fino a"], id: ["hingga"] };
/**
 * Whether a qualifier word is used in another sense here: English `about` after a verb of talking or
 * thinking, `over` or `über` before a span of time, Spanish `hasta` before a year (until 2025).
 */
function otherSense(lang, key, before, after, number) {
    if (lang === "en" && key === "about")
        return ABOUT_TOPIC.test(before);
    if ((lang === "en" && key === "over") || (lang === "de" && key === "über"))
        return SPAN_UNIT.test(after);
    // `hasta 2025`, `até 2025`, `tot 2025`, `fino a 2025`, `hingga 2025`: a bound on a date, unless a % follows.
    // A range written with the same word (`9 tot 17`, `das 9 até 17`) is not a bound: a number comes right before it.
    if (YEAR_BOUND[lang]?.includes(key))
        return /\d\s*$/.test(before) || (/^(?:1[89]|20)\d\d$/.test(number) && !/^\s*%/.test(after));
    return false;
}
/** Every listed qualifier written right before a number, in the prose of a text (code, urls and quotes are blanked). */
export function qualifiedNumbers(text, tag, words) {
    const lang = tag ? tag.split(/[-_]/)[0].toLowerCase() : "en";
    const groups = QUALIFIER_CANDIDATES[lang] ?? {};
    const list = (words ?? QUALIFIERS[lang] ?? []).filter((w) => groups[w] !== undefined);
    if (!list.length)
        return [];
    const alternation = [...list]
        .sort((a, b) => b.length - a.length)
        .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/'/g, "['’]").replace(/ /g, "\\s+"))
        .join("|");
    // `ca.` keeps its dot; a currency sign may sit between the qualifier and the digits (`about $40`). A
    // qualifier glued to its number (`over40`) is not read.
    const re = new RegExp(`(?<![\\p{L}\\d'’-])(${alternation})(?:\\.?\\s+(?:(?:Rp|USD|EUR|CHF|PLN|IDR|TRY|TL|SEK|NOK|DKK|US\\$|R\\$|[$€£¥])\\s?)?|\\s*(?:Rp|USD|EUR|CHF|PLN|IDR|TRY|TL|SEK|NOK|DKK|US\\$|R\\$|[$€£¥])\\s?)(${GROUPED}|\\d+(?:[.,]\\d+)*)(?![.,]?\\d)`, "giu");
    const found = [];
    const prose = proseOnly(text);
    for (const m of prose.matchAll(re)) {
        // `jusqu'à` and `jusqu’à` are one word, and so are runs of spaces.
        const key = m[1].toLowerCase().replace(/’/g, "'").replace(/\s+/g, " ");
        const group = groups[key];
        if (group === undefined)
            continue;
        if (otherSense(lang, key, prose.slice(Math.max(0, m.index - 24), m.index), prose.slice(m.index + m[0].length, m.index + m[0].length + 16), m[2]))
            continue;
        found.push({ qualifier: key, group, number: normaliseNumber(m[2]) });
    }
    return found;
}
/** The plain numbers of a text's prose, normalised as number facts are. */
function proseNumbers(text) {
    const prose = proseOnly(text).replace(CURRENCY_BEFORE_DIGITS, blank);
    return new Set([...prose.matchAll(NUMBER_TOKEN)].map((m) => normaliseNumber(m[0]).replace(/%$/, "")));
}
/**
 * The qualifier facts a rewrite lost or added: for each group and number, a rewrite with fewer
 * qualified occurrences lost one, with more added one. Only a number that the other text also has
 * counts, because a changed number is reported as a number already. `words` defaults to QUALIFIERS.
 */
export function qualifierChanges(before, after, tag, words) {
    const qb = qualifiedNumbers(before, tag, words);
    const qa = qualifiedNumbers(after, tag, words);
    const lost = [];
    const added = [];
    if (!qb.length && !qa.length)
        return { lost, added };
    const tally = (list) => {
        const m = new Map();
        for (const q of list) {
            const key = `${q.group}\u0000${q.number}`;
            m.set(key, [...(m.get(key) ?? []), q]);
        }
        return m;
    };
    const diff = (from, to, numbersOfTo, out) => {
        for (const [key, list] of from) {
            const q = list[0];
            if ((to.get(key)?.length ?? 0) < list.length && numbersOfTo.has(q.number))
                out.push({ kind: "qualifier", value: `${q.qualifier} ${q.number}` });
        }
    };
    diff(tally(qb), tally(qa), proseNumbers(after), lost);
    diff(tally(qa), tally(qb), proseNumbers(before), added);
    return { lost, added };
}
/**
 * Numbers that lost their unit: `4,8 segundos` in the original, and the rewrite still has 4,8 but not
 * followed by the same unit (`1,2 segundos en lugar de 4,8`). A number that is gone is reported as a
 * number already. Units are the measure words of the hedge check (seconds, %, ms, MB, ...).
 */
export function unitChanges(before, after) {
    const pair = new RegExp(`(?<![\\p{L}\\d.,])(${GROUPED}|\\d+(?:[.,]\\d+)*)\\s?(${UNIT_WORDS})(?![\\p{L}\\d])`, "giu");
    const pairs = (text) => [...proseOnly(text).matchAll(pair)].map((m) => ({ number: normaliseNumber(m[1]), unit: m[3].toLowerCase() }));
    const kept = new Set(pairs(after).map((p) => `${p.number}\u0000${p.unit}`));
    const numbers = proseNumbers(after);
    const out = [];
    const seen = new Set();
    for (const p of pairs(before)) {
        const key = `${p.number}\u0000${p.unit}`;
        if (seen.has(key))
            continue;
        seen.add(key);
        if (!kept.has(key) && numbers.has(p.number))
            out.push({ kind: "unit", value: `${p.number} ${p.unit}` });
    }
    return out;
}
/** Text with code, urls, link targets and quoted text blanked, so none of it is read as the author's own words. */
export function proseOnly(text) {
    let rest = text;
    // A fence that is never closed runs to the end of the text, as in CommonMark.
    rest = rest.replace(/^[ \t]*(`{3,}|~{3,})[^\n]*\n([\s\S]*?)(?:^[ \t]*\1[ \t]*$|(?![\s\S]))/gm, blank);
    rest = rest.replace(/`[^`\n]+`/g, blank);
    rest = rest.replace(/https?:\/\/[^\s)>\]]+/g, blank);
    // The target of a Markdown link or image (`[contact](#us)`); its text stays.
    rest = rest.replace(/\]\([^)\n]*\)/g, (m) => `]${blank(m.slice(1))}`);
    rest = rest.replace(/"[^"\n]*"|“[^”\n]*”|„[^“”\n]*[“”"]|«[^»\n]*»/gu, blank);
    return rest;
}
/** Words that, before a capital `I`, make it a numeral or a label (`Part I`, `Type I error`). */
const NUMERAL_LEAD = /(?:part|chapter|section|appendix|annex|phase|stage|tier|level|type|class|group|vol|volume|act|book|table|figure|fig|category|grade|step|plan|option|case|rule|article|schedule|war|henry|richard|louis|james|george|charles|edward|william|elizabeth|napoleon|world)\s+$/i;
/** The first-person words of a text, counted. `tag` picks the word list. */
export function countPersonWords(text, tag) {
    // A language with no list gets no person facts; an unknown language is read as English.
    const lang = tag ? tag.split(/[-_]/)[0].toLowerCase() : "en";
    const words = new Set(PERSON_CANDIDATES[lang] ?? []);
    const prose = proseOnly(text);
    const counts = new Map();
    const token = /[\p{L}]+(?:['’][\p{L}]+)?'?/gu;
    for (const m of prose.matchAll(token)) {
        const raw = m[0];
        // An all-capitals token is an acronym (US, ME, MA): never the pronoun.
        if (raw.length > 1 && raw === raw.toUpperCase() && !raw.includes("'") && !raw.includes("’"))
            continue;
        let norm = raw.toLowerCase().replace(/’/g, "'");
        if (lang === "fr") {
            const elided = /^j'/.exec(norm);
            if (elided)
                norm = "j'";
        }
        if (!words.has(norm))
            continue;
        const at = m.index;
        // A word joined to a letter or digit by a hyphen, underscore, slash, dot or @ is part of a
        // name, not a pronoun: `us-east-1`, `my-app`, `my_var`, `docs/our`, `our.example`. In French
        // a hyphen joins real pronouns (`contactez-nous`, `dites-moi`, `nous-mêmes`), so there it does not count.
        const joiner = lang === "fr" ? /[_/.@]/u : /[-_/.@]/u;
        const joined = (pair, letterFirst) => pair.length === 2 && joiner.test(pair[letterFirst ? 1 : 0]) && /[\p{L}\d]/u.test(pair[letterFirst ? 0 : 1]);
        if (joined(prose.slice(Math.max(0, at - 2), at), true) || joined(prose.slice(at + raw.length, at + raw.length + 2), false))
            continue;
        if (lang === "en" && /^i('|$)/.test(norm)) {
            if (raw[0] !== "I")
                continue;
            const next = prose[at + raw.length] ?? "";
            const prev = prose[at - 1] ?? "";
            if (norm === "i") {
                if (next === "/" || prev === "/" || next === "-" || prev === "-")
                    continue;
                if (/^[.)]/.test(next)) {
                    const lineStart = prose.lastIndexOf("\n", at - 1) + 1;
                    if (/^[\s#>*+\-\d.]*$/.test(prose.slice(lineStart, at)))
                        continue;
                    if (/^\.\p{L}\b/u.test(prose.slice(at + 1, at + 4)))
                        continue;
                }
                if (NUMERAL_LEAD.test(prose.slice(Math.max(0, at - 16), at)))
                    continue;
            }
        }
        counts.set(norm, (counts.get(norm) ?? 0) + 1);
    }
    return counts;
}
/** How often each term occurs in the prose of a text (whole words or phrases, case-insensitive). */
export function countTerms(text, terms) {
    const prose = proseOnly(text);
    const counts = new Map();
    for (const term of terms) {
        const source = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "\\s+");
        const n = [...prose.matchAll(new RegExp(`(?<![\\p{L}\\d'’-])${source}(?![\\p{L}\\d'’-])`, "giu"))].length;
        if (n > 0)
            counts.set(term, n);
    }
    return counts;
}
/** The language tag compareFacts reads both texts with. */
export function languageOf(before, after, language) {
    const declared = language !== undefined && language !== "" && language.toLowerCase() !== "auto" ? language : undefined;
    return (declared ??
        frontMatterLanguage(before) ??
        frontMatterLanguage(after) ??
        detectLanguage(before).tag ??
        detectLanguage(after).tag ??
        guessCompareLanguage(before) ??
        guessCompareLanguage(after) ??
        null);
}
// A date is compared case-insensitively: `3 November 2026` and `3 november 2026` are the same date.
const keyOf = (f) => `${f.kind}\u0000${f.kind === "date" ? f.value.toLowerCase() : f.value}`;
const order = (a, b) => (a.kind < b.kind ? -1 : a.kind > b.kind ? 1 : a.value < b.value ? -1 : a.value > b.value ? 1 : 0);
/**
 * The facts of `before` that `after` no longer has (lost) and the facts `after` has that
 * `before` did not (added), each sorted by kind then value, and how many facts both share.
 */
export function compareFacts(before, after, options = {}) {
    const multiWordNamesOnly = namesAreNoise(before, after, options.language);
    // The language of both texts, read once: it picks the spelled-number words and the other word lists.
    const tag = languageOf(before, after, options.language);
    const b = extractFacts(before, { multiWordNamesOnly, language: tag });
    const a = extractFacts(after, { multiWordNamesOnly, language: tag });
    const inB = new Set(b.map(keyOf));
    const inA = new Set(a.map(keyOf));
    // A name is still there when it appears as a whole word anywhere in the other text, including
    // at the start of a sentence, where extraction does not read it as a name.
    const wordIn = (name, text) => new RegExp(`(?<![\\p{L}\\d])${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}\\d])`, "u").test(text);
    const lost = b.filter((f) => !inA.has(keyOf(f)) && !(f.kind === "name" && wordIn(f.value, after))).sort(order);
    const added = a.filter((f) => !inB.has(keyOf(f)) && !(f.kind === "name" && wordIn(f.value, before))).sort(order);
    // Every distinct fact of `before` is either kept or lost.
    const kept = b.length - lost.length;
    // First-person words: any change of count is a fact. Claim words: only more of them is a fact.
    // An unknown language is read as English.
    const base = tag ? tag.split(/[-_]/)[0].toLowerCase() : "en";
    const pb = countPersonWords(before, tag);
    const pa = countPersonWords(after, tag);
    const personBase = base;
    for (const word of new Set([...pb.keys(), ...pa.keys()])) {
        const delta = (pa.get(word) ?? 0) - (pb.get(word) ?? 0);
        if (delta > 0 && PERSON_ADDED[personBase]?.includes(word))
            added.push({ kind: "person", value: word });
        else if (delta < 0 && PERSON_LOST[personBase]?.includes(word))
            lost.push({ kind: "person", value: word });
    }
    const verbCheck = base === "pt" ? isPortuguesePersonVerb : base === "pl" ? isPolishPersonVerb : null;
    if (verbCheck) {
        const verbs = (text) => {
            const n = new Map();
            for (const m of proseOnly(text.normalize("NFC")).matchAll(/\p{L}+/gu)) {
                const w = m[0].toLowerCase();
                if (verbCheck(w))
                    n.set(w, (n.get(w) ?? 0) + 1);
            }
            return n;
        };
        const total = (n) => [...n.values()].reduce((x, y) => x + y, 0);
        const vb = verbs(before);
        const va = verbs(after);
        // One person verb swapped for another is not an added person; only a higher total is.
        if (total(va) > total(vb))
            for (const [w, n] of va)
                if (n > (vb.get(w) ?? 0))
                    added.push({ kind: "person", value: w });
    }
    const terms = CLAIM_WORDS[base] ?? [];
    const cb = countTerms(before, terms);
    const ca = countTerms(after, terms);
    for (const [word, n] of ca)
        if (n > (cb.get(word) ?? 0))
            added.push({ kind: "claim", value: word.toLowerCase() });
    // Qualifiers: a number both texts have that lost its approximator or bound, or gained one.
    const q = qualifierChanges(before, after, tag);
    lost.push(...q.lost);
    added.push(...q.added);
    lost.push(...unitChanges(before, after));
    return { lost: lost.sort(order), added: added.sort(order), kept };
}
