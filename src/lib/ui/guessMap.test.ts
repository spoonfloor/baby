import { describe, expect, it } from 'vitest';
import {
	blend,
	contrast,
	cubicBezier,
	END,
	MAP_WORDS,
	settle,
	toBalls,
	type Point
} from './guessMap.ts';

const sizes = { min: 4, max: 38, gap: 2 };

/** Chances that fall off word by word, like Baby’s: a few likely words and a long tail. */
function guesses(count: number) {
	const raw = Array.from({ length: count }, (_, index) => 1 / (index + 1) ** 2);
	const total = raw.reduce((sum, chance) => sum + chance, 0);
	return raw.map((chance, index) => ({
		word: index === 3 ? '[EOS]' : `w${index}`,
		chance: chance / total
	}));
}

const distance = (point: Point | undefined) => (point ? Math.hypot(point.x, point.y) : Infinity);

describe('toBalls', () => {
	it('keeps the likeliest words, likeliest first and full size, area following chance', () => {
		const balls = toBalls(guesses(100), sizes);

		expect(balls).toHaveLength(MAP_WORDS);
		expect(balls[0]).toMatchObject({ word: 'w0', weight: 1, radius: 38, end: false });
		expect(balls[1]?.weight).toBeCloseTo(Math.sqrt(1 / 4));
	});

	it('folds every marker into one end ball, with their chances added up', () => {
		const all = [...guesses(100), { word: '[YOU]', chance: 0.01 }];
		const chance = (word: string) => all.find((guess) => guess.word === word)?.chance ?? 0;
		const balls = toBalls(all, sizes);

		expect(balls.filter(({ word }) => word.startsWith('['))).toEqual([
			expect.objectContaining({ word: END, end: true, chance: chance('[EOS]') + chance('[YOU]') })
		]);
	});
});

describe('settle', () => {
	const balls = toBalls(guesses(40), sizes);
	const places = settle(balls, new Map(), sizes.gap);

	it('packs every ball without overlaps', () => {
		for (const [i, a] of balls.entries()) {
			for (const b of balls.slice(i + 1)) {
				const p = places.get(a.word);
				const q = places.get(b.word);
				if (!p || !q) throw new Error('A ball has no place');
				expect(Math.hypot(p.x - q.x, p.y - q.y)).toBeGreaterThan(a.radius + b.radius);
			}
		}
	});

	it('puts the likeliest word nearest the middle', () => {
		const nearest = Math.min(...balls.slice(1).map(({ word }) => distance(places.get(word))));
		expect(distance(places.get('w0'))).toBeLessThan(nearest);
	});

	it('settles the same way every time', () => {
		expect(settle(balls, new Map(), sizes.gap)).toEqual(places);
	});

	it('leaves a settled map where it is when nothing changes', () => {
		const again = settle(balls, places, sizes.gap);
		for (const { word } of balls) {
			const before = places.get(word);
			const after = again.get(word);
			if (!before || !after) throw new Error('A ball has no place');
			expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeLessThan(0.1);
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
