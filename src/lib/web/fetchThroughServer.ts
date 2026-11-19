import {
	FETCH_PATH,
	isSiteProblem,
	PROBLEM_HEADER,
	SITE_PROBLEM_STATUS,
	URL_HEADER,
	type SiteProblem
} from '#lib/saves/serverProtocol.ts';
import type { Connection } from '#lib/saves/serverStore.ts';

/** Why a page couldn’t be fetched, for the app to explain. */
export type FetchProblem =
	| 'address'
	| 'private'
	| 'unreachable'
	| 'unauthorized'
	/** The server is from before it could fetch pages. */
	| 'outdated'
	/** The site wouldn’t send it, and why. */
	| SiteProblem
	| 'type'
	| 'large'
	/** Anything else. */
	| 'error';

export class FetchProblemError extends Error {
	readonly problem: FetchProblem;

	constructor(problem: FetchProblem, message: string) {
		super(message);
		this.problem = problem;
	}
}

/** A page or feed as the site sent it, decoded to text. */
export interface FetchedText {
	/** Where it ended up, after redirects. */
	url: string;
	contentType: string;
	text: string;
}

const BY_STATUS: Record<number, FetchProblem> = {
	400: 'address',
	401: 'unauthorized',
	403: 'private',
	404: 'outdated',
	413: 'large',
	415: 'type'
};

/** Fetches the public page at `url` through the save server (see serverProtocol.ts). */
export async function fetchThroughServer(
	{ address, token }: Connection,
	url: string
): Promise<FetchedText> {
	let response: Response;
	try {
		response = await fetch(`${address}${FETCH_PATH}?url=${encodeURIComponent(url)}`, {
			headers: { Authorization: `Bearer ${token}` }
		});
	} catch {
		throw new FetchProblemError('unreachable', 'Couldn’t reach the server');
	}
	if (!response.ok) {
		const siteProblem = response.headers.get(PROBLEM_HEADER);
		throw new FetchProblemError(
			response.status === SITE_PROBLEM_STATUS && isSiteProblem(siteProblem)
				? siteProblem
				: (BY_STATUS[response.status] ?? 'error'),
			`The server answered ${response.status}`
		);
	}
	const contentType = response.headers.get('Content-Type') ?? 'text/html';
	const bytes = await response.arrayBuffer();
	return {
		url: response.headers.get(URL_HEADER) ?? url,
		contentType,
		text: decode(bytes, contentType)
	};
}

/** `bytes` as text in the charset `contentType` names, or UTF-8. */
export function decode(bytes: ArrayBuffer, contentType: string): string {
	const named = /charset=([^;]+)/i.exec(contentType)?.[1]?.trim().replace(/^"|"$/g, '');
	try {
		return new TextDecoder(named ?? 'utf-8').decode(bytes);
	} catch {
		return new TextDecoder('utf-8').decode(bytes);
	}
}

/**
 * `typed` as a web address: trimmed, https:// added if it has no scheme. Undefined
 * if it isn’t one.
 */
export function normalizeUrl(typed: string): string | undefined {
	const trimmed = typed.trim();
	if (trimmed === '') return undefined;
	try {
		const url = new URL(/^[a-z]+:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
		if (url.protocol !== 'https:' && url.protocol !== 'http:') return undefined;
		if (!url.hostname.includes('.') && url.hostname !== 'localhost') return undefined;
		return url.href;
	} catch {
		return undefined;
	}
}
