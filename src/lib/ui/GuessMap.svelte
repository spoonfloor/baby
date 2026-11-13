<!--
	Baby’s guesses at its next word as balls packed around the middle: the likelier a
	word, the bigger and brighter it is and the closer to the center. When the guesses
	change, each ball glides straight to its new place, passing through the others, so
	the eye can follow it. Approved animation (see APPROVED_ANIMATIONS in stylelint.config.js).
	Point at a ball (or tap it) to see its word and chance.
-->
<script lang="ts">
	import type { Guess } from '#lib/baby/index.ts';
	import { cubicBezier, settle, toBalls, type Ball, type Point } from './guessMap.ts';

	let { guesses }: { guesses: readonly Guess[] } = $props();

	/** How faint the least likely words get: never invisible, so every ball can be found. */
	const FAINTEST = 0.15;
	/** The map grows to fill its space, but no ball gets more than this much bigger than full size. */
	const MOST_ENLARGED = 2;

	/** One ball as drawn at a moment: where, how big, how bright. */
	interface Frame extends Point {
		radius: number;
		weight: number;
	}
	interface Shown {
		ball: Ball;
		from: Frame;
		to: Frame;
		/** No longer guessed: shrinks away, then is dropped. */
		leaving: boolean;
	}

	let canvas: HTMLCanvasElement;
	/** Where each ball rests, at full size around the center. */
	let places = new Map<string, Point>();
	/** The balls being drawn, gliding or still. Drawn frame by frame, so not reactive. */
	// eslint-disable-next-line svelte/prefer-svelte-reactivity -- read only by the draw loop
	let shown = new Map<string, Shown>();
	let balls: Ball[] = [];
	let glideStart = 0;
	let gliding = false;
	let pointer: Point | undefined;
	let width = 0;
	let height = 0;

	const description = $derived(
		[...guesses]
			.sort((a, b) => b.chance - a.chance)
			.slice(0, 5)
			.map(({ word, chance }) => `${word} ${percent(chance)}`)
			.join(', ')
	);

	/** Every size, color and timing comes from the design tokens, read as the browser resolved them. */
	function tokens() {
		const style = getComputedStyle(canvas);
		const length = (name: string) => parseFloat(style.getPropertyValue(name));
		return {
			sizes: {
				min: length('--size-guess-min'),
				max: length('--size-guess-max'),
				gap: length('--size-guess-gap')
			},
			duration: matchMedia('(prefers-reduced-motion: reduce)').matches
				? 0
				: length('--duration-guess-glide'),
			easing: cubicBezier(style.getPropertyValue('--easing-guess-glide')),
			word: style.getPropertyValue('--color-guess-word'),
			marker: style.getPropertyValue('--color-guess-marker'),
			label: style.getPropertyValue('--color-surface-raised'),
			text: style.getPropertyValue('--color-text'),
			font: `${style.fontSize} ${style.fontFamily}`,
			padding: length('--space-inline')
		};
	}

	function percent(chance: number): string {
		return chance < 0.001 ? '<0.1%' : `${(chance * 100).toFixed(1)}%`;
	}

	$effect(() => {
		const { sizes } = tokens();
		balls = toBalls(guesses, sizes);
		places = settle(balls, places, sizes.gap);
		glide();
	});

	$effect(() => {
		const observer = new ResizeObserver(() => {
			const ratio = devicePixelRatio;
			width = canvas.clientWidth;
			height = canvas.clientHeight;
			canvas.width = Math.round(width * ratio);
			canvas.height = Math.round(height * ratio);
			canvas.getContext('2d')?.setTransform(ratio, 0, 0, ratio, 0, 0);
			glide();
		});
		observer.observe(canvas);
		return () => observer.disconnect();
	});

	/** Where every ball should be now: the resting places, scaled to fill the canvas. */
	function targets(): Map<string, Frame> {
		const { sizes } = tokens();
		let extent = 0;
		for (const ball of balls) {
			const at = places.get(ball.word);
			if (at) extent = Math.max(extent, Math.hypot(at.x, at.y) + ball.radius);
		}
		const room = Math.min(width, height) / 2 - sizes.gap;
		const scale = extent > 0 ? Math.min(MOST_ENLARGED, Math.max(0, room) / extent) : 1;
		return new Map(
			balls.map((ball) => {
				const at = places.get(ball.word) ?? { x: 0, y: 0 };
				return [
					ball.word,
					{ x: at.x * scale, y: at.y * scale, radius: ball.radius * scale, weight: ball.weight }
				];
			})
		);
	}

	/** Starts every ball gliding from wherever it is now to its new place. */
	function glide() {
		if (width === 0 || height === 0) return;
		const now = performance.now();
		const next = targets();
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- becomes `shown`, read only by the draw loop
		const glided = new Map<string, Shown>();
		for (const ball of balls) {
			const to = next.get(ball.word);
			if (!to) continue;
			const was = shown.get(ball.word);
			// A new word grows from nothing where it lands.
			const from = was ? frameAt(was, now) : { ...to, radius: 0, weight: 0 };
			glided.set(ball.word, { ball, from, to, leaving: false });
		}
		for (const [word, was] of shown) {
			if (glided.has(word) || was.leaving) continue;
			const from = frameAt(was, now);
			glided.set(word, {
				ball: was.ball,
				from,
				to: { ...from, radius: 0, weight: 0 },
				leaving: true
			});
		}
		shown = glided;
		glideStart = now;
		if (!gliding) {
			gliding = true;
			requestAnimationFrame(frame);
		}
	}

	function progress(now: number): number {
		const { duration, easing } = tokens();
		return duration === 0 ? 1 : easing(Math.min(1, (now - glideStart) / duration));
	}

	function frameAt({ from, to }: Shown, now: number): Frame {
		const t = gliding ? progress(now) : 1;
		const mix = (a: number, b: number) => a + (b - a) * t;
		return {
			x: mix(from.x, to.x),
			y: mix(from.y, to.y),
			radius: mix(from.radius, to.radius),
			weight: mix(from.weight, to.weight)
		};
	}

	function frame(now: number) {
		draw(now);
		if (progress(now) < 1) {
			requestAnimationFrame(frame);
			return;
		}
		gliding = false;
		for (const [word, ball] of shown) {
			if (ball.leaving) shown.delete(word);
			else ball.from = ball.to;
		}
		draw(now);
	}

	function draw(now: number) {
		const context = canvas.getContext('2d');
		if (!context) return;
		const look = tokens();
		const cx = width / 2;
		const cy = height / 2;
		context.clearRect(0, 0, width, height);

		// Likeliest last, so the words that matter sit on top.
		const frames = [...shown.values()]
			.map((ball) => ({ ball, at: frameAt(ball, now) }))
			.sort((a, b) => a.at.weight - b.at.weight);
		let pointed: { ball: Ball; at: Frame } | undefined;
		for (const { ball, at } of frames) {
			if (at.radius <= 0) continue;
			context.globalAlpha = FAINTEST + (1 - FAINTEST) * at.weight;
			context.fillStyle = ball.ball.marker ? look.marker : look.word;
			context.beginPath();
			context.arc(cx + at.x, cy + at.y, at.radius, 0, 2 * Math.PI);
			context.fill();
			const hit = Math.max(at.radius, look.sizes.min * 2);
			if (
				!ball.leaving &&
				pointer &&
				Math.hypot(pointer.x - cx - at.x, pointer.y - cy - at.y) < hit
			) {
				pointed = { ball: ball.ball, at };
			}
		}
		context.globalAlpha = 1;
		if (pointed)
			label(
				context,
				look,
				pointed.ball,
				{ x: cx + pointed.at.x, y: cy + pointed.at.y },
				pointed.at.radius
			);
	}

	/** The word and its chance beside the ball being pointed at, with a ring around the ball. */
	function label(
		context: CanvasRenderingContext2D,
		look: ReturnType<typeof tokens>,
		ball: Ball,
		at: Point,
		radius: number
	) {
		const text = `${ball.word} ${percent(ball.chance)}`;
		context.font = look.font;
		const metrics = context.measureText(text);
		const textHeight = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
		const boxWidth = metrics.width + look.padding * 2;
		const boxHeight = textHeight + look.padding * 2;
		const x = Math.min(width - boxWidth, Math.max(0, at.x + radius + look.padding));
		const y = Math.min(height - boxHeight, Math.max(0, at.y - radius - boxHeight));

		context.strokeStyle = look.text;
		context.lineWidth = look.sizes.gap;
		context.beginPath();
		context.arc(at.x, at.y, radius + look.sizes.gap, 0, 2 * Math.PI);
		context.stroke();

		context.fillStyle = look.label;
		context.fillRect(x, y, boxWidth, boxHeight);
		context.fillStyle = look.text;
		context.fillText(text, x + look.padding, y + look.padding + metrics.actualBoundingBoxAscent);
	}

	function point(event: PointerEvent) {
		const box = canvas.getBoundingClientRect();
		pointer = { x: event.clientX - box.left, y: event.clientY - box.top };
		if (!gliding) draw(performance.now());
	}

	function leave() {
		pointer = undefined;
		if (!gliding) draw(performance.now());
	}
</script>

<!-- What’s inside a canvas is read out in its place: the likeliest words, for screen readers. -->
<canvas bind:this={canvas} onpointermove={point} onpointerdown={point} onpointerleave={leave}>
	<p>Likeliest: {description}</p>
</canvas>

<style>
	canvas {
		display: block;
		inline-size: 100%;
		block-size: 100%;
		min-block-size: 0;
		font-size: var(--font-size-label);
		touch-action: manipulation;
	}
</style>
