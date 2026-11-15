import type { Guess, ReplyStep } from '#lib/baby/index.ts';
import { isSpecial } from '#lib/baby/vocabulary.ts';

/**
 * The Graph’s layout: Baby’s odds at one word of its reply as a cluster of balls.
 * Each ball is a word it could have said there, sized by its chance; the word it
 * picked is lit. The likelier a word, the closer to the middle it’s pulled, so the
 * long shots end up at the edge. Where everything comes to rest is worked out here,
 * all at once and the same way every time; the map then glides each ball there.
 */

/** Words in the cluster, at most (the one picked always among them): past this many, the rest are specks. */
export const CLUSTER_WORDS = 150;

/** Every marker Baby could pick ([EOS], or a turn start) as one ball: each would end the reply there. */
export const END = '[end]';

export interface Point {
	x: number;
	y: number;
}

export interface Ball {
	word: string;
	/** Its chance of being picked here. */
	chance: number;
	/** Its chance next to the likeliest word’s, on a log scale (see `DECADES`): 0–1. */
	weight: number;
	radius: number;
	/** The `END` ball: picking it ends the reply. */
	end: boolean;
	/** The word Baby picked here. */
	lit: boolean;
}

/** Ball radii and the space between balls, in pixels at full size. */
export interface Sizes {
	min: number;
	max: number;
	gap: number;
}

/**
 * How many factors of ten less likely than the likeliest word a word can be and still
 * be bigger than the smallest ball. Sizes follow chance on a log scale, so the words
 * Baby could have said but likely won’t stay big enough to read; steep enough that
 * the likeliest stay readable in the map’s small space.
 */
export const DECADES = 2;

/** How much of the cluster’s round outline its packed balls fill. */
const PACKING = 0.7;

/** The guesses as the map shows them: every marker folded into one `END`, likeliest first. */
export function foldEnd(guesses: readonly Guess[]): Guess[] {
	const words = guesses.filter(({ word }) => !isSpecial(word));
	const end = guesses.reduce((sum, { word, chance }) => (isSpecial(word) ? sum + chance : sum), 0);
	if (end > 0) words.push({ word: END, chance: end });
	return words.sort((a, b) => b.chance - a.chance);
}

/**
 * The cluster for one word of a reply: Baby’s odds there (see `foldEnd`). The
 * likeliest `CLUSTER_WORDS` are shown, likeliest first, the word it picked always
 * among them and lit; at a step with nothing picked where the reply has `ended`,
 * Baby picked `END`. Balls are sized against the likeliest word, which is always
 * full size; `END` is no word, so it never shrinks them, and is at most full size
 * itself. Sizes follow chance on a log scale spanning `DECADES`.
 */
export function toCluster(
	{ guesses, picked }: ReplyStep,
	ended: boolean,
	{ min, max }: Sizes
): Ball[] {
	const lit = picked ?? (ended ? END : undefined);
	const all = foldEnd(guesses);
	const shown = all.slice(0, CLUSTER_WORDS);
	const own = all.find(({ word }) => word === lit);
	// The picked word makes the cluster even as a long shot, in the last place.
	if (own && !shown.includes(own)) shown.splice(-1, 1, own);
	const top = all.find(({ word }) => word !== END)?.chance ?? all[0]?.chance ?? 0;
	return shown.map(({ word, chance }) => {
		const weight =
			top > 0 && chance > 0 ? Math.min(1, Math.max(0, 1 + Math.log10(chance / top) / DECADES)) : 0;
		return {
			word,
			chance,
			weight,
			radius: min + (max - min) * weight,
			end: word === END,
			lit: word === lit
		};
	});
}

