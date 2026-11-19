import type { Expected, SaveInfo } from './store.ts';

/**
 * How the app and a save server (server/save-server.ts) talk, defined once for both.
 *
 *   GET    /saves        → { saves: StoredSave[] }
 *   GET    /saves/:id    → the file; its version in `Baby-Version`
 *   PUT    /saves/:id    → the file as the body, its SaveInfo in `Baby-Info` → { save: StoredSave }
 *   PATCH  /saves/:id    → { name } → { save: StoredSave }
 *   DELETE /saves/:id    → 204
 *   GET    /fetch?url=…  → a public page or feed, as the site sent it; where it ended
 *                          up (after redirects) in `Baby-Url`. If the site wouldn’t
 *                          send it: 424, with why in `Baby-Problem` (see SiteProblem)
 *
 * Every request carries `Authorization: Bearer <token>`. Writes say what they expect
 * to find (see `Expected`) with If-None-Match: * (new), If-Match: * (any), or
 * If-Match: "<version>"; a server that finds otherwise answers 412.
 */

export const INFO_HEADER = 'Baby-Info';
export const VERSION_HEADER = 'Baby-Version';
export const URL_HEADER = 'Baby-Url';
export const FETCH_PATH = '/fetch';
export const PROBLEM_HEADER = 'Baby-Problem';

/**
 * The status the server answers with when the site, not the server, failed. Never a
 * 5xx: proxies in front of a server (like Cloudflare) swap a 502 or 504 for a page of
 * their own without its CORS headers, which the app could only see as no connection.
 */
export const SITE_PROBLEM_STATUS = 424;

/**
 * Why the site wouldn’t send a page, as far as its answer says: it blocks automated
 * readers (403), wants a login (401), is limiting how often it’s read (429), can’t
 * show it where the server is for legal reasons (451), has nothing there (404, 410),
 * took too long, or failed some other way.
 */
export const SITE_PROBLEMS = [
	'blocked',
	'login',
	'limited',
	'legal',
	'missing',
	'slow',
	'failed'
] as const;
export type SiteProblem = (typeof SITE_PROBLEMS)[number];

export function isSiteProblem(value: string | null): value is SiteProblem {
	return (SITE_PROBLEMS as readonly (string | null)[]).includes(value);
}

/** A save id: what `crypto.randomUUID()` makes, and nothing that could leave the saves folder. */
export const SAVE_ID = /^[0-9a-f-]{1,64}$/;

/** `info` as a header value: JSON, base64url, so any name survives the trip in plain ASCII. */
export function encodeInfo(info: SaveInfo): string {
	const bytes = new TextEncoder().encode(JSON.stringify(info));
	return btoa(String.fromCharCode(...bytes))
		.replaceAll('+', '-')
		.replaceAll('/', '_')
		.replace(/=+$/, '');
}

export function decodeInfo(value: string): SaveInfo {
	const base64 = value.replaceAll('-', '+').replaceAll('_', '/');
	const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
	return JSON.parse(new TextDecoder().decode(bytes)) as SaveInfo;
}

/** The precondition headers for `expected`. */
export function preconditionHeaders(expected: Expected): Record<string, string> {
	if (expected === 'new') return { 'If-None-Match': '*' };
	if (expected === 'any') return { 'If-Match': '*' };
	// An entity tag is a quoted string, by HTTP’s syntax.
	// eslint-disable-next-line no-restricted-syntax
	return { 'If-Match': `"${expected.version}"` };
}

/** What a request’s precondition headers expect, or undefined if it sent none. */
export function expectedFrom(
	ifMatch: string | undefined,
	ifNoneMatch: string | undefined
): Expected | undefined {
	if (ifNoneMatch === '*') return 'new';
	if (ifMatch === '*') return 'any';
	const version = ifMatch?.match(/^"(\d+)"$/)?.[1];
	return version === undefined ? undefined : { version: Number(version) };
}
