export interface FrontMatter {
    /** Offset of the opening fence, 0 or 1 when a byte order mark comes first. */
    start: number;
    /** Offset just past the closing fence line and its line break, or the end of the text. */
    end: number;
    /** The text between the two fences, without the fences. Empty for an empty block. */
    body: string;
    /** Which fence opened the block: YAML (---) or TOML (+++). */
    fence: "---" | "+++";
}
/**
 * Front matter at the very top of a file, found line by line. An empty block (two fences in a
 * row) is a block with an empty body, so the lines after it are never read as front matter. A
 * leading byte order mark is skipped and reported as part of `start`.
 */
export declare function findFrontMatter(text: string): FrontMatter | null;
