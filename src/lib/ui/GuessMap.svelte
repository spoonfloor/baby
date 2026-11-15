<!--
	Baby’s odds at one word of its reply as a cluster of balls: every word Baby could
	have said, sized by its chance there, the likelier the bigger, brighter and nearer
	the middle; the word it picked lit (see guessMap.ts). The same balls are in the
	map at every step of a reply. Each ball shows its word and chance if they fit,
	else its word, hyphenated as a last resort, else nothing; a lit word always shows,
	just under its ball if it must. When the step changes, each ball springs to its
	new place and size, passing through the others, so the eye can follow it; a
	change before it gets there bends its path toward the new place, keeping its
	speed. Balls are solid, never see-through, and lean gray on the way: a ball
	losing its chance dims early in its move, one gaining it brightens late, so
	mid-move only the word headed for the lead stands out. A step not laid out yet waits: the map stays where it is until it is.
	Approved animation (see APPROVED_ANIMATIONS in stylelint.config.js). Point at a
	ball (or tap it) to see its word and chance.
-->
<script lang="ts">
	import { flushSync, tick, untrack } from 'svelte';
	import {
		blend,
		contrast,
		cssTime,
		END,
		spring,
		springStep,
		type Ball,
		type Point,
		type Rgb,
		type Spring
	} from './guessMap.ts';

	interface Props {
		/** The balls at every step of the reply (see `toGraph`). */
		graph: readonly (readonly Ball[])[];
		/** Where the balls rest at each step laid out so far (see `layOut`). */
		places: readonly ReadonlyMap<string, Point>[];
		/** The step to show, once it’s laid out. */
		step: number;
		/**
		 * The part of the map the cluster is fitted to, when that’s less than all of it:
		 * balls rest inside it but can be seen anywhere in the map.
		 */
		room?: HTMLElement | undefined;
	}

	let { graph, places, step, room }: Props = $props();

	/** How near the surface’s color the least likely words get: never gone, so every ball can be found. */
	const FAINTEST = 0.15;
	/**
	 * How hard brightness leans gray over a move: brightening follows the move’s
	 * progress cubed (late), dimming its complement (early).
	 */
	const GRAY_BIAS = 3;
	/** A move shorter than this, in pixels, changes brightness at once. */
	const SMALLEST_MOVE = 0.5;
	/** The map grows to fill its space, but no ball gets more than this much bigger than full size. */
	const MOST_ENLARGED = 2;
	/** How a ball’s text fits, tried in this order; a ball that fits none shows no text. */
	const FITS = ['both', 'word', 'hyphenated'] as const;
	/** A lit word that fits none of those ways spills out of its ball instead. */
	const SPILL = 'spill';
	/** Fill changes smaller than this aren’t written: no eye can tell them apart. */
	const FILL_STEP = 0.005;

	/** One ball as drawn at a moment: where, how big, how bright. */
	interface Frame extends Point {
		radius: number;
		weight: number;
	}
	/** The parts of a ball that spring; its brightness follows their progress (see `brightness`). */
	const SPRUNG = ['x', 'y', 'radius'] as const;
	interface Shown {
		ball: Ball;
		/** Where it is now, and how fast each part is changing, per second. */
		at: Frame;
		velocity: Frame;
		to: Frame;
		/** The radius its element is laid out at; other sizes scale it. */
		size: number;
		/** Its brightness and how far it had to go when its move began, for `brightness`. */
		from: { weight: number; distance: number };
		/** At its target and still, so frames skip it. */
		resting: boolean;
		/** What its element was last given, so a frame writes only what changed. */
		transform: string;
		fill: number;
	}

	let map: HTMLDivElement;
	let tip: HTMLDivElement;
	/** The balls at the step shown, in the graph’s order: the same words at every step. */
	let items: readonly Ball[] = $state.raw([]);
	/** Each ball’s element, by word. Moved frame by frame, so not reactive. */
	// eslint-disable-next-line svelte/prefer-svelte-reactivity -- read only by the draw loop
	const elements = new Map<string, HTMLElement>();
	/** The balls being drawn, gliding or still. Drawn frame by frame, so not reactive. */
	let shown = new Map<string, Shown>();
	/** The graph and step drawn; a new graph is a new reply, which starts afresh. */
	let drawnGraph: readonly (readonly Ball[])[] | undefined;
	let drawnStep = 0;
	/** The resting places drawn: another step arriving doesn’t change them, so doesn’t redraw. */
	let drawnRest: ReadonlyMap<string, Point> | undefined;
	/** Balls are moving, and when the last frame was drawn. */
	let moving = false;
	let lastFrame = 0;
	/** Counts layouts, so one that a newer one overtook while the page caught up stops. */
	let generation = 0;
	let pointer: Point | undefined;
	/** The ball pointed at, by word. */
	let pointedWord: string | undefined;
	/** The pointed-at ball’s word and chance, and the tip’s size with it. */
	let tipText = $state('');
	let tipSize = { width: 0, height: 0 };
	let width = 0;
	let height = 0;
	/** Where the cluster is fitted, in the map’s pixels: `room`, or the whole map. */
	let fitBox = { x: 0, y: 0, width: 0, height: 0 };
	/** The design tokens, read once per layout rather than every frame. */
	let look: ReturnType<typeof tokens> | undefined;

	const description = $derived.by(() => {
		const lit = items.find((ball) => ball.lit)?.word;
		if (lit === undefined) return 'Baby’s odds at its next word';
		if (lit === END) return 'Baby’s odds at its next word, the end picked';
		return `Baby’s odds at its next word, “${lit}” picked`;
	});

	/** Every size, color and timing comes from the design tokens, read as the browser resolved them. */
	function tokens() {
		const style = getComputedStyle(map);
		const length = (name: string) => parseFloat(style.getPropertyValue(name));
		const color = (name: string) => rgb(style.getPropertyValue(name));
		return {
			colors: {
				word: color('--color-guess-word'),
				label: color('--color-guess-label'),
				labelBright: color('--color-guess-label-bright'),
				/** The map sits on a surface: what a faded ball is seen against. */
				under: color('--color-surface')
			},
			sizes: {
				min: length('--size-guess-min'),
				gap: length('--size-guess-gap')
			},
			/** No spring when motion is reduced: every change cuts. */
			spring: matchMedia('(prefers-reduced-motion: reduce)').matches
				? undefined
				: spring(
						cssTime(style.getPropertyValue('--spring-guess-response')),
						parseFloat(style.getPropertyValue('--spring-guess-damping'))
					),
			padding: length('--space-inline')
		};
	}

	/** Turns any CSS color into red, green and blue, by letting a canvas read it. */
	const reader = new OffscreenCanvas(1, 1).getContext('2d', { willReadFrequently: true });
	function rgb(css: string): Rgb {
		if (!reader) return [0, 0, 0];
		reader.fillStyle = css.trim();
		reader.fillRect(0, 0, 1, 1);
		const [r = 0, g = 0, b = 0] = reader.getImageData(0, 0, 1, 1).data;
		return [r, g, b];
	}

	function percent(chance: number): string {
		return chance < 0.001 ? '<0.1%' : `${(chance * 100).toFixed(1)}%`;
	}

	// Shows the step asked for once it’s laid out; until then, the map stays as it is.
	$effect(() => {
		const latest = { graph, places, step };
		untrack(() => {
			if (latest.graph !== drawnGraph) {
				shown = new Map();
				drawnGraph = latest.graph;
				drawnRest = undefined;
			}
			const rest = latest.places[latest.step];
			if (!rest || rest === drawnRest) return;
			drawnStep = latest.step;
			drawnRest = rest;
			look = tokens();
			void place(look.spring === undefined);
		});
	});

	$effect(() => {
		const fitTo = room;
		const observer = new ResizeObserver(() => {
			width = map.clientWidth;
			height = map.clientHeight;
			const box = map.getBoundingClientRect();
			const inner = fitTo?.getBoundingClientRect() ?? box;
			fitBox = {
				x: inner.left - box.left,
				y: inner.top - box.top,
				width: inner.width,
				height: inner.height
			};
			if (drawnGraph && places[drawnStep]) void place(true);
		});
		observer.observe(map);
		if (fitTo) observer.observe(fitTo);
		return () => observer.disconnect();
	});

	/** Where every ball should be: its resting place, scaled to fill the fitting box and centered in it. */
	function targets(
		balls: readonly Ball[],
		rest: ReadonlyMap<string, Point>,
		gap: number
	): Map<string, Frame> {
		let left = Infinity;
		let right = -Infinity;
		let top = Infinity;
		let bottom = -Infinity;
		for (const ball of balls) {
			const at = rest.get(ball.word);
			if (!at) continue;
			left = Math.min(left, at.x - ball.radius);
			right = Math.max(right, at.x + ball.radius);
			top = Math.min(top, at.y - ball.radius);
			bottom = Math.max(bottom, at.y + ball.radius);
		}
		const space = {
			width: Math.max(0, fitBox.width - 2 * gap),
			height: Math.max(0, fitBox.height - 2 * gap)
		};
		const scale =
			right > left
				? Math.min(MOST_ENLARGED, space.width / (right - left), space.height / (bottom - top))
				: 1;
		const middle = { x: (left + right) / 2, y: (top + bottom) / 2 };
		return new Map(
			balls.map((ball) => {
				const at = rest.get(ball.word) ?? middle;
				return [
					ball.word,
					{
						x: fitBox.x + fitBox.width / 2 + (at.x - middle.x) * scale,
						y: fitBox.y + fitBox.height / 2 + (at.y - middle.y) * scale,
						radius: ball.radius * scale,
						weight: ball.lit ? 1 : ball.weight
					}
				];
			})
		);
	}

	/**
	 * Sends every ball to its place at the step drawn: springing from wherever it is
	 * now, as fast as it’s going, or, on a `cut`, straight there. When the map first
	 * shows a reply, each ball grows from nothing where it lands.
	 */
	async function place(cut: boolean) {
		const balls = drawnGraph?.[drawnStep];
		const rest = places[drawnStep];
		if (width === 0 || height === 0 || !balls || !rest) return;
		look ??= tokens();
		const next = targets(balls, rest, look.sizes.gap);
		// Frames move each ball’s own place and speed in place, so no two balls may share one.
		const still = () => ({ x: 0, y: 0, radius: 0, weight: 0 });
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- becomes `shown`, read only by the draw loop
		const placed = new Map<string, Shown>();
		for (const ball of balls) {
			const to = next.get(ball.word);
			if (!to) continue;
			const was = shown.get(ball.word);
			const at = cut || !was ? { ...to, ...(cut ? {} : { radius: 0, weight: 0 }) } : was.at;
			placed.set(ball.word, {
				ball,
				at,
				velocity: cut || !was ? still() : was.velocity,
				to,
				size: to.radius,
				from: {
					weight: cut ? to.weight : was ? brightness(was) : 0,
					distance: cut ? 0 : distance(at, to)
				},
				resting: false,
				transform: '',
				fill: -1
			});
		}
		shown = placed;
		items = balls;

		const current = ++generation;
		await tick();
		if (current !== generation) return;
		// The likeliest on top, and the lit words above all.
		const order = [...shown.values()].sort(
			(a, b) => Number(a.ball.lit) - Number(b.ball.lit) || a.to.weight - b.to.weight
		);
		for (const [index, { ball, size }] of order.entries()) {
			const element = elements.get(ball.word);
			if (!element) continue;
			element.style.width = element.style.height = `${size * 2}px`;
			element.style.zIndex = String(index);
		}
		fit();
		if (cut) {
			moving = false;
			draw();
		} else if (!moving) {
			moving = true;
			lastFrame = performance.now();
			requestAnimationFrame(frame);
		}
	}

	/**
	 * Writes each ball’s text the first way that fits it at its laid-out size. Each way
	 * is tried on every ball still unfitted before any is measured, so the page is
	 * laid out once per way, not once per ball.
	 */
	function fit() {
		let unfitted = [...shown.values()].flatMap(({ ball }) => {
			const element = elements.get(ball.word);
			return element ? [{ ball, element }] : [];
		});
		for (const way of FITS) {
			for (const { element } of unfitted) element.dataset.fit = way;
			unfitted = unfitted.filter(({ element }) => !fits(element));
		}
		for (const { ball, element } of unfitted) element.dataset.fit = ball.lit ? SPILL : 'none';
	}

	function fits(element: HTMLElement): boolean {
		const text = element.querySelector('.text');
		if (!(text instanceof HTMLElement)) return false;
		const lines = [...text.children].filter(
			(line): line is HTMLElement => line instanceof HTMLElement && line.offsetParent !== null
		);
		const tall = lines.reduce((sum, line) => sum + line.offsetHeight, 0);
		return tall <= text.clientHeight && lines.every((line) => line.scrollWidth <= text.clientWidth);
	}

	/** Close enough to its target, and slow enough, that a ball is at rest: pixels and per second. */
	const REST = { distance: 0.05, speed: 0.5 };
	/** The longest step a frame moves things by, in seconds, so a stalled page doesn’t jump. */
	const LONGEST_FRAME = 1 / 20;

	function frame(now: number) {
		if (!moving) return;
		const spring = look?.spring;
		const seconds = Math.min(LONGEST_FRAME, (now - lastFrame) / 1000);
		lastFrame = now;
		let resting = true;
		for (const ball of shown.values()) {
			if (ball.resting) continue;
			if (spring) move(ball, seconds, spring);
			if (!spring || atRest(ball)) {
				ball.at = { ...ball.to };
				ball.velocity = { x: 0, y: 0, radius: 0, weight: 0 };
				ball.resting = true;
			} else resting = false;
		}
		draw();
		if (resting) moving = false;
		else requestAnimationFrame(frame);
	}

	/** Moves every part of a ball `seconds` along its spring toward where it’s going. */
	function move(ball: Shown, seconds: number, spring: Spring) {
		const { at, velocity, to } = ball;
		for (const part of SPRUNG) {
			[at[part], velocity[part]] = springStep(at[part], velocity[part], to[part], seconds, spring);
		}
	}

	function atRest({ at, velocity, to }: Shown): boolean {
		const near = (part: 'x' | 'y' | 'radius', limit: number) =>
			Math.abs(at[part] - to[part]) < limit && Math.abs(velocity[part]) < REST.speed;
		return SPRUNG.every((part) => near(part, REST.distance));
	}

	/** How far a ball has left to go, in place and size together. */
	function distance(at: Frame, to: Frame): number {
		return Math.hypot(to.x - at.x, to.y - at.y, to.radius - at.radius);
	}

	/**
	 * How bright a ball is now: from its brightness when the move began to its
	 * target’s, by how far through the move it is, leaning gray (see `GRAY_BIAS`).
	 */
	function brightness({ at, to, from, resting }: Shown): number {
		if (resting || from.distance < SMALLEST_MOVE) return to.weight;
		const progress = Math.min(1, Math.max(0, 1 - distance(at, to) / from.distance));
		const eased = to.weight > from.weight ? progress ** GRAY_BIAS : 1 - (1 - progress) ** GRAY_BIAS;
		return from.weight + (to.weight - from.weight) * eased;
	}

	/** Writes each ball’s place, size and fill to its element, where they changed, then the pointer’s tip. */
	function draw() {
		if (!look) return;
		const { colors } = look;
		for (const [key, ball] of shown) {
			const element = elements.get(key);
			if (!element) continue;
			const { at } = ball;
			// A spring can carry a ball past its target: never inside out.
			const radius = Math.max(0, at.radius);
			const weight = brightness(ball);
			const scale = ball.size > 0 ? radius / ball.size : 0;
			const transform = `translate(${(at.x - ball.size).toFixed(1)}px, ${(at.y - ball.size).toFixed(1)}px) scale(${scale.toFixed(3)})`;
			if (transform !== ball.transform) {
				element.style.transform = ball.transform = transform;
			}
			const fill = FAINTEST + (1 - FAINTEST) * weight;
			if (Math.abs(fill - ball.fill) >= FILL_STEP || (ball.resting && fill !== ball.fill)) {
				ball.fill = fill;
				// Solid: the fill as it would look over the surface, so balls never show through each other.
				const seen = blend(colors.word, colors.under, fill);
				element.style.backgroundColor = `rgb(${seen.map(Math.round).join(' ')})`;
				// Its word goes in whichever label color stands out more from the fill as it looks now.
				element.classList.toggle(
					'bright',
					contrast(colors.labelBright, seen) > contrast(colors.label, seen)
				);
			}
		}
		drawPointer();
	}

	/** Marks the ball under the pointer, the likeliest if several, and shows its tip. */
	function drawPointer() {
		if (!look) return;
		let pointed: Shown | undefined;
		if (pointer) {
			for (const ball of shown.values()) {
				const radius = Math.max(0, ball.at.radius);
				const hit = Math.max(radius, look.sizes.min * 2);
				if (
					radius > 0 &&
					Math.hypot(pointer.x - ball.at.x, pointer.y - ball.at.y) < hit &&
					(!pointed || ball.to.weight > pointed.to.weight)
				) {
					pointed = ball;
				}
			}
		}
		const word = pointed?.ball.word;
		if (word !== pointedWord) {
			if (pointedWord !== undefined) elements.get(pointedWord)?.classList.remove('pointed');
			if (word !== undefined) elements.get(word)?.classList.add('pointed');
			pointedWord = word;
		}
		if (!pointed) {
			tip.hidden = true;
			return;
		}
		showTip(pointed.ball, pointed.at, Math.max(0, pointed.at.radius), look.padding);
	}

	/** The word and its chance beside the ball being pointed at, kept inside the map. */
	function showTip(ball: Ball, at: Point, radius: number, padding: number) {
		const text = `${ball.word} ${percent(ball.chance)}`;
		const appearing = tip.hidden;
		tip.hidden = false;
		// The tip is measured only when its text changes, with its new text in the page first.
		if (text !== tipText || appearing) {
			if (text !== tipText) flushSync(() => (tipText = text));
			tipSize = { width: tip.offsetWidth, height: tip.offsetHeight };
		}
		const x = Math.min(width - tipSize.width, Math.max(0, at.x + radius + padding));
		const y = Math.min(height - tipSize.height, Math.max(0, at.y - radius - tipSize.height));
		tip.style.transform = `translate(${x}px, ${y}px)`;
	}

	function point(event: PointerEvent) {
		const box = map.getBoundingClientRect();
		pointer = { x: event.clientX - box.left, y: event.clientY - box.top };
		if (!moving) drawPointer();
	}

	function leave() {
		pointer = undefined;
		if (!moving) drawPointer();
	}

	/** Keeps track of each ball’s element while it’s in the page. */
	function register(key: string) {
		return (element: HTMLElement) => {
			elements.set(key, element);
			return () => {
				if (elements.get(key) === element) elements.delete(key);
			};
		};
	}
