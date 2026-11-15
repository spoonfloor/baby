import { describe, expect, it } from 'vitest';
import {
	blend,
	CLUSTER_WORDS,
	DECADES,
	contrast,
	cssTime,
	END,
	settle,
	spring,
	springStep,
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

describe('toCluster', () => {
	it('shows the likeliest words, likeliest first, the likeliest full size', () => {
		const balls = toCluster({ guesses: guesses(300), picked: 'w0' }, false, sizes);

		expect(balls).toHaveLength(CLUSTER_WORDS);
		expect(balls[0]).toMatchObject({ word: 'w0', weight: 1, radius: 38 });
		const chances = balls.map(({ chance }) => chance);
		expect(chances).toEqual([...chances].sort((a, b) => b - a));
	});

	it('lights the word picked, keeping it in the cluster even as a long shot', () => {
		const balls = toCluster({ guesses: guesses(300), picked: 'w250' }, false, sizes);

		expect(balls).toHaveLength(CLUSTER_WORDS);
		expect(balls.filter(({ lit }) => lit).map(({ word }) => word)).toEqual(['w250']);
		expect(balls.at(-1)?.word).toBe('w250');
	});

	it('lights the end where the reply ended, and nothing while it’s still being picked', () => {
		const lit = (ended: boolean) =>
			toCluster({ guesses: guesses(10) }, ended, sizes)
				.filter(({ lit }) => lit)
				.map(({ word }) => word);

		expect(lit(true)).toEqual([END]);
		expect(lit(false)).toEqual([]);
	});

	it('folds every marker into one end ball, with their chances added up', () => {
		const all = [...guesses(100), { word: '[YOU]', chance: 0.01 }];
		const chance = (word: string) => all.find((guess) => guess.word === word)?.chance ?? 0;
		const balls = toCluster({ guesses: all }, false, sizes);

		expect(balls.filter(({ word }) => word.startsWith('['))).toEqual([
			expect.objectContaining({ word: END, chance: chance('[EOS]') + chance('[YOU]') })
		]);
	});

	it('sizes every ball against the likeliest, the end included', () => {
		const balls = toCluster({ guesses: guesses(10, '[EOS]') }, false, sizes);
		const [end, likeliest] = balls;

		expect(end).toMatchObject({ word: END, weight: 1, radius: 38 });
		expect(likeliest?.weight).toBeLessThan(1);
	});

	it('sizes on a log scale, down to the smallest ball `decades` factors of ten below the likeliest', () => {
		const balls = toCluster(
			{
				guesses: [
					{ word: 'a', chance: 0.5 },
					{ word: 'b', chance: 0.5 / 10 ** (DECADES / 2) },
					{ word: 'c', chance: 0.5 / 10 ** (DECADES + 1) }
				]
			},
			false,
			sizes
		);

		expect(balls.map(({ weight }) => weight)).toEqual([1, expect.closeTo(0.5), 0]);
		expect(balls.at(-1)?.radius).toBe(4);
	});
});

describe('settle', () => {
	const balls = toCluster({ guesses: guesses(300), picked: 'w0' }, false, sizes);
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

describe('cssTime', () => {
	it('reads milliseconds and seconds, as written or minified', () => {
		expect(cssTime('350ms')).toBe(350);
		expect(cssTime('.35s')).toBeCloseTo(350);
		expect(cssTime(' 0.4s ')).toBeCloseTo(400);
	});

	it('refuses anything else', () => {
		expect(() => cssTime('350')).toThrow(SyntaxError);
		expect(() => cssTime('')).toThrow(SyntaxError);
	});
});

describe('springStep', () => {
	const run = (dampingRatio: number, velocity = 0) => {
		const settings = spring(350, dampingRatio);
		let state: [number, number] = [0, velocity];
		let furthest = 0;
		for (let frame = 0; frame < 120; frame++) {
			state = springStep(...state, 100, 1 / 60, settings);
			furthest = Math.max(furthest, state[0]);
		}
		return { end: state, furthest };
	};

	it('comes to rest on its target', () => {
		const { end } = run(0.8);
		expect(end[0]).toBeCloseTo(100, 1);
		expect(end[1]).toBeCloseTo(0, 1);
	});

	it('overshoots a little when underdamped, never when critically damped', () => {
		expect(run(0.8).furthest).toBeGreaterThan(100);
		expect(run(1).furthest).toBeLessThanOrEqual(100.001);
	});

	it('carries on what it was doing: a value already moving away swings out first', () => {
		const [value] = springStep(0, -500, 100, 1 / 60, spring(350, 0.8));
		expect(value).toBeLessThan(0);
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
