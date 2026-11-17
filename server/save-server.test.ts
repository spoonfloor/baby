import { mkdtemp, rm } from 'node:fs/promises';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { serverStore } from '../src/lib/saves/serverStore.ts';
import type { SaveInfo, SaveStore } from '../src/lib/saves/store.ts';
import { createSaveServer } from './save-server.ts';

const TOKEN = 'a-test-token-that-is-long-enough';
const info = (id: string, name: string): SaveInfo => ({
	id,
	name,
	savedAt: new Date().toISOString(),
	words: 412,
	sources: 3
});
const file = (...numbers: number[]) => new Uint8Array(numbers);

let folder: string;
let close: () => Promise<void>;
let address: string;
let store: SaveStore;

beforeEach(async () => {
	folder = await mkdtemp(join(tmpdir(), 'baby-saves-'));
	const server = createSaveServer({ folder, token: TOKEN, origins: ['https://app.test'] });
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
	address = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
	close = () => new Promise((resolve) => server.close(() => resolve()));
	store = serverStore({ address, token: TOKEN });
});

afterEach(async () => {
	await close();
	await rm(folder, { recursive: true, force: true });
});

describe('save server, through the app’s server store', () => {
	it('keeps, lists, reads, renames and removes saves', async () => {
		const saved = await store.write(info('a1', 'Chatbot 101 done'), file(1, 2, 3), 'new');
		expect(saved).toMatchObject({ id: 'a1', name: 'Chatbot 101 done', version: 1 });

		expect(await store.list()).toEqual([saved]);
		expect(await store.read('a1')).toEqual({ bytes: file(1, 2, 3), version: 1 });

		const renamed = await store.rename('a1', 'Greetings “and” more', { version: 1 });
		expect(renamed).toMatchObject({ name: 'Greetings “and” more', version: 2 });

		await store.remove('a1');
		expect(await store.list()).toEqual([]);
		await expect(store.read('a1')).rejects.toMatchObject({ kind: 'missing' });
	});

	it('refuses a write over a save that changed since it was read', async () => {
		await store.write(info('a1', 'Mine'), file(1), 'new');
		await store.write(info('a1', 'Mine'), file(2), { version: 1 });

		await expect(store.write(info('a1', 'Mine'), file(3), { version: 1 })).rejects.toMatchObject({
			kind: 'conflict'
		});
		await expect(store.write(info('a1', 'Mine'), file(3), 'new')).rejects.toMatchObject({
			kind: 'conflict'
		});
		expect(await store.write(info('a1', 'Mine'), file(3), 'any')).toMatchObject({ version: 3 });
		expect((await store.read('a1')).bytes).toEqual(file(3));
	});

	it('refuses a wrong token, and an unreachable server is said to be one', async () => {
		const wrong = serverStore({ address, token: 'not-the-right-token-at-all' });
		await expect(wrong.list()).rejects.toMatchObject({ kind: 'unauthorized' });

		await close();
		await expect(store.list()).rejects.toMatchObject({ kind: 'unreachable' });
		close = async () => {};
	});

	it('lets allowed pages call it from the browser', async () => {
		const preflight = await fetch(`${address}/saves/a1`, {
			method: 'OPTIONS',
			headers: { Origin: 'https://app.test', 'Access-Control-Request-Method': 'PUT' }
		});
		expect(preflight.status).toBe(204);
		expect(preflight.headers.get('access-control-allow-origin')).toBe('https://app.test');
		expect(preflight.headers.get('access-control-allow-headers')).toContain('Baby-Info');

		const other = await fetch(`${address}/saves`, { headers: { Origin: 'https://evil.test' } });
		expect(other.headers.get('access-control-allow-origin')).toBeNull();
	});

	it('never serves a path outside its folder', async () => {
		const response = await fetch(`${address}/saves/..%2F..%2Fetc%2Fpasswd`, {
			headers: { Authorization: `Bearer ${TOKEN}` }
		});
		expect(response.status).toBe(404);
	});
});
