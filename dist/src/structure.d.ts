/**
 * The blocks `--verify` holds fixed: front matter, fenced code blocks, Markdown table rows and
 * heading lines. Each is compared with the original by position and byte for byte (line ends
 * normalised). The original's blocks must appear in the rewrite in the same order, so an edit, a
 * deletion and a reorder are all problems; a block the rewrite adds between them is not.
 */
export interface StructureProblem {
    line: number;
    message: string;
}
/** Problems in the rewrite's structure against the original; empty when it keeps every block. */
export declare function structureProblems(before: string, after: string): StructureProblem[];
