import { type Doc } from "./doc.js";
export interface CatalogHit {
    line: number;
    column: number;
    phrase: string;
}
/** Where the catalogs live, relative to dist/src/ in the installed package. */
export declare const REFERENCES_DIR: string;
/** The compiled entries for one language tag; a missing or unreadable file gives none. */
export declare function loadCatalog(tag: string, dir?: string): RegExp[];
/** The masked text with quoted spans and dialogue lines blanked (same length). */
export declare function exempt(doc: Doc): string;
/** Catalog hits in a document, in reading order. */
export declare function scanCatalog(doc: Doc, tag: string, dir?: string): CatalogHit[];
