import type { Document, ReadSource } from '#lib/baby/index.ts';
import { count, readingStats } from '#lib/baby/reading.ts';

/** Starts the `source` of every reply the user teaches, so it can be told apart from a primer. */
export const TAUGHT_SOURCE = 'taught:';

/** The replies the user taught on one day, to list and preview as one source. */
export interface TaughtDay {
	/** Unique among days and primers. */
	id: string;
	/** “Today”, “Yesterday”, “Nov 9”, or “Nov 9, 2025” in another year. */
	label: string;
	/** “Your replies today”, “Your replies on Nov 9”. */
	title: string;
	/** Each reply as Baby read it, a `[YOU] … [BABY] …` pair, oldest first. */
	documents: Document[];
}

/**
 * Replies the user taught, by the local day they were taught on, newest day first.
 * Replies taught before Baby kept their text or time are left out: there’s nothing to show.
 */
export function taughtDays(sources: readonly ReadSource[], now: Date): TaughtDay[] {
	const days = new Map<string, TaughtDay>();
	const taught = sources
		.flatMap(({ id, at, documents }) =>
			id.startsWith(TAUGHT_SOURCE) && at !== undefined && documents ? [{ at, documents }] : []
		)
		.sort((a, b) => a.at - b.at);
	for (const { at, documents } of taught) {
		const date = new Date(at);
		const key = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
		let day = days.get(key);
		if (!day) {
			const label = dayLabel(date, now);
			const relative = label === 'Today' || label === 'Yesterday';
			day = {
				id: `taught-day:${key}`,
				label,
				title: `Your replies ${relative ? label.toLowerCase() : `on ${label}`}`,
				documents: []
			};
			days.set(key, day);
		}
		day.documents.push(...documents);
	}
	return [...days.values()].reverse();
}

/** The sources panel’s group for taught replies: a row per day, each read. */
export function repliesGroup(days: readonly TaughtDay[]) {
	return {
		title: 'Your replies',
		tally: countReplies(days.reduce((total, day) => total + day.documents.length, 0)),
		sources: days.map(({ id, label, documents }) => ({
			id,
			title: label,
			read: true,
			note: countReplies(documents.length)
		}))
	};
}

/** “4 replies · 31 words”: a day of taught replies, in its preview. */
export function describeDay({ documents }: TaughtDay): string {
	return `${countReplies(documents.length)} · ${count(readingStats(documents, () => true).words, 'word')}`;
}

/** “1 reply”, “4 replies”. */
export function countReplies(n: number): string {
	return `${n} ${n === 1 ? 'reply' : 'replies'}`;
}

function dayLabel(date: Date, now: Date): string {
	const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
	if (sameDay(date, now)) return 'Today';
	if (sameDay(date, yesterday)) return 'Yesterday';
	return date.toLocaleDateString('en', {
		month: 'short',
		day: 'numeric',
		...(date.getFullYear() !== now.getFullYear() && { year: 'numeric' })
	});
}

function sameDay(a: Date, b: Date): boolean {
	return (
		a.getFullYear() === b.getFullYear() &&
		a.getMonth() === b.getMonth() &&
		a.getDate() === b.getDate()
	);
}
