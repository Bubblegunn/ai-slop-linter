import { scan } from "../doc.js";
// The French rule pack. Each rule ships only if it has zero findings on every French human file
// and at least one on the French machine corpus, and no hand-written negative sentence fires it
// (test/fr-pack.test.mjs). Boundaries are lookarounds on \p{L}, because \b does not treat accented
// letters as word characters. Both apostrophes are matched.
//
// What was measured and dropped, and why, is in bench/PACKS.md and the task report. In short: most
// candidate phrases had no machine hit at all; the ones that did were in one product's text, or
// were ordinary French that the negatives fired on.
/**
 * A call to action that closes a page with a deadline-style push: "Essayez Calbo dès aujourd'hui".
 * The verb frame is what separates it from "dès aujourd'hui" in ordinary prose, such as "le
 * formulaire est disponible dès aujourd'hui", which has no call to act.
 */
export const frCloser = {
    id: "fr/closer",
    title: "Call to action that closes the text (French)",
    severity: "warning",
    source: "Provisional, chosen after seeing 4 machine hits (2 of them in the coached Fastq files, 2 in neutral-prompt files); related to Wikipedia, Signs of AI writing: Promotional and advertisement-like language. Zero hits in 40,160 human words (bench/PACKS.md)",
    why: "A closing push with a date and no offer behind it adds a sentence that tells the reader to act now without saying what they gain. In model output this closing line appears in several unrelated product texts.",
    example: {
        before: "Essayez Calbo dès aujourd'hui pour vos classes.",
        after: "Calbo synchronise les agendas des classes et des parents.",
    },
    ignoreWhen: "The text is a real sales page or a campaign where the date is the offer, such as a sale that starts today. A verb of trying, installing or adopting followed by 'dès aujourd'hui' is then the message, not a tell.",
    check(doc) {
        return scan(doc, frCloser, /(?<!\p{L})(?:essayez|installez|adoptez)[\s-](?:\p{L}+[\s-]){0,2}?dès aujourd['’]hui(?!\p{L})/giu, () => "\"... dès aujourd'hui\" after a call to act: say what the reader gets");
    },
};
/** The French pack, switched on by the French language (see `languageRules` in src/index.ts). */
export const frRules = [frCloser];
