import { describe, expect, it } from 'vitest';
import {
	blend,
	DECADES,
	contrast,
	cssTime,
	END,
	GRAPH_WORDS,
	layOut,
	settle,
	spring,
	springStep,
	toGraph,
	type Ball,
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

describe('toGraph', () => {
	const graph = (steps: Parameters<typeof toGraph>[0]) => toGraph(steps, sizes);
	const lit = (balls: readonly Ball[] | undefined) =>
		(balls ?? []).filter(({ lit }) => lit).map(({ word }) => word);

	it('has the same words at every step, in the same order', () => {
		const steps = graph([
			{ guesses: guesses(300), picked: 'w0' },
			{ guesses: guesses(300, 'w299'), picked: 'w299' }
		]);
		const words = steps.map((balls) => balls.map(({ word }) => word));

		expect(words[0]).toHaveLength(GRAPH_WORDS);
		expect(words[1]).toEqual(words[0]);
	});

	it('takes every step’s likeliest words in turn, so each step’s likeliest are in', () => {
		// Two steps whose words don’t overlap at all: each gets half.
		const other = guesses(300).map(({ word, chance }) => ({ word: `x${word}`, chance }));
		const [first] = graph([{ guesses: guesses(300) }, { guesses: other }]);
		const words = new Set(first?.map(({ word }) => word));

		expect(words.has('w0') && words.has('xw0')).toBe(true);
		expect(words.has(`w${GRAPH_WORDS / 2 - 1}`)).toBe(true);
		expect(words.has(`w${GRAPH_WORDS / 2}`)).toBe(false);
	});

	it('sizes each step against its own likeliest, on a log scale down to the smallest ball', () => {
		const [balls] = graph([
			{
				guesses: [
					{ word: 'a', chance: 0.5 },
					{ word: 'b', chance: 0.5 / 10 ** (DECADES / 2) },
					{ word: 'c', chance: 0.5 / 10 ** (DECADES + 1) }
				],
				picked: 'a'
			}
		]);

		expect(balls?.map(({ weight }) => weight)).toEqual([1, expect.closeTo(0.5), 0]);
		expect(balls?.at(-1)?.radius).toBe(4);
		expect(balls?.[0]?.radius).toBe(38);
	});

	it('lights the word picked at each step, keeping it in even as a long shot', () => {
		const steps = graph([
			{ guesses: guesses(500), picked: 'w450' },
			{ guesses: guesses(500), picked: 'w0' }
		]);

		expect(steps.map(lit)).toEqual([['w450'], ['w0']]);
	});

	it('lights the end where the reply ended', () => {
		const steps = graph([{ guesses: guesses(10), picked: 'w0' }, { guesses: guesses(10) }]);

		expect(lit(steps[1])).toEqual([END]);
	});

	it('folds every marker into one end ball, with their chances added up', () => {
		const all = [...guesses(100), { word: '[YOU]', chance: 0.01 }];
		const chance = (word: string) => all.find((guess) => guess.word === word)?.chance ?? 0;
		const [balls] = graph([{ guesses: all, picked: 'w0' }]);

		expect(balls?.filter(({ word }) => word.startsWith('['))).toEqual([
			expect.objectContaining({ word: END, chance: chance('[EOS]') + chance('[YOU]') })
		]);
	});

	it('sizes every ball against the likeliest, the end included', () => {
		const [balls] = graph([{ guesses: guesses(10, '[EOS]'), picked: 'w1' }]);
		const end = balls?.find(({ word }) => word === END);
		const likeliest = balls?.find(({ word }) => word === 'w1');

		expect(end).toMatchObject({ weight: 1, radius: 38 });
		expect(likeliest?.weight).toBeLessThan(1);
	});
});

describe('settle', () => {
	const [balls = []] = toGraph([{ guesses: guesses(300), picked: 'w0' }], sizes);
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

describe('layOut', () => {
	const graph = toGraph(
		[
			{ guesses: guesses(300), picked: 'w0' },
			{ guesses: guesses(300, 'w5'), picked: 'w5' },
			{ guesses: guesses(300) }
		],
		sizes
	);

	it('places every ball at every step, the same way every time', () => {
		const steps = [...layOut(graph, sizes.gap)];

		expect(steps).toHaveLength(3);
		for (const places of steps) expect(places.size).toBe(GRAPH_WORDS);
		expect([...layOut(graph, sizes.gap)]).toEqual(steps);
	});

	it('keeps a word that’s big at a later step near the middle from the start', () => {
		// “late” is a long shot at the first step and the likeliest at the second.
		const late = guesses(300).map(({ word, chance }) => ({
			word: word === 'w250' ? 'late' : word,
			chance
		}));
		const first = late;
		const second = guesses(300, 'late');
		const reply = toGraph(
			[
				{ guesses: first, picked: 'w0' },
				{ guesses: second, picked: 'late' }
			],
			sizes
		);
		const [start] = layOut(reply, sizes.gap);
		const away = (word: string) => {
			const point = start?.get(word);
			return point ? Math.hypot(point.x, point.y) : Infinity;
		};
		const neverBig = (reply[0] ?? []).filter(({ peak }) => peak === 0).map(({ word }) => word);

		expect(neverBig.length).toBeGreaterThan(0);
		expect(neverBig.every((word) => away(word) > away('late'))).toBe(true);
	});

	it('starts each step from where the one before it rested', () => {
		const [first] = layOut(graph, sizes.gap);
		const [again] = layOut([graph[0] ?? [], graph[0] ?? []], sizes.gap).drop(1);
		for (const [word, point] of first ?? []) {
			const after = again?.get(word);
			expect(Math.hypot((after?.x ?? 0) - point.x, (after?.y ?? 0) - point.y)).toBeLessThan(0.5);
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
