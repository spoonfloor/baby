import type { Guess, ReplyStep } from '#lib/baby/index.ts';
import { isSpecial } from '#lib/baby/vocabulary.ts';

/**
 * The Graph’s layout: Baby’s odds at each word of its reply as a cluster of balls.
 * Each ball is a word it could have said, sized by its chance there; the word it
 * picked is lit. The same words are balls at every step of a reply, so stepping
 * through it only moves and resizes them. The likelier a word, the closer to the
 * middle it’s pulled, so the long shots end up at the edge. Where everything comes
 * to rest is worked out here, step after step and the same way every time; the map
 * then glides each ball there.
 */

/**
 * Words in the Graph of a whole reply, at most: every word picked, then each step’s
 * likeliest words in turn (every step’s likeliest, then every step’s second, …)
 * until there are this many. Every other word stays out at every step.
 */
export const GRAPH_WORDS = 200;

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
	/** The word Baby picked here. */
	lit: boolean;
	/** Its largest weight at any step of the reply: how big it gets anywhere in it. */
	peak: number;
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
 * The words in the Graph of a reply, `END` among them for every marker (see
 * `GRAPH_WORDS`): the words picked, then each step’s likeliest in turn.
 */
export function graphWords(steps: readonly ReplyStep[]): Set<string> {
	const odds = steps.map(({ guesses }) => foldEnd(guesses));
	const words = new Set(steps.flatMap(({ picked }) => picked ?? []));
	if (steps.at(-1)?.picked === undefined && steps.length > 0) words.add(END);
	const longest = Math.max(0, ...odds.map((step) => step.length));
	for (let rank = 0; rank < longest && words.size < GRAPH_WORDS; rank++) {
		for (const step of odds) {
			const guess = step[rank];
			if (guess && words.size < GRAPH_WORDS) words.add(guess.word);
		}
	}
	return words;
}

/**
 * The balls at every step of a reply: Baby’s odds there (see `foldEnd`), the same
 * words at every step and in the same order (see `GRAPH_WORDS`). The word picked at
 * each step is lit there; at the last step, with nothing picked, Baby picked `END`.
 * Balls are sized against the step’s likeliest word, `END` included, which is always
 * full size, so a near-certain end dwarfs every word. Sizes follow chance on a log
 * scale spanning `DECADES`.
 */
export function toGraph(steps: readonly ReplyStep[], { min, max }: Sizes): Ball[][] {
	const odds = steps.map(({ guesses }) => foldEnd(guesses));
	const lit = steps.map(({ picked }, index) =>
		picked !== undefined ? picked : index === steps.length - 1 ? END : undefined
	);
	const words = graphWords(steps);

	const graph = odds.map((step, index) => {
		const chances = new Map(step.map(({ word, chance }) => [word, chance]));
		const top = step[0]?.chance ?? 0;
		return [...words].map((word) => {
			const chance = chances.get(word) ?? 0;
			const weight =
				top > 0 && chance > 0
					? Math.min(1, Math.max(0, 1 + Math.log10(chance / top) / DECADES))
					: 0;
			const radius = min + (max - min) * weight;
			return { word, chance, weight, radius, lit: word === lit[index], peak: 0 };
		});
	});
	const peaks = new Map<string, number>();
	for (const balls of graph) {
		for (const { word, weight } of balls) peaks.set(word, Math.max(peaks.get(word) ?? 0, weight));
	}
	for (const balls of graph) for (const ball of balls) ball.peak = peaks.get(ball.word) ?? 0;
	return graph;
}

/**
 * Where the balls rest at each step of a reply (see `toGraph`), one step at a time,
 * in order. Each step starts from where the one before it came to rest, so balls
 * only move as much as their new chances force them to, and a step always looks the
 * same however it’s reached.
 */
export function* layOut(
	graph: readonly (readonly Ball[])[],
	gap: number
): Generator<Map<string, Point>> {
	let places = new Map<string, Point>();
	for (const balls of graph) {
		// New balls spiral out from the middle, the biggest anywhere in the reply first, so
		// every word that matters at some step starts near it.
		places = settle(
			[...balls].sort((a, b) => b.peak - a.peak || b.chance - a.chance),
			places,
			gap
		);
		yield places;
	}
}

/** Most steps of the settling simulation: enough for the cluster to come to rest from scratch. */
const STEPS = 1500;
/** Rounds of pushing overlapping balls apart, per step. */
const SEPARATIONS = 3;
/**
 * Every ball’s pull toward the middle: a little for all, so none drift off, plus its
 * chance here, plus a weaker pull for how big it gets anywhere in the reply (its
 * peak), so words that matter at some step stay near the middle at every step and
 * don’t have to cross the cluster when their turn comes.
 */
const PULL_BASE = 0.0006;
const PULL_PER_CHANCE = 0.06;
const PULL_PER_PEAK = 0.02;
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
			pull: PULL_BASE + ball.chance * PULL_PER_CHANCE + ball.peak * PULL_PER_PEAK
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
 * A CSS time (`350ms`, or `.35s` as a minifier writes it) in milliseconds, for
 * timing in script what a stylesheet times.
 */
export function cssTime(css: string): number {
	const match = /^(-?[\d.]+)(ms|s)$/.exec(css.trim());
	if (!match) throw new SyntaxError(`Not a CSS time: ${css}`);
	const value = Number(match[1]);
	if (Number.isNaN(value)) throw new SyntaxError(`Not a CSS time: ${css}`);
	return match[2] === 's' ? value * 1000 : value;
}

/** A spring’s pull toward its target and the drag on its speed, per second (unit mass). */
export interface Spring {
	stiffness: number;
	damping: number;
}

/**
 * The spring that swings once every `response` ms, undamped, and is `dampingRatio`
 * damped: 1 settles without passing its target, less overshoots a little first.
 */
export function spring(response: number, dampingRatio: number): Spring {
	const frequency = (2 * Math.PI) / (response / 1000);
	return { stiffness: frequency ** 2, damping: 2 * dampingRatio * frequency };
}

/** Steps a spring is moved in, at most, in seconds: small enough to stay steady on a slow frame. */
const SPRING_STEP = 1 / 240;

/**
 * Where a value on `spring` is after `seconds`, and how fast it’s going (per second),
 * pulled from `value` at `velocity` toward `target`. Whatever it was doing carries
 * on, so a new target bends its path instead of restarting it.
 */
export function springStep(
	value: number,
	velocity: number,
	target: number,
	seconds: number,
	{ stiffness, damping }: Spring
): [value: number, velocity: number] {
	for (let left = seconds; left > 0; left -= SPRING_STEP) {
		const step = Math.min(SPRING_STEP, left);
		velocity += (-stiffness * (value - target) - damping * velocity) * step;
		value += velocity * step;
	}
	return [value, velocity];
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
