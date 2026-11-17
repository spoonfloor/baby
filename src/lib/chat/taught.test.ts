import { describe, expect, it } from 'vitest';
import type { ReadSource } from '#lib/baby/index.ts';
import { countReplies, TAUGHT_SOURCE, taughtDays } from './taught.ts';

const now = new Date(2026, 10, 17, 15);

function taught(n: number, at: Date | undefined, words = ['hi']): ReadSource {
	return {
		id: `${TAUGHT_SOURCE}${n}`,
		...(at && { at: at.getTime() }),
		documents: [['[YOU]', ...words, '[EOS]', '[BABY]', 'hello', '[EOS]']]
	};
}

describe('taughtDays', () => {
	it('groups replies by local day, newest day first and oldest reply first within one', () => {
		const days = taughtDays(
			[
				taught(1, new Date(2026, 10, 9, 23, 59), ['early']),
				taught(2, new Date(2026, 10, 17, 9), ['morning']),
				taught(3, new Date(2026, 10, 16, 0, 0)),
				taught(4, new Date(2026, 10, 17, 1), ['night'])
			],
			now
		);
		expect(days.map(({ label }) => label)).toEqual(['Today', 'Yesterday', 'Nov 9']);
		expect(days[0]?.documents.map((document) => document[1])).toEqual(['night', 'morning']);
		expect(days.map(({ title }) => title)).toEqual([
			'Your replies today',
			'Your replies yesterday',
			'Your replies on Nov 9'
		]);
		expect(new Set(days.map(({ id }) => id)).size).toBe(3);
	});

	it('names the year only when it isn’t this one', () => {
		const [day] = taughtDays([taught(1, new Date(2025, 11, 31))], now);
		expect(day?.label).toBe('Dec 31, 2025');
	});

	it('leaves out primers and replies kept without their text or time', () => {
		const undated = taught(1, undefined);
		const textless: ReadSource = { id: `${TAUGHT_SOURCE}2`, at: now.getTime() };
		const primer: ReadSource = { id: 'greetings', at: now.getTime(), documents: [['hi']] };
		expect(taughtDays([undated, textless, primer], now)).toEqual([]);
	});
});

describe('countReplies', () => {
	it('counts one reply and many', () => {
		expect(countReplies(1)).toBe('1 reply');
		expect(countReplies(4)).toBe('4 replies');
	});
});
