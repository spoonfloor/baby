import { encodeInfo, INFO_HEADER, preconditionHeaders, VERSION_HEADER } from './serverProtocol.ts';
import { StoreError, type SaveStore, type StoredSave } from './store.ts';

/** Where a save server is and the token that lets this device use it. */
export interface Connection {
	/** The server’s address, without a trailing slash, e.g. https://baby.example.com */
	address: string;
	token: string;
}

/** Saves kept on a save server (see serverProtocol.ts). */
export function serverStore({ address, token }: Connection): SaveStore {
	async function request(path: string, init: RequestInit = {}): Promise<Response> {
		let response: Response;
		try {
			response = await fetch(`${address}/saves${path}`, {
				...init,
				headers: { Authorization: `Bearer ${token}`, ...init.headers }
			});
		} catch {
			throw new StoreError('unreachable', 'Couldn’t reach the server');
		}
		if (response.ok) return response;
		if (response.status === 401) throw new StoreError('unauthorized', 'The token didn’t work');
		if (response.status === 404) throw new StoreError('missing', 'That save is gone');
		if (response.status === 412) {
			throw new StoreError('conflict', 'The save changed since it was last read');
		}
		throw new StoreError('failed', `The server answered ${response.status}`);
	}

	const save = async (response: Response) => ((await response.json()) as { save: StoredSave }).save;
	const path = (id: string) => `/${encodeURIComponent(id)}`;

	return {
		async list() {
			return ((await (await request('')).json()) as { saves: StoredSave[] }).saves;
		},

		async read(id) {
			const response = await request(path(id));
			const version = Number(response.headers.get(VERSION_HEADER));
			return { bytes: new Uint8Array(await response.arrayBuffer()), version };
		},

		async write(info, bytes, expected) {
			return save(
				await request(path(info.id), {
					method: 'PUT',
					body: bytes,
					headers: {
						'Content-Type': 'application/octet-stream',
						[INFO_HEADER]: encodeInfo(info),
						...preconditionHeaders(expected)
					}
				})
			);
		},

		async rename(id, name, expected) {
			return save(
				await request(path(id), {
					method: 'PATCH',
					body: JSON.stringify({ name }),
					headers: { 'Content-Type': 'application/json', ...preconditionHeaders(expected) }
				})
			);
		},

		async remove(id) {
			await request(path(id), { method: 'DELETE' });
		}
	};
}

/**
 * `typed` as a server address: trimmed, https:// added if it has no scheme, and no
 * trailing slash. Undefined if it isn’t one: only https, or http to this machine.
 */
export function normalizeAddress(typed: string): string | undefined {
	const trimmed = typed.trim();
	if (trimmed === '') return undefined;
	let url: URL;
	try {
		url = new URL(/^[a-z]+:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
	} catch {
		return undefined;
	}
	const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
	if (url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) return undefined;
	return `${url.origin}${url.pathname}`.replace(/\/+$/, '');
}