/** Most steps of the settling simulation: enough for the cluster to come to rest from scratch. */
const STEPS = 1500;
/** Rounds of pushing overlapping balls apart, per step. */
const SEPARATIONS = 3;
/** Every ball’s pull toward the middle: a little for all, so none drift off, plus its chance. */
const PULL_BASE = 0.0006;
const PULL_PER_CHANCE = 0.06;
/** Damping: lively at first, so balls can shove past each other into place, then settling. */
const DAMPING_LIVELY = 0.9;
const DAMPING_SETTLING = 0.75;
const LIVELY_STEPS = 150;
/** At rest: no ball moving faster than this, in pixels per step. */
const REST_SPEED = 0.05;
/** The turn between one new ball and the next as they spiral out: the golden angle. */
const SPIRAL_TURN = Math.PI * (3 - Math.sqrt(5));

interface Body extends Point {
	radius: number;
	/** Its place among all the bodies, so each pair is pushed apart once. */
	index: number;
}

/**
 * Where each ball comes to rest, packed tight around the middle. Balls start where
 * they were (`previous`), so the map only moves as much as the new chances force it
 * to; new balls start spiraling out from the middle, likeliest first, each just
 * outside the area the ones before it fill. No randomness: the same balls from the
 * same places always settle the same way.
 */
export function settle(
	balls: readonly Ball[],
	previous: ReadonlyMap<string, Point>,
	gap: number
): Map<string, Point> {
	let count = 0;
	let filled = 0;
	const bodies = balls.map((ball, index) => {
		const area = (ball.radius + gap / 2) ** 2;
		let start = previous.get(ball.word);
		if (!start) {
			const reach = Math.sqrt((filled + area / 2) / PACKING);
			const angle = count * SPIRAL_TURN;
			start = { x: Math.cos(angle) * reach, y: Math.sin(angle) * reach };
		}
		count++;
		filled += area;
		return {
			radius: ball.radius,
			index,
			x: start.x,
			y: start.y,
			vx: 0,
			vy: 0,
			fromX: start.x,
			fromY: start.y,
			pull: PULL_BASE + ball.chance * PULL_PER_CHANCE
		};
	});

	for (let step = 0; step < STEPS; step++) {
		for (const body of bodies) {
			body.fromX = body.x;
			body.fromY = body.y;
			body.vx -= body.x * body.pull;
			body.vy -= body.y * body.pull;
			body.x += body.vx;
			body.y += body.vy;
		}
		separate(bodies, gap);
		// Speed is how far each ball actually moved, pushes included, so pull and push never fight.
		const damping = step < LIVELY_STEPS ? DAMPING_LIVELY : DAMPING_SETTLING;
		let fastest = 0;
		for (const body of bodies) {
			body.vx = (body.x - body.fromX) * damping;
			body.vy = (body.y - body.fromY) * damping;
			fastest = Math.max(fastest, Math.hypot(body.vx, body.vy));
		}
		if (fastest < REST_SPEED) break;
	}

	return new Map(bodies.map(({ x, y }, index) => [balls[index]?.word ?? '', { x, y }]));
}

/**
 * Pushes every overlapping pair apart along the line between them, each by half the
 * overlap. Only neighbors can overlap, so balls are sorted into a grid sized for the
 * small ones, and each checks only the cells near enough to reach: a big ball checks
 * further out, while the few big ones check each other directly.
 */
