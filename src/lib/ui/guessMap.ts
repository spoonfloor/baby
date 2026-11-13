import type { Guess } from '#lib/baby/index.ts';
import { isSpecial } from '#lib/baby/vocabulary.ts';

/**
 * The next-word map’s layout: each word Baby could say first is a ball, pulled toward
 * the center by its chance, so the likeliest words push their way to the middle and
 * the long shots end up at the edge. Where they come to rest is worked out here, all
 * at once and the same way every time; the map then glides each ball there.
 */

/** The map shows only the likeliest words: beyond this many, packing gets slow and the rest are specks. */
export const MAP_WORDS = 64;

export interface Point {
	x: number;
	y: number;
}

export interface Ball {
	word: string;
	chance: number;
	/** The chance next to the likeliest word’s, square-rooted, so a ball’s area follows its chance: 0–1. */
	weight: number;
	radius: number;
	/** A marker ([EOS], or a turn start): picking it first ends the reply before it starts. */
	marker: boolean;
}

/** Ball radii and the space between balls, in pixels at full size. */
export interface Sizes {
	min: number;
	max: number;
	gap: number;
}

/** The likeliest `MAP_WORDS` guesses as balls, likeliest first. The likeliest is always full size. */
export function toBalls(guesses: readonly Guess[], { min, max }: Sizes): Ball[] {
	const likeliest = [...guesses].sort((a, b) => b.chance - a.chance).slice(0, MAP_WORDS);
	const top = likeliest[0]?.chance ?? 0;
	return likeliest.map(({ word, chance }) => {
		const weight = top > 0 ? Math.sqrt(chance / top) : 0;
		return { word, chance, weight, radius: min + (max - min) * weight, marker: isSpecial(word) };
	});
}

/** Most steps of the settling simulation: enough for 64 balls to come to rest from scratch. */
const STEPS = 1500;
/** Rounds of pushing overlapping balls apart, per step. */
const SEPARATIONS = 5;
/** Every ball’s pull toward the center: a little for all, so none drift off, plus its chance. */
const PULL_BASE = 0.0006;
const PULL_PER_CHANCE = 0.06;
/** Damping: lively at first, so balls can shove past each other into place, then settling. */
const DAMPING_LIVELY = 0.9;
const DAMPING_SETTLING = 0.75;
const LIVELY_STEPS = 150;
/** At rest: no ball moving faster than this, in pixels per step. */
const REST_SPEED = 0.005;

/**
 * Where each ball comes to rest, packed tight around the center. Balls start where
 * they were (`previous`), so the map only moves as much as the new chances force it
 * to; a new ball starts just outside the pack, in a direction set by its word. No
 * randomness: the same balls from the same places always settle the same way.
 */
export function settle(
	balls: readonly Ball[],
	previous: ReadonlyMap<string, Point>,
	gap: number
): Map<string, Point> {
	let edge = 0;
	for (const ball of balls) {
		const at = previous.get(ball.word);
		if (at) edge = Math.max(edge, Math.hypot(at.x, at.y) + ball.radius);
	}
	const bodies = balls.map((ball) => {
		const at = previous.get(ball.word);
		const angle = wordAngle(ball.word);
		const start = at ?? {
			x: Math.cos(angle) * (edge + ball.radius),
			y: Math.sin(angle) * (edge + ball.radius)
		};
		return {
			...ball,
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

	// Center the pack on its balance point, weighted by chance, so the likeliest words sit mid-map.
	let total = 0;
	let cx = 0;
	let cy = 0;
	for (const { x, y, chance } of bodies) {
		total += chance;
		cx += x * chance;
		cy += y * chance;
	}
	if (total > 0) {
		cx /= total;
		cy /= total;
	}
	return new Map(bodies.map(({ word, x, y }) => [word, { x: x - cx, y: y - cy }]));
}

/** Pushes every overlapping pair apart along the line between them, each by half the overlap. */
function separate(bodies: (Point & { radius: number })[], gap: number) {
	for (let round = 0; round < SEPARATIONS; round++) {
		for (let i = 0; i < bodies.length; i++) {
			for (let j = i + 1; j < bodies.length; j++) {
				const a = bodies[i];
				const b = bodies[j];
				if (!a || !b) continue;
				const dx = b.x - a.x;
				const dy = b.y - a.y;
				const reach = a.radius + b.radius + gap;
				const squared = dx * dx + dy * dy;
				if (squared >= reach * reach) continue;
				const distance = Math.sqrt(squared) || Number.EPSILON;
				const overlap = reach - distance;
				const nx = dx / distance;
				const ny = dy / distance;
				a.x -= (nx * overlap) / 2;
				a.y -= (ny * overlap) / 2;
				b.x += (nx * overlap) / 2;
				b.y += (ny * overlap) / 2;
			}
		}
	}
}

/** A direction for each word, the same every time: where a new ball enters the map. */
function wordAngle(word: string): number {
	let hash = 7;
	for (const char of word) hash = (hash * 31 + (char.codePointAt(0) ?? 0)) % 100_003;
	return (hash / 100_003) * 2 * Math.PI;
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
