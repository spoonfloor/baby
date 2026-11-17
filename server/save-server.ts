import { timingSafeEqual } from 'node:crypto';
import { mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { join } from 'node:path';
import {
	decodeInfo,
	expectedFrom,
	INFO_HEADER,
	SAVE_ID,
	VERSION_HEADER
} from '../src/lib/saves/serverProtocol.ts';
import { meets, newestFirst, type StoredSave } from '../src/lib/saves/store.ts';

/**
 * A save server: keeps saved models in a folder and serves them to anyone holding
 * its token (see src/lib/saves/serverProtocol.ts). It stores files without looking
 * inside them. Each save is two files: `<id>.baby` and `<id>.json`, its information.
 */

export interface SaveServerOptions {
	/** The folder saves are kept in; created if missing. */
	folder: string;
	token: string;
	/** Origins whose pages may call the server; `*` for any (the token guards it either way). */
	origins: string[];
	/** Largest file accepted, in bytes. */
	maxBytes?: number;
}

const DEFAULT_MAX_BYTES = 64 * 1024 * 1024;

class HttpError extends Error {
	readonly status: number;

	constructor(status: number, message: string) {
		super(message);
		this.status = status;
	}
}

export function createSaveServer({
	folder,
	token,
	origins,
	maxBytes = DEFAULT_MAX_BYTES
}: SaveServerOptions): Server {
	if (token.length < 16) throw new Error('The token must be at least 16 characters');
	const expectedAuth = Buffer.from(`Bearer ${token}`);
	const ready = mkdir(folder, { recursive: true });
	/** Writes run one at a time, so checking a version and writing it can’t interleave. */
	let writing: Promise<unknown> = Promise.resolve();
	const exclusively = <T>(work: () => Promise<T>): Promise<T> => {
		const run = writing.then(work);
		writing = run.catch(() => {});
		return run;
	};

	const infoPath = (id: string) => join(folder, `${id}.json`);
	const filePath = (id: string) => join(folder, `${id}.baby`);

	async function readInfo(id: string): Promise<StoredSave | undefined> {
		try {
			return JSON.parse(await readFile(infoPath(id), 'utf8')) as StoredSave;
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
			throw error;
		}
	}

	/** Writes `data` to `path` all at once: a reader sees the old file or the new one, never half. */
	async function writeAtomically(path: string, data: string | Uint8Array) {
		const temporary = `${path}.${process.pid}.tmp`;
		await writeFile(temporary, data);
		await rename(temporary, path);
	}

	function authorized(request: IncomingMessage): boolean {
		const given = Buffer.from(request.headers.authorization ?? '');
		return given.length === expectedAuth.length && timingSafeEqual(given, expectedAuth);
	}

	async function body(request: IncomingMessage): Promise<Buffer> {
		const chunks: Buffer[] = [];
		let size = 0;
		for await (const chunk of request as AsyncIterable<Buffer>) {
			size += chunk.length;
			if (size > maxBytes) throw new HttpError(413, 'Too large');
			chunks.push(chunk);
		}
		return Buffer.concat(chunks);
	}

	function expected(request: IncomingMessage) {
		const header = (name: string) => {
			const value = request.headers[name];
			return Array.isArray(value) ? value[0] : value;
		};
		const found = expectedFrom(header('if-match'), header('if-none-match'));
		if (!found) throw new HttpError(428, 'Say what you expect with If-Match or If-None-Match');
		return found;
	}

	function json(response: ServerResponse, value: unknown) {
		response.writeHead(200, { 'Content-Type': 'application/json' });
		response.end(JSON.stringify(value));
	}

	async function handle(request: IncomingMessage, response: ServerResponse) {
		await ready;
		const { pathname } = new URL(request.url ?? '/', 'http://server');
		const [, collection, id, ...rest] = pathname.split('/');
		if (collection !== 'saves' || rest.length > 0) throw new HttpError(404, 'Not found');
		if (!authorized(request)) throw new HttpError(401, 'Unauthorized');

		if (id === undefined || id === '') {
			if (request.method !== 'GET') throw new HttpError(405, 'Method not allowed');
			const names = await readdir(folder);
			const saves = await Promise.all(
				names
					.filter((name) => name.endsWith('.json'))
					.map((name) => readInfo(name.slice(0, -'.json'.length)))
			);
			json(response, { saves: newestFirst(saves.filter((save) => save !== undefined)) });
			return;
		}
		if (!SAVE_ID.test(id)) throw new HttpError(404, 'Not found');

		switch (request.method) {
			case 'GET': {
				const info = await readInfo(id);
				if (!info) throw new HttpError(404, 'Not found');
				const file = await readFile(filePath(id));
				response.writeHead(200, {
					'Content-Type': 'application/octet-stream',
					[VERSION_HEADER]: String(info.version)
				});
				response.end(file);
				return;
			}
			case 'PUT': {
				const wanted = expected(request);
				const infoHeader = request.headers[INFO_HEADER.toLowerCase()];
				if (typeof infoHeader !== 'string') throw new HttpError(400, `Missing ${INFO_HEADER}`);
				const { name, savedAt, words, sources } = decodeInfo(infoHeader);
				const file = await body(request);
				const save = await exclusively(async () => {
					const found = await readInfo(id);
					if (!meets(wanted, found?.version)) throw new HttpError(412, 'Changed elsewhere');
					const stored: StoredSave = {
						id,
						name,
						savedAt,
						words,
						sources,
						version: (found?.version ?? 0) + 1
					};
					await writeAtomically(filePath(id), file);
					await writeAtomically(infoPath(id), JSON.stringify(stored));
					return stored;
				});
				json(response, { save });
				return;
			}
			case 'PATCH': {
				const wanted = expected(request);
				const { name } = JSON.parse((await body(request)).toString('utf8')) as { name: unknown };
				if (typeof name !== 'string' || name.trim() === '') {
					throw new HttpError(400, 'A save needs a name');
				}
				const save = await exclusively(async () => {
					const found = await readInfo(id);
					if (!found) throw new HttpError(404, 'Not found');
					if (!meets(wanted, found.version)) throw new HttpError(412, 'Changed elsewhere');
					const stored: StoredSave = { ...found, name, version: found.version + 1 };
					await writeAtomically(infoPath(id), JSON.stringify(stored));
					return stored;
				});
				json(response, { save });
				return;
			}
			case 'DELETE': {
				await exclusively(async () => {
					await rm(infoPath(id), { force: true });
					await rm(filePath(id), { force: true });
				});
				response.writeHead(204).end();
				return;
			}
			default:
				throw new HttpError(405, 'Method not allowed');
		}
	}

	return createServer((request, response) => {
		const origin = request.headers.origin;
		if (origin && (origins.includes('*') || origins.includes(origin))) {
			response.setHeader('Access-Control-Allow-Origin', origins.includes('*') ? '*' : origin);
			response.setHeader('Vary', 'Origin');
			response.setHeader('Access-Control-Expose-Headers', VERSION_HEADER);
		}
		if (request.method === 'OPTIONS') {
			response.setHeader('Access-Control-Allow-Methods', 'GET, PUT, PATCH, DELETE');
			response.setHeader(
				'Access-Control-Allow-Headers',
				`Authorization, Content-Type, If-Match, If-None-Match, ${INFO_HEADER}`
			);
			response.setHeader('Access-Control-Max-Age', '86400');
			response.writeHead(204).end();
			return;
		}
		handle(request, response).catch((error: unknown) => {
			const status = error instanceof HttpError ? error.status : 500;
			if (status === 500) console.error(error);
			if (!response.headersSent) response.writeHead(status, { 'Content-Type': 'text/plain' });
			response.end(error instanceof HttpError ? error.message : 'Server error');
		});
	});
}
