import { describe, expect, it } from 'vitest';
import type { ReplyStep } from '#lib/baby/index.ts';
import {
	blend,
	CLUSTER_WORDS,
	contrast,
	cubicBezier,
	END,
	settle,
	toCluster,
	type Point
} from './guessMap.ts';

const sizes = { min: 4, max: 38, gap: 2 };

/** Chances that fall off word by word, like Baby’s: a few likely words and a long tail, [EOS] among them. */
function guesses(count: number, first = 'w0') {
	const raw = Array.from({ length: count }, (_, index) => 1 / (index + 1) ** 2);
	const total = raw.reduce((sum, chance) => sum + chance, 0);
	return raw.map((chance, index) => ({
		word: index === 0 ? first : index === 3 ? '[EOS]' : `w${index}`,
		chance: chance / total
	}));
}

/** A reply of `words`, each the likeliest at its step, then the odds it ended on. */
function reply(words: string[]): ReplyStep[] {
	return [
		...words.map((word) => ({ guesses: guesses(300, word), picked: word })),
		{ guesses: guesses(300, '[EOS]') }
	];
}

describe('toCluster', () => {
	it('averages the odds at every word, so they still add up to 1, likeliest first and full size', () => {
		const balls = toCluster(reply(['i', 'want', 'cake']), true, sizes);
		const all = toCluster(reply(['i', 'want', 'cake']), true, { ...sizes, min: 0 });

		expect(balls).toHaveLength(CLUSTER_WORDS);
		expect(balls[0]).toMatchObject({ weight: 1, radius: 38 });
		const chances = balls.map(({ chance }) => chance);
		expect(chances).toEqual([...chances].sort((a, b) => b - a));
		expect(all.reduce((sum, { chance }) => sum + chance, 0)).toBeLessThanOrEqual(1);
	});

	it('lights the reply’s own words, even a long shot, and where it ended', () => {
		const steps = reply(['i', 'want', 'cake']);
		steps[1] = { guesses: guesses(300), picked: 'w250' };
		const balls = toCluster(steps, true, sizes);

		expect(
			balls
				.filter(({ lit }) => lit)
				.map(({ word }) => word)
				.sort()
		).toEqual(['cake', 'i', 'w250', END].sort());
	});

	it('keeps a lit word at the edge of the cluster when a long shot makes room', () => {
		const last = `w${CLUSTER_WORDS - 1}`;
		const steps = [
			{ guesses: guesses(300), picked: last },
			{ guesses: guesses(300), picked: 'w250' }
		];
		const balls = toCluster(steps, false, sizes);

		expect(balls).toHaveLength(CLUSTER_WORDS);
		expect(balls.filter(({ lit }) => lit).map(({ word }) => word)).toEqual([last, 'w250']);
	});

	it('lights no end while the reply is still being said', () => {
		const balls = toCluster([{ guesses: guesses(10) }], false, sizes);
		expect(balls.some(({ lit }) => lit)).toBe(false);
	});

	it('folds every marker into one end ball, with their chances added up', () => {
		const all = [...guesses(100), { word: '[YOU]', chance: 0.01 }];
		const chance = (word: string) => all.find((guess) => guess.word === word)?.chance ?? 0;
		const balls = toCluster([{ guesses: all }], false, sizes);

		expect(balls.filter(({ word }) => word.startsWith('['))).toEqual([
			expect.objectContaining({ word: END, end: true, chance: chance('[EOS]') + chance('[YOU]') })
		]);
	});
});

describe('settle', () => {
	const balls = toCluster(reply(['i', 'want', 'cake']), true, sizes);
	const places = settle(balls, new Map(), sizes.gap);
	const at = (word: string) => {
		const point = places.get(word);
		if (!point) throw new Error(`${word} has no place`);
		return point;
	};
	const distance = (point: Point) => Math.hypot(point.x, point.y);

	it('packs every ball without overlaps', () => {
		for (const [i, a] of balls.entries()) {
			for (const b of balls.slice(i + 1)) {
				const p = at(a.word);
				const q = at(b.word);
				expect(Math.hypot(p.x - q.x, p.y - q.y)).toBeGreaterThan(a.radius + b.radius);
			}
		}
	});

	it('puts the likeliest word nearest the middle', () => {
		const [likeliest, ...rest] = balls;
		if (!likeliest) throw new Error('No balls');
		const nearest = Math.min(...rest.map(({ word }) => distance(at(word))));
		expect(distance(at(likeliest.word))).toBeLessThan(nearest);
	});

	it('settles the same way every time', () => {
		expect(settle(balls, new Map(), sizes.gap)).toEqual(places);
	});

	it('leaves a settled cluster where it is when nothing changes', () => {
		const again = settle(balls, places, sizes.gap);
		for (const { word } of balls) {
			const before = at(word);
			const after = again.get(word);
			if (!after) throw new Error('A ball has no place');
			expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeLessThan(0.5);
		}
	});
});

describe('cubicBezier', () => {
	it('follows a CSS curve from 0 to 1', () => {
		const linear = cubicBezier('cubic-bezier(0, 0, 1, 1)');
		const glide = cubicBezier('cubic-bezier(0.4, 0.4, 0, 1)');

		expect(linear(0.25)).toBeCloseTo(0.25, 4);
		expect(glide(0)).toBe(0);
		expect(glide(1)).toBe(1);
		expect(glide(0.5)).toBeGreaterThan(0.5);
	});

	it('refuses anything else', () => {
		expect(() => cubicBezier('ease-in')).toThrow(SyntaxError);
	});
});

describe('contrast', () => {
	const black = [0, 0, 0] as const;
	const white = [255, 255, 255] as const;

	it('runs from 1 for a color on itself to 21 for black on white', () => {
		expect(contrast(white, white)).toBe(1);
		expect(contrast(black, white)).toBeCloseTo(21);
		expect(contrast(white, black)).toBeCloseTo(21);
	});

	it('measures a faded fill as blended with what’s under it', () => {
		expect(blend(white, black, 0.5)).toEqual([127.5, 127.5, 127.5]);
		expect(blend(white, black, 0)).toEqual(black);
	});
});
