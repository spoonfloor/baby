import { lookup as dnsLookup, type LookupAddress, type LookupOptions } from 'node:dns';
import type { IncomingMessage } from 'node:http';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { BlockList, isIP } from 'node:net';
import type { Readable } from 'node:stream';
import { createBrotliDecompress, createGunzip, createInflate } from 'node:zlib';

/**
 * Fetches a public web page or feed for the app, which browsers won’t let it fetch
 * itself (CORS). It only fetches: the app turns what comes back into text. It only
 * reaches public addresses, checked on every redirect and at the moment of
 * connecting, so a name that resolves somewhere private can’t slip through.
 */

export interface FetchOptions {
	/** Largest page accepted, in bytes, after decompressing. */
	maxBytes: number;
	/** How long the whole fetch may take, redirects included. */
	timeoutMs: number;
	/** Whether the server may connect to `address`; only public addresses, unless a test says otherwise. */
	allowAddress?: (address: string) => boolean;
}

export interface Fetched {
	/** Where the page ended up, after redirects. */
	url: string;
	contentType: string;
	body: Buffer;
}

/** Why a fetch failed, as the status the save server answers with. */
export class FetchError extends Error {
	readonly status: number;

	constructor(status: number, message: string) {
		super(message);
		this.status = status;
	}
}

const MAX_REDIRECTS = 5;

/** What the app can turn into text: pages, feeds, plain text. */
const READABLE_TYPES =
	/^(text\/(html|plain|xml)|application\/(xhtml\+xml|xml|rss\+xml|atom\+xml))$/;

/** A generic client name: nothing about who is reading. */
const USER_AGENT = 'Mozilla/5.0 (compatible; BabyReader/1.0)';

const PRIVATE = new BlockList();
for (const [network, prefix] of [
	['0.0.0.0', 8],
	['10.0.0.0', 8],
	['100.64.0.0', 10],
	['127.0.0.0', 8],
	['169.254.0.0', 16],
	['172.16.0.0', 12],
	['192.0.0.0', 24],
	['192.168.0.0', 16],
	['198.18.0.0', 15],
	['224.0.0.0', 4],
	['240.0.0.0', 4]
] as const) {
	PRIVATE.addSubnet(network, prefix, 'ipv4');
}
for (const [network, prefix] of [
	['::', 128],
	['::1', 128],
	['fc00::', 7],
	['fe80::', 10],
	['ff00::', 8]
] as const) {
	PRIVATE.addSubnet(network, prefix, 'ipv6');
}

/** Whether `address` (an IP) is on the public internet. */
export function isPublicAddress(address: string): boolean {
	const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address)?.[1];
	if (mapped) return isPublicAddress(mapped);
	const family = isIP(address);
	if (family === 0) return false;
	return !PRIVATE.check(address, family === 4 ? 'ipv4' : 'ipv6');
}

/** `typed` as a URL the server may fetch, or a 400. */
export function parseTarget(typed: string | null): URL {
	let url: URL;
	try {
		url = new URL(typed ?? '');
	} catch {
		throw new FetchError(400, 'Not a web address');
	}
	if (url.protocol !== 'http:' && url.protocol !== 'https:') {
		throw new FetchError(400, 'Not a web address');
	}
	if (url.username || url.password) throw new FetchError(400, 'Addresses can’t carry a login');
	return url;
}

export async function fetchPage(
	target: URL,
	{ maxBytes, timeoutMs, allowAddress = isPublicAddress }: FetchOptions
): Promise<Fetched> {
	const signal = AbortSignal.timeout(timeoutMs);
	let url = target;
	for (let redirects = 0; ; redirects++) {
		const response = await get(url, allowAddress, signal);
		const location = response.headers.location;
		if (
			response.statusCode !== undefined &&
			response.statusCode >= 300 &&
			response.statusCode < 400 &&
			location
		) {
			response.resume();
			if (redirects === MAX_REDIRECTS) throw new FetchError(502, 'Too many redirects');
			url = parseTarget(new URL(location, url).href);
			continue;
		}
		if (response.statusCode !== 200) {
			response.resume();
			throw new FetchError(502, `The site answered ${response.statusCode}`);
		}
		const contentType = response.headers['content-type'] ?? 'text/html';
		const mediaType = contentType.split(';')[0]?.trim().toLowerCase() ?? '';
		if (!READABLE_TYPES.test(mediaType)) {
			response.resume();
			throw new FetchError(415, 'Not a page or a feed');
		}
		const body = await collect(decoded(response), maxBytes, signal);
		return { url: url.href, contentType, body };
	}
}

function get(url: URL, allowAddress: (address: string) => boolean, signal: AbortSignal) {
	const host = url.hostname.replace(/^\[|\]$/g, '');
	if (isIP(host) !== 0 && !allowAddress(host)) {
		return Promise.reject(new FetchError(403, 'Private address'));
	}
	// Checked as the connection is made, so the address used is the address checked.
	const lookup = (
		hostname: string,
		options: LookupOptions,
		callback: (
			error: NodeJS.ErrnoException | null,
			address: string | LookupAddress[],
			family?: number
		) => void
	) => {
		dnsLookup(hostname, { ...options, all: true }, (error, addresses) => {
			if (error) return callback(error, []);
			if (addresses.length === 0 || addresses.some(({ address }) => !allowAddress(address))) {
				return callback(new FetchError(403, 'Private address'), []);
			}
			if (options.all) return callback(null, addresses);
			const [first] = addresses;
			callback(null, first?.address ?? '', first?.family);
		});
	};
	const request = url.protocol === 'https:' ? httpsRequest : httpRequest;
	return new Promise<IncomingMessage>((resolve, reject) => {
		const outgoing = request(url, {
			method: 'GET',
			signal,
			lookup,
			headers: {
				'User-Agent': USER_AGENT,
				Accept:
					'text/html, application/xhtml+xml, application/rss+xml, application/atom+xml, application/xml;q=0.9, text/plain;q=0.8',
				'Accept-Encoding': 'gzip, deflate, br'
			}
		});
		outgoing.on('response', resolve);
		outgoing.on('error', (error) => reject(asFetchError(error, signal)));
		outgoing.end();
	});
}

function decoded(response: IncomingMessage): Readable {
	switch (response.headers['content-encoding']?.trim().toLowerCase()) {
		case 'gzip':
			return response.pipe(createGunzip());
		case 'deflate':
			return response.pipe(createInflate());
		case 'br':
			return response.pipe(createBrotliDecompress());
		default:
			return response;
	}
}

async function collect(stream: Readable, maxBytes: number, signal: AbortSignal): Promise<Buffer> {
	const chunks: Buffer[] = [];
	let size = 0;
	try {
		for await (const chunk of stream as AsyncIterable<Buffer>) {
			size += chunk.length;
			if (size > maxBytes) {
				stream.destroy();
				throw new FetchError(413, 'Too large');
			}
			chunks.push(chunk);
		}
	} catch (error) {
		throw asFetchError(error, signal);
	}
	return Buffer.concat(chunks);
}

function asFetchError(error: unknown, signal: AbortSignal): FetchError {
	if (error instanceof FetchError) return error;
	if (signal.aborted) return new FetchError(504, 'The site took too long');
	return new FetchError(502, 'Couldn’t reach the site');
}
