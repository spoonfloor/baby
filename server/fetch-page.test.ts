import { mkdtemp, rm } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fetchThroughServer } from '../src/lib/web/fetchThroughServer.ts';
import { isPublicAddress } from './fetch-page.ts';
import { createSaveServer, type SaveServerOptions } from './save-server.ts';

const TOKEN = 'a-test-token-that-is-long-enough';

let folder: string;
let site: string;
const servers: Server[] = [];

async function listen(server: Server): Promise<string> {
	servers.push(server);
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
	return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

/** A save server; it may fetch from this machine unless `fetching` says otherwise. */
function saveServer(fetching: SaveServerOptions['fetching'] = { allowAddress: () => true }) {
	return listen(createSaveServer({ folder, token: TOKEN, origins: ['*'], fetching }));
}

beforeEach(async () => {
	folder = await mkdtemp(join(tmpdir(), 'baby-fetch-'));
	site = await listen(
		createServer((request, response) => {
			switch (request.url) {
				case '/post':
					response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
					response.end('<p>Tomatoes split after rain.</p>');
					return;
				case '/old':
					response.writeHead(301, { Location: '/post' });
					response.end();
					return;
				case '/zipped':
					response.writeHead(200, { 'Content-Type': 'text/plain', 'Content-Encoding': 'gzip' });
					response.end(gzipSync('Hello there.'));
					return;
				case '/photo':
					response.writeHead(200, { 'Content-Type': 'image/png' });
					response.end(Buffer.alloc(10));
					return;
				case '/blocked':
					response.writeHead(403);
					response.end();
					return;
				case '/login':
					response.writeHead(401);
					response.end();
					return;
				case '/limited':
					response.writeHead(429);
					response.end();
					return;
				case '/legal':
					response.writeHead(451);
					response.end();
					return;
				case '/broken':
					response.writeHead(503);
					response.end();
					return;
				case '/big':
					response.writeHead(200, { 'Content-Type': 'text/plain' });
					response.end('x'.repeat(2000));
					return;
				default:
					response.writeHead(404);
					response.end();
			}
		})
	);
});

afterEach(async () => {
	await Promise.all(
		servers.splice(0).map((server) => new Promise((resolve) => server.close(resolve)))
	);
	await rm(folder, { recursive: true, force: true });
});

describe('fetching pages through the save server', () => {
	it('fetches a page, following redirects and saying where it ended up', async () => {
		const connection = { address: await saveServer(), token: TOKEN };
		const page = await fetchThroughServer(connection, `${site}/old`);
		expect(page).toEqual({
			url: `${site}/post`,
			contentType: 'text/html; charset=utf-8',
			text: '<p>Tomatoes split after rain.</p>'
		});
		expect((await fetchThroughServer(connection, `${site}/zipped`)).text).toBe('Hello there.');
	});

	it('says why a page couldn’t be fetched', async () => {
		const address = await saveServer({ allowAddress: () => true, maxBytes: 1000 });
		const problem = (url: string, token = TOKEN) =>
			fetchThroughServer({ address, token }, url).catch((error: unknown) => error);

		expect(await problem(`${site}/photo`)).toMatchObject({ problem: 'type' });
		expect(await problem(`${site}/missing`)).toMatchObject({ problem: 'missing' });
		for (const refusal of ['blocked', 'login', 'limited', 'legal']) {
			expect(await problem(`${site}/${refusal}`)).toMatchObject({ problem: refusal });
		}
		expect(await problem(`${site}/broken`)).toMatchObject({ problem: 'failed' });
		expect(await problem(`${site}/big`)).toMatchObject({ problem: 'large' });
		expect(await problem('file:///etc/passwd')).toMatchObject({ problem: 'address' });
		expect(await problem(`${site}/post`, 'not-the-right-token-at-all')).toMatchObject({
			problem: 'unauthorized'
		});
	});

	it('never fetches from a private address', async () => {
		const connection = { address: await saveServer({}), token: TOKEN };
		await expect(fetchThroughServer(connection, `${site}/post`)).rejects.toMatchObject({
			problem: 'private'
		});
		await expect(fetchThroughServer(connection, 'http://localhost:1/')).rejects.toMatchObject({
			problem: 'private'
		});
	});
});

describe('isPublicAddress', () => {
	it('allows the public internet and nothing else', () => {
		expect(isPublicAddress('93.184.216.34')).toBe(true);
		expect(isPublicAddress('2606:2800:220:1::1')).toBe(true);
		for (const address of [
			'127.0.0.1',
			'10.1.2.3',
			'172.20.0.1',
			'192.168.1.1',
			'169.254.169.254',
			'100.64.0.1',
			'0.0.0.0',
			'::1',
			'fd00::1',
			'fe80::1',
			'::ffff:127.0.0.1',
			'not an address'
		]) {
			expect(isPublicAddress(address), address).toBe(false);
		}
	});
});
