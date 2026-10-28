import type { Document } from '#lib/baby/index.ts';
import { parseScripts } from '#lib/baby/script.ts';

/** Something Baby can read in one sitting, from the + menu. */
export interface Pack {
	id: string;
	title: string;
	/** The exact tokens Baby trains on, also what the preview shows. */
	documents: Document[];
}

/** A group of packs in the + menu. */
export interface Shelf {
	title: string;
	/** Packs are a curriculum, meant to be read in order, so they’re numbered. */
	ordered: boolean;
	packs: Pack[];
}

/** A pack of conversation scripts (see `parseScripts` for the format). */
export function scriptPack(id: string, title: string, source: string): Pack {
	return { id, title, documents: parseScripts(source) };
}
