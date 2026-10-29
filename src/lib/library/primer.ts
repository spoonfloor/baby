import type { Document } from '#lib/baby/index.ts';
import { parseScripts } from '#lib/baby/script.ts';

/** Something we supply for Baby to read in one sitting, as opposed to a source the user brings. */
export interface Primer {
	id: string;
	title: string;
	/** The exact tokens Baby trains on, also what the preview shows. */
	documents: Document[];
}

/** Primers under one name in the sources panel: Chatbot 101, or a subject. */
export interface Group {
	title: string;
	primers: Primer[];
}

/** A primer of conversation scripts (see `parseScripts` for the format). */
export function scriptPrimer(id: string, title: string, source: string): Primer {
	return { id, title, documents: parseScripts(source) };
}