function separate(bodies: Body[], gap: number) {
	const radii = bodies.map(({ radius }) => radius).sort((a, b) => a - b);
	// Small: the smallest nine in ten. A cell fits two of the biggest of those side by side.
	const smallest = radii[Math.floor(radii.length * 0.9)] ?? 0;
	const cell = 2 * smallest + gap;
	const small = bodies.filter(({ radius }) => radius <= smallest);
	const big = bodies.filter(({ radius }) => radius > smallest);

	for (let round = 0; round < SEPARATIONS; round++) {
		const grid = new Map<number, Body[]>();
		for (const body of small) {
			const key = cellKey(Math.floor(body.x / cell), Math.floor(body.y / cell));
			const members = grid.get(key);
			if (members) members.push(body);
			else grid.set(key, [body]);
		}
		for (const a of bodies) {
			const cx = Math.floor(a.x / cell);
			const cy = Math.floor(a.y / cell);
			const range = Math.ceil((a.radius + smallest + gap) / cell);
			for (let dx = -range; dx <= range; dx++) {
				for (let dy = -range; dy <= range; dy++) {
					for (const b of grid.get(cellKey(cx + dx, cy + dy)) ?? []) {
						// Each small pair once, from the earlier of the two; a big ball meets each small one once.
						if (b.index > a.index || a.radius > smallest) pushApart(a, b, gap);
					}
				}
			}
		}
		for (let i = 0; i < big.length; i++) {
			const a = big[i];
			if (!a) continue;
			for (let j = i + 1; j < big.length; j++) {
				const b = big[j];
				if (b) pushApart(a, b, gap);
			}
		}
	}
}

/** One number for a grid cell, unique for any cell a field could reach. */
function cellKey(x: number, y: number): number {
	return (x + 50_000) * 100_000 + (y + 50_000);
}

function pushApart(a: Body, b: Body, gap: number) {
	const dx = b.x - a.x;
	const dy = b.y - a.y;
	const reach = a.radius + b.radius + gap;
	const squared = dx * dx + dy * dy;
	if (squared >= reach * reach) return;
	const distance = Math.sqrt(squared) || Number.EPSILON;
	const overlap = reach - distance;
	const nx = dx / distance;
	const ny = dy / distance;
	a.x -= (nx * overlap) / 2;
	a.y -= (ny * overlap) / 2;
	b.x += (nx * overlap) / 2;
	b.y += (ny * overlap) / 2;
}

/**
 * A CSS `cubic-bezier(x1, y1, x2, y2)` as a function of progress (0–1), for gliding
 * on the same curve a stylesheet would.
 */
export function cubicBezier(css: string): (progress: number) => number {
	const numbers = /^cubic-bezier\(([^)]*)\)$/.exec(css.trim())?.[1]?.split(',').map(Number);
	if (numbers?.length !== 4 || numbers.some(Number.isNaN)) {
		throw new SyntaxError(`Not a cubic-bezier: ${css}`);
	}
	const [x1 = 0, y1 = 0, x2 = 1, y2 = 1] = numbers;
	const curve = (a: number, b: number) => (t: number) =>
		3 * a * t * (1 - t) ** 2 + 3 * b * t ** 2 * (1 - t) + t ** 3;
	const x = curve(x1, x2);
	const y = curve(y1, y2);
	return (progress) => {
		if (progress <= 0) return 0;
		if (progress >= 1) return 1;
		// x rises with t on any CSS curve (x1, x2 in 0–1), so halving finds the t for this x.
		let low = 0;
		let high = 1;
		let t = progress;
		for (let i = 0; i < 40; i++) {
			const at = x(t);
			if (Math.abs(at - progress) < 1e-6) break;
			if (at < progress) low = t;
			else high = t;
			t = (low + high) / 2;
		}
		return y(t);
	};
}

/** A color as red, green and blue, each 0–255. */
export type Rgb = readonly [number, number, number];

/** `over` laid on `under` at `alpha` (0–1), as the browser blends a faded fill. */
export function blend(over: Rgb, under: Rgb, alpha: number): Rgb {
	const mix = (index: 0 | 1 | 2) => under[index] + (over[index] - under[index]) * alpha;
	return [mix(0), mix(1), mix(2)];
}

/** The WCAG contrast ratio between two colors: 1 (none) to 21 (black on white). */
export function contrast(a: Rgb, b: Rgb): number {
	const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x);
	return ((lighter ?? 0) + 0.05) / ((darker ?? 0) + 0.05);
}

function luminance([r, g, b]: Rgb): number {
	const linear = (channel: number) => {
		const c = channel / 255;
		return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
	};
	return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}
