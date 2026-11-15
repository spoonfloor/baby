<!--
	Baby’s odds at one word of its reply as a cluster of balls: every word Baby could
	have said there, sized by its chance, the likelier the bigger, brighter and nearer
	the middle; the word it picked lit (see guessMap.ts). Each ball shows
	its word and chance if they fit, else its word, hyphenated as a last resort, else
	nothing; a lit word always shows, just under its ball if it must. When the step
	changes, each ball springs to its new place, passing through the others, so the
	eye can follow it; a change before it gets there bends its path toward the new
	place, keeping its speed. Approved animation (see APPROVED_ANIMATIONS in
	stylelint.config.js). Point at a ball (or tap it) to see its word and chance.
-->
<script lang="ts">
	import { flushSync, tick, untrack } from 'svelte';
	import type { ReplyStep } from '#lib/baby/index.ts';
	import {
		blend,
		contrast,
		cssTime,
		settle,
		spring,
		springStep,
		toCluster,
		type Ball,
		type Point,
		type Rgb,
		type Spring
	} from './guessMap.ts';

	interface Props {
		/** One word of the reply: the odds there and the word picked. */
		step: ReplyStep;
		/** The reply ended here: nothing picked means Baby picked the end. */
		ended: boolean;
	}

	let { step, ended }: Props = $props();

	/** How faint the least likely words get: never invisible, so every ball can be found. */
	const FAINTEST = 0.15;
	/** The map grows to fill its space, but no ball gets more than this much bigger than full size. */
	const MOST_ENLARGED = 2;
	/** How a ball’s text fits, tried in this order; a ball that fits none shows no text. */
	const FITS = ['both', 'word', 'hyphenated'] as const;
	/** A lit word that fits none of those ways spills out of its ball instead. */
	const SPILL = 'spill';

	/** One ball as drawn at a moment: where, how big, how bright. */
	interface Frame extends Point {
		radius: number;
		weight: number;
	}
	interface Shown {
		ball: Ball;
		/** Where it is now, and how fast each part is changing, per second. */
		at: Frame;
		velocity: Frame;
		to: Frame;
		/** The radius its element is laid out at; other sizes scale it. */
		size: number;
		/** No longer guessed: shrinks away, then is dropped. */
		leaving: boolean;
	}

	let map: HTMLDivElement;
	let tip: HTMLDivElement;
	/** The balls in the page, likeliest last so they sit on top. Replaced whole at each change. */
	let items: Ball[] = $state.raw([]);
	/** Each ball’s element, by key. Moved frame by frame, so not reactive. */
	// eslint-disable-next-line svelte/prefer-svelte-reactivity -- read only by the draw loop
	const elements = new Map<string, HTMLElement>();
	/** Where each ball rests, at full size, by key. */
	let places = new Map<string, Point>();
	/** The balls being drawn, gliding or still. Drawn frame by frame, so not reactive. */
	// eslint-disable-next-line svelte/prefer-svelte-reactivity -- read only by the draw loop
	let shown = new Map<string, Shown>();
	let balls: Ball[] = [];
	/** Balls are moving, and when the last frame was drawn. */
	let moving = false;
	let lastFrame = 0;
	/** Counts layouts, so one that a newer one overtook while the page caught up stops. */
	let generation = 0;
	let pointer: Point | undefined;
	/** The pointed-at ball’s word and chance. */
	let tipText = $state('');
	let width = 0;
	let height = 0;

	const description = $derived(
		step.picked !== undefined
			? `Baby’s odds at its next word, “${step.picked}” picked`
			: ended
				? 'Baby’s odds at its next word, the end picked'
				: 'Baby’s odds at its next word'
	);

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
				max: length('--size-guess-max'),
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

	$effect(() => {
		const latest = { step, ended };
		untrack(() => {
			const { sizes, spring } = tokens();
			balls = toCluster(latest.step, latest.ended, sizes);
			places = settle(balls, places, sizes.gap);
			void place(spring === undefined);
		});
	});

	$effect(() => {
		const observer = new ResizeObserver(() => {
			width = map.clientWidth;
			height = map.clientHeight;
			void place(true);
		});
		observer.observe(map);
		return () => observer.disconnect();
	});

	/** Where every ball should be now: the resting places, scaled to fill the map and centered in it. */
	function targets(): Map<string, Frame> {
		const { sizes } = tokens();
		let left = Infinity;
		let right = -Infinity;
		let top = Infinity;
		let bottom = -Infinity;
		for (const ball of balls) {
			const at = places.get(ball.word);
			if (!at) continue;
			left = Math.min(left, at.x - ball.radius);
			right = Math.max(right, at.x + ball.radius);
			top = Math.min(top, at.y - ball.radius);
			bottom = Math.max(bottom, at.y + ball.radius);
		}
		const room = {
			width: Math.max(0, width - 2 * sizes.gap),
			height: Math.max(0, height - 2 * sizes.gap)
		};
		const scale =
			right > left
				? Math.min(MOST_ENLARGED, room.width / (right - left), room.height / (bottom - top))
				: 1;
		const middle = { x: (left + right) / 2, y: (top + bottom) / 2 };
		return new Map(
			balls.map((ball) => {
				const at = places.get(ball.word) ?? middle;
				return [
					ball.word,
					{
						x: width / 2 + (at.x - middle.x) * scale,
						y: height / 2 + (at.y - middle.y) * scale,
						radius: ball.radius * scale,
						weight: ball.lit ? 1 : ball.weight
					}
				];
			})
		);
	}

	/**
	 * Sends every ball to its new place: springing from wherever it is now, as fast as
	 * it’s going, or, on a `cut`, straight there. A new ball grows from nothing where it
	 * lands; a ball no longer in the cluster shrinks away where it is (or, on a cut,
	 * just goes).
	 */
	async function place(cut: boolean) {
		if (width === 0 || height === 0) return;
		const next = targets();
		const still = { x: 0, y: 0, radius: 0, weight: 0 };
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- becomes `shown`, read only by the draw loop
		const placed = new Map<string, Shown>();
		for (const ball of balls) {
			const to = next.get(ball.word);
			if (!to) continue;
			const was = shown.get(ball.word);
			const at = cut ? to : (was?.at ?? { ...to, radius: 0, weight: 0 });
			const velocity = cut ? still : (was?.velocity ?? still);
			placed.set(ball.word, { ball, at, velocity, to, size: to.radius, leaving: false });
		}
		if (!cut) {
			for (const [key, was] of shown) {
				if (placed.has(key) || was.leaving) continue;
				const to = { ...was.at, radius: 0, weight: 0 };
				placed.set(key, { ...was, to, size: Math.max(was.size, was.at.radius), leaving: true });
			}
		}
		shown = placed;
		// The likeliest on top, and the lit words above all.
		items = [...placed.values()]
			.sort((a, b) => Number(a.ball.lit) - Number(b.ball.lit) || a.to.weight - b.to.weight)
			.map(({ ball }) => ball);

		const current = ++generation;
		await tick();
		if (current !== generation) return;
		for (const [key, { size }] of shown) {
			const element = elements.get(key);
			if (!element) continue;
			element.style.width = element.style.height = `${size * 2}px`;
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
		const text = element.firstElementChild;
		if (!(text instanceof HTMLElement)) return false;
		const lines = [...text.children].filter(
			(line): line is HTMLElement => line instanceof HTMLElement && line.offsetParent !== null
		);
		const tall = lines.reduce((sum, line) => sum + line.offsetHeight, 0);
		return tall <= text.clientHeight && lines.every((line) => line.scrollWidth <= text.clientWidth);
	}

	/** Close enough to its target, and slow enough, that a ball is at rest: pixels (or weight) and per second. */
	const REST = { distance: 0.05, speed: 0.5, weight: 0.001 };
	/** The longest step a frame moves things by, in seconds, so a stalled page doesn’t jump. */
	const LONGEST_FRAME = 1 / 20;

	function frame(now: number) {
		if (!moving) return;
		const { spring } = tokens();
		const seconds = Math.min(LONGEST_FRAME, (now - lastFrame) / 1000);
		lastFrame = now;
		let resting = true;
		for (const ball of shown.values()) {
			if (spring) move(ball, seconds, spring);
			if (!atRest(ball)) resting = false;
		}
		if (!resting && spring) {
			draw();
			requestAnimationFrame(frame);
			return;
		}
		moving = false;
		const left = [...shown].filter(([, ball]) => ball.leaving).map(([key]) => key);
		for (const ball of shown.values()) {
			ball.at = ball.to;
			ball.velocity = { x: 0, y: 0, radius: 0, weight: 0 };
		}
		for (const key of left) shown.delete(key);
		if (left.length > 0) items = items.filter(({ word }) => shown.has(word));
		draw();
	}

	/** Moves every part of a ball `seconds` along its spring toward where it’s going. */
	function move(ball: Shown, seconds: number, spring: Spring) {
		const at = { ...ball.at };
		const velocity = { ...ball.velocity };
		for (const part of ['x', 'y', 'radius', 'weight'] as const) {
			[at[part], velocity[part]] = springStep(
				at[part],
				velocity[part],
				ball.to[part],
				seconds,
				spring
			);
		}
		ball.at = at;
		ball.velocity = velocity;
	}

	function atRest({ at, velocity, to }: Shown): boolean {
		const near = (part: 'x' | 'y' | 'radius', limit: number) =>
			Math.abs(at[part] - to[part]) < limit && Math.abs(velocity[part]) < REST.speed;
		return (
			near('x', REST.distance) &&
			near('y', REST.distance) &&
			near('radius', REST.distance) &&
			Math.abs(at.weight - to.weight) < REST.weight &&
			Math.abs(velocity.weight) < REST.weight * 10
		);
	}

	function draw() {
		const { sizes, colors } = tokens();
		let pointed: { ball: Ball; at: Frame } | undefined;
		for (const [key, ball] of shown) {
			const element = elements.get(key);
			if (!element) continue;
			const { at } = ball;
			// A spring can carry a ball past its target: never inside out, never brighter than full.
			const radius = Math.max(0, at.radius);
			const weight = Math.min(1, Math.max(0, at.weight));
			const scale = ball.size > 0 ? radius / ball.size : 0;
			element.style.transform = `translate(${at.x - ball.size}px, ${at.y - ball.size}px) scale(${scale})`;
			const fill = FAINTEST + (1 - FAINTEST) * weight;
			element.style.setProperty('--fill', String(fill));
			// Its word goes in whichever label color stands out more from the fill as it looks now.
			const seen = blend(colors.word, colors.under, fill);
			element.classList.toggle(
				'bright',
				contrast(colors.labelBright, seen) > contrast(colors.label, seen)
			);
			element.classList.remove('pointed');
			const hit = Math.max(radius, sizes.min * 2);
			if (
				!ball.leaving &&
				radius > 0 &&
				pointer &&
				Math.hypot(pointer.x - at.x, pointer.y - at.y) < hit &&
				(!pointed || weight > pointed.at.weight)
			) {
				pointed = { ball: ball.ball, at: { ...at, radius, weight } };
			}
		}
		if (!pointed) {
			tip.hidden = true;
			return;
		}
		elements.get(pointed.ball.word)?.classList.add('pointed');
		showTip(pointed.ball, pointed.at, pointed.at.radius);
	}

	/** The word and its chance beside the ball being pointed at, kept inside the map. */
	function showTip(ball: Ball, at: Point, radius: number) {
		const { padding } = tokens();
		const text = `${ball.word} ${percent(ball.chance)}`;
		// The tip is measured next, so it has to be in the page with its new text first.
		if (text !== tipText) flushSync(() => (tipText = text));
		tip.hidden = false;
		const x = Math.min(width - tip.offsetWidth, Math.max(0, at.x + radius + padding));
		const y = Math.min(height - tip.offsetHeight, Math.max(0, at.y - radius - tip.offsetHeight));
		tip.style.transform = `translate(${x}px, ${y}px)`;
	}

	function point(event: PointerEvent) {
		const box = map.getBoundingClientRect();
		pointer = { x: event.clientX - box.left, y: event.clientY - box.top };
		if (!moving) draw();
	}

	function leave() {
		pointer = undefined;
		if (!moving) draw();
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

	/* The fill fades with the ball’s chance; its text stays solid. */
	.ball::before {
		position: absolute;
		inset: 0;
		border-radius: inherit;
		background: var(--color-guess-word);
		opacity: var(--fill);
		content: '';
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
