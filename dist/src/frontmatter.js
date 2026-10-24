// The one front-matter detector. doc.ts (which blanks it) and lang.ts (which reads its language)
// both use it, so they cannot disagree about where the block ends.
const FENCE = /^(---|\+\+\+)[ \t]*$/;
/**
 * Front matter at the very top of a file, found line by line. An empty block (two fences in a
 * row) is a block with an empty body, so the lines after it are never read as front matter. A
 * leading byte order mark is skipped and reported as part of `start`.
 */
export function findFrontMatter(text) {
    const start = text.charCodeAt(0) === 0xfeff ? 1 : 0;
    const first = lineAt(text, start);
    if (!first || !FENCE.test(first.line))
        return null;
    const fence = first.line.trim();
    let bodyStart = first.next;
    let cursor = first.next;
    while (cursor < text.length) {
        const line = lineAt(text, cursor);
        if (!line)
            break;
        if (line.line.trim() === fence) {
            return { start, end: line.next, body: text.slice(bodyStart, cursor).replace(/\r?\n$/, ""), fence };
        }
        cursor = line.next;
    }
    return null;
}
/** The line starting at `from`, without its line break, and the offset of the next line. */
function lineAt(text, from) {
    if (from >= text.length)
        return null;
    const nl = text.indexOf("\n", from);
    if (nl < 0)
        return { line: text.slice(from).replace(/\r$/, ""), next: text.length };
    return { line: text.slice(from, nl).replace(/\r$/, ""), next: nl + 1 };
}
