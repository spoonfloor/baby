import { proseDocuments } from '#lib/baby/reading.ts';
import { fileSourceId, FILES_GROUP, type FileSource } from './brought.ts';
import { plainParagraphs, readPage } from './extract.ts';
import { savedFile, SavedPageError } from './savedPage.ts';

/**
 * Upload text files: files from the user’s device, each read the way Read from URL
 * reads a page, a saved web page as its article and a text file as its paragraphs.
 */

/** What the file picker offers. */
export const UPLOAD_ACCEPT = '.txt,.html,.htm,.xhtml,text/plain,text/html';

/** The files that became sources, and how many had nothing to read in them. */
export interface Uploaded {
	sources: FileSource[];
	unreadable: number;
}

export async function upload(files: readonly File[]): Promise<Uploaded> {
	const read = await Promise.all(
		files.map((file) =>
			fileSource(file).catch((error: unknown) => {
				if (error instanceof SavedPageError) return undefined;
				throw error;
			})
		)
	);
	const sources = read.filter((source) => source !== undefined);
	return { sources, unreadable: files.length - sources.length };
}

/** `file` as a source, or undefined if it has no text to read; throws if it isn’t a page or text. */
async function fileSource(file: File): Promise<FileSource | undefined> {
	const { contentType, text } = await savedFile(file);
	const page = contentType === 'text/html' ? readPage(text) : undefined;
	const paragraphs = page?.paragraphs ?? plainParagraphs(text);
	if (paragraphs.length === 0) return undefined;
	const documents = proseDocuments(paragraphs);
	return {
		id: await fileSourceId(paragraphs.join('\n\n')),
		file: file.name,
		title: page?.title || file.name.replace(/\.[^.]+$/, ''),
		group: FILES_GROUP,
		documents
	};
}
