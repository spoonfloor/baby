<!--
	Baby’s odds at one word of its reply as a cluster of balls: every word Baby could
	have said there, sized by its chance, the likelier the bigger, brighter and nearer
	the middle; the word it picked lit (see guessMap.ts). Each ball shows
	its word and chance if they fit, else its word, hyphenated as a last resort, else
	nothing; a lit word always shows, just under its ball if it must. When the step
	changes, each ball glides straight to its new place, passing through the others,
	so the eye can follow it; changes that come faster than a glide cut straight to
	their places instead. Approved animation (see APPROVED_ANIMATIONS in
	stylelint.config.js). Point at a ball (or tap it) to see its word and chance.
-->
<script lang="ts">
	import { flushSync, tick, untrack } from 'svelte';
	import type { ReplyStep } from '#lib/baby/index.ts';
	import {
		blend,
		contrast,
		cubicBezier,
		settle,
		toCluster,
		type Ball,
		type Point,
		type Rgb
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
		from: Frame;
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
	let glideStart = 0;
	let gliding = false;
	/** When the step last changed: a change sooner than a glide after it cuts instead. */
	let lastChange = -Infinity;
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
				end: color('--color-guess-end'),
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
			duration: matchMedia('(prefers-reduced-motion: reduce)').matches
				? 0
				: length('--duration-guess-glide'),
			easing: cubicBezier(style.getPropertyValue('--easing-guess-glide')),
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
			const { sizes, duration } = tokens();
			const now = performance.now();
			const cut = now - lastChange < duration;
			lastChange = now;
			balls = toCluster(latest.step, latest.ended, sizes);
			places = settle(balls, places, sizes.gap);
			void place(cut);
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
	 * Sends every ball to its new place: gliding from wherever it is now, or, on a
	 * `cut`, straight there. A new ball grows from nothing where it lands; a ball no
	 * longer in the cluster shrinks away where it is (or, on a cut, just goes).
	 */
	async function place(cut: boolean) {
		if (width === 0 || height === 0) return;
		const now = performance.now();
		const t = progress(now);
		const next = targets();
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- becomes `shown`, read only by the draw loop
		const placed = new Map<string, Shown>();
		for (const ball of balls) {
			const to = next.get(ball.word);
			if (!to) continue;
			const was = shown.get(ball.word);
			const from = cut ? to : was ? frameAt(was, t) : { ...to, radius: 0, weight: 0 };
			placed.set(ball.word, { ball, from, to, size: to.radius, leaving: false });
		}
		if (!cut) {
			for (const [key, was] of shown) {
				if (placed.has(key) || was.leaving) continue;
				const from = frameAt(was, t);
				const to = { ...from, radius: 0, weight: 0 };
				placed.set(key, { ball: was.ball, from, to, size: from.radius, leaving: true });
			}
		}
		shown = placed;
		glideStart = now;
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
			gliding = false;
			draw(now);
		} else if (!gliding) {
			gliding = true;
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

	/** How far through the glide everything is at `now`, eased: 1 when not gliding. */
	function progress(now: number): number {
		if (!gliding) return 1;
		const { duration, easing } = tokens();
		return duration === 0 ? 1 : easing(Math.min(1, (now - glideStart) / duration));
	}

	/** Where a ball is `t` of the way through its glide (0–1). */
	function frameAt({ from, to }: Shown, t: number): Frame {
		const mix = (a: number, b: number) => a + (b - a) * t;
		return {
			x: mix(from.x, to.x),
			y: mix(from.y, to.y),
			radius: mix(from.radius, to.radius),
			weight: mix(from.weight, to.weight)
		};
	}

	function frame(now: number) {
		if (!gliding) return;
		draw(now);
		if (progress(now) < 1) {
			requestAnimationFrame(frame);
			return;
		}
		gliding = false;
		const left = [...shown].filter(([, ball]) => ball.leaving).map(([key]) => key);
		for (const ball of shown.values()) {
			if (!ball.leaving) ball.from = ball.to;
		}
		for (const key of left) shown.delete(key);
		if (left.length > 0) items = items.filter(({ word }) => shown.has(word));
		draw(now);
	}

	function draw(now: number) {
		const { sizes, colors } = tokens();
		const t = progress(now);
		let pointed: { ball: Ball; at: Frame } | undefined;
		for (const [key, ball] of shown) {
			const element = elements.get(key);
			if (!element) continue;
			const at = frameAt(ball, t);
			const scale = ball.size > 0 ? at.radius / ball.size : 0;
			element.style.transform = `translate(${at.x - ball.size}px, ${at.y - ball.size}px) scale(${scale})`;
			const fill = FAINTEST + (1 - FAINTEST) * at.weight;
			element.style.setProperty('--fill', String(fill));
			// Its word goes in whichever label color stands out more from the fill as it looks now.
			const seen = blend(ball.ball.end ? colors.end : colors.word, colors.under, fill);
			element.classList.toggle(
				'bright',
				contrast(colors.labelBright, seen) > contrast(colors.label, seen)
			);
			element.classList.remove('pointed');
			const hit = Math.max(at.radius, sizes.min * 2);
			if (
				!ball.leaving &&
				at.radius > 0 &&
				pointer &&
				Math.hypot(pointer.x - at.x, pointer.y - at.y) < hit &&
				(!pointed || at.weight > pointed.at.weight)
			) {
				pointed = { ball: ball.ball, at };
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
		if (!gliding) draw(performance.now());
	}

	function leave() {
		pointer = undefined;
		if (!gliding) draw(performance.now());
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
		<div class={['ball', { end: ball.end }]} {@attach register(ball.word)}>
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

	.ball.end::before {
		background: var(--color-guess-end);
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
