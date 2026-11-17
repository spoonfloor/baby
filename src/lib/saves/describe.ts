import { count } from '#lib/baby/reading.ts';
import { StoreError, type StoredSave } from './store.ts';

/** “412 words · 3 sources · today”: a save at a glance. */
export function describeSave(save: StoredSave, now = new Date()): string {
	const saved = new Date(save.savedAt);
	const day =
		saved.toDateString() === now.toDateString()
			? 'today'
			: saved.toLocaleDateString('en', {
					month: 'short',
					day: 'numeric',
					...(saved.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' })
				});
	return `${count(save.words, 'word')} · ${count(save.sources, 'source')} · ${day}`;
}

/** What went wrong, to show under the action that failed. */
export function problemText(error: unknown, fallback = 'Something went wrong. Try again.'): string {
	if (error instanceof DOMException && error.name === 'QuotaExceededError') {
		return 'This device is out of room for saves. Delete some, or move them to a server.';
	}
	if (!(error instanceof StoreError)) return fallback;
	switch (error.kind) {
		case 'conflict':
			return 'That save changed on another device.';
		case 'missing':
			return 'That save is gone. It may have been deleted on another device.';
		case 'unauthorized':
			return 'The server didn’t accept the token.';
		case 'unreachable':
			return 'Couldn’t reach the server. Check the address and your connection.';
		case 'taken':
			return 'There’s already a save with that name there.';
		case 'address':
			return 'Enter the server’s address, starting with https://.';
		case 'failed':
			return fallback;
	}
}

/** Now, as an ISO date, for when a save is made. */
export function timestamp(): string {
	return new Date().toISOString();
}