</script>

<div
	class="map"
	bind:this={map}
	role="img"
	aria-label={description}
	onpointermove={point}
	onpointerdown={point}
	onpointerleave={leave}
>
	{#each items as ball (ball.word)}
		<div class="ball" {@attach register(ball.word)}>
			<div class="text">
				<span class="word">{ball.word}</span>
				<span class="chance">{percent(ball.chance)}</span>
			</div>
		</div>
	{/each}
	<div class="tip" bind:this={tip} hidden>{tipText}</div>
</div>

<style>
	.map {
		position: relative;
		inline-size: 100%;
		block-size: 100%;
		min-block-size: 0;
		overflow: hidden;
		font-family: var(--font-family-condensed);
		font-size: var(--font-size-label);
		line-height: var(--line-height-tight);
		touch-action: manipulation;
		user-select: none;
	}

	.ball {
		position: absolute;
		inset-block-start: 0;
		inset-inline-start: 0;
		display: grid;
		place-items: center;
		border-radius: 50%;
		color: var(--color-guess-label);
		transform-origin: center;
	}

	.ball:global(.bright) {
		color: var(--color-guess-label-bright);
	}

	.ball:global(.pointed) {
		outline: var(--size-guess-gap) solid var(--color-text);
		outline-offset: var(--size-guess-gap);
	}

	/* The square inside the circle: text that fits here fits the ball. */
	.text {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		inline-size: 70.71%;
		block-size: 70.71%;
		overflow: hidden;
		text-align: center;
	}

	.word {
		hyphens: manual;
	}

	/* Set by the fitting and drawing code, which Svelte can’t see: hence :global. */
	.ball:global([data-fit='word']) .chance,
	.ball:global([data-fit='hyphenated']) .chance {
		display: none;
	}

	.ball:global([data-fit='hyphenated']) .word {
		hyphens: auto;
	}

	.ball:global([data-fit='none']) .text {
		visibility: hidden;
	}

	/* A lit word too big for its ball is written just under it, on a tag like the tip’s, so it reads over any ball. */
	.ball:global([data-fit='spill']) {
		color: var(--color-text);
	}

	.ball:global([data-fit='spill']) .text {
		position: absolute;
		inset-block-start: 100%;
		inset-inline-start: 50%;
		inline-size: auto;
		block-size: auto;
		padding-inline: var(--space-inline-tight);
		overflow: visible;
		background: var(--color-surface-raised);
		translate: -50% 0;
	}

	.ball:global([data-fit='spill']) .chance {
		display: none;
	}

	.ball:global([data-fit='spill']) .word {
		white-space: nowrap;
	}

	.tip {
		position: absolute;
		inset-block-start: 0;
		inset-inline-start: 0;
		padding: var(--space-inline);
		background: var(--color-surface-raised);
		color: var(--color-text);
		white-space: nowrap;
		pointer-events: none;
	}
</style>
