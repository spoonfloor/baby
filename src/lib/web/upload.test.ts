// @vitest-environment jsdom
import { File as NodeFile } from 'node:buffer';
import { describe, expect, it } from 'vitest';
import { FILES_GROUP, readBroughtSources } from './brought.ts';
import { upload } from './upload.ts';

/** A file as a browser gives one; jsdom’s can’t be read, so Node’s stands in. */
const file = (text: string, name: string, type?: string) =>
	new NodeFile([text], name, type === undefined ? {} : { type }) as unknown as File;

const words = (documents: string[][]) => documents.map((document) => document.join(' '));

describe('upload', () => {
	it('reads a text file a paragraph between blank lines, titled by its name', async () => {
		const notes = file(
			'Frost came early.\nCover the beds.\n\nThen wait.',
			'Notes.txt',
			'text/plain'
		);
		const { sources, unreadable } = await upload([notes]);
		expect(unreadable).toBe(0);
		expect(sources).toHaveLength(1);
		const [source] = sources;
		expect(source?.title).toBe('Notes');
		expect(source?.file).toBe('Notes.txt');
		expect(source?.group).toBe(FILES_GROUP);
		expect(source?.id).toMatch(/^file:[0-9a-f]{32}$/);
		expect(words(source?.documents ?? [])).toEqual([
			'frost came early . cover the beds . [EOS]',
			'then wait . [EOS]'
		]);
	});

	it('reads a saved page as its article, titled by the page', async () => {
		const html =
			'<html><head><title>Why tomatoes split</title></head><body><nav><p>Home</p></nav>' +
			'<article><p>Tomatoes split when rain follows a dry spell.</p></article></body></html>';
		const { sources } = await upload([file(html, 'saved.html', 'text/html')]);
		expect(sources[0]?.title).toBe('Why tomatoes split');
		expect(words(sources[0]?.documents ?? []).join(' ')).toMatch(/^tomatoes split when rain/);
	});

	it('gives the same text the same id, whatever the file is called', async () => {
		const { sources } = await upload([
			file('Same words.', 'a.txt', 'text/plain'),
			file('Same words.', 'b.txt', 'text/plain')
		]);
		expect(sources[0]?.id).toBe(sources[1]?.id);
	});

	it('counts files with nothing to read, and files that aren’t text', async () => {
		const { sources, unreadable } = await upload([
			file('Words.', 'a.txt', 'text/plain'),
			file('  \n ', 'empty.txt', 'text/plain'),
			file('%PDF', 'paper.pdf', 'application/pdf')
		]);
		expect(sources).toHaveLength(1);
		expect(unreadable).toBe(2);
	});
});

describe('readBroughtSources', () => {
	it('lists an uploaded file Baby read elsewhere under Your files', () => {
		const documents = [['words', '.', '[EOS]']];
		expect(
			readBroughtSources([
				{ id: 'file:abc', title: 'Notes', documents },
				{ id: 'web:https://www.example.com/post', title: 'Post', documents },
				{ id: 'greetings' }
			])
		).toEqual([
			{ id: 'file:abc', file: 'Notes', title: 'Notes', group: FILES_GROUP, documents },
			{
				id: 'web:https://www.example.com/post',
				url: 'https://www.example.com/post',
				title: 'Post',
				group: 'example.com',
				documents
			}
		]);
	});
});
