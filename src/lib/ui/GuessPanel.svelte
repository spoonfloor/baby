<!--
	The Graph: Baby’s reply played back one word at a time. At each step the map shows
	the odds Baby had at that word (see GuessMap), and the reply line under it gains
	the word Baby picked, until the reply ends; a reply being said is followed as it
	comes. Another reply starts over from its first word. Point at a word (or tap it)
	to see its step, or step through with the arrow buttons or keys; the other words
	dim. Each word fades in on the map’s glide. Approved animation (see
	APPROVED_ANIMATIONS in stylelint.config.js). Opens above the composer; `expanded`,
	it takes the place of the conversation.
-->
<script lang="ts">
	import { untrack } from 'svelte';
	import type { ReplyStep } from '#lib/baby/index.ts';
	import { typesetWords } from '#lib/baby/typeset.ts';
	import AppMessage from './AppMessage.svelte';
	import GuessMap from './GuessMap.svelte';
	import { continues, stepDuration, wordLook } from './guessPlayback.ts';
	import IconButton from './IconButton.svelte';
	import MessageText from './MessageText.svelte';
	import Surface from './Surface.svelte';

	interface Props {
		/** The reply, word by word; empty shows nothing. */
		steps: readonly ReplyStep[];
		/** The reply is over (see GuessMap). */
		ended: boolean;
		expanded: boolean;
		/** Shows this step without playing, as if stepped to: for design review. */
		start?: number | undefined;
		ontoggleexpanded: () => void;
		onclose: () => void;
	}

	let { steps, ended, expanded, start, ontoggleexpanded, onclose }: Props = $props();

	let panel: HTMLDivElement;
	/** The step playback is at, and the furthest it has reached in this reply. */
	let at = $state(untrack(() => start ?? 0));
	let reached = $state(untrack(() => start ?? 0));
	/** Playback moves on by itself, following the reply as it’s said; stepping by hand stops it. */
	let following = $state(untrack(() => start === undefined));
	/** The word under the pointer: its step shows while it’s pointed at. */
	let pointed: number | undefined = $state();
	let played: readonly ReplyStep[] = [];

	const last = $derived(Math.max(0, steps.length - 1));
	const shown = $derived(Math.min(pointed ?? at, last));
	const focused = $derived(pointed !== undefined || !following);
	const words = $derived(typesetWords(steps.flatMap(({ picked }) => picked ?? [])));

	// Another reply plays from its first word; more of the same one carries on.
	$effect.pre(() => {
		const latest = steps;
		untrack(() => {
			if (!continues(played, latest) && played !== latest) {
				at = reached = start ?? 0;
				following = start === undefined;
				pointed = undefined;
			}
			played = latest;
		});
	});

	$effect(() => {
		if (!following || at >= last) return;
		const style = getComputedStyle(panel);
		const duration = stepDuration(steps.length, {
			step: parseFloat(style.getPropertyValue('--duration-guess-step')),
			total: parseFloat(style.getPropertyValue('--duration-guess-playback'))
		});
		const timer = setTimeout(() => goTo(at + 1), duration);
		return () => clearTimeout(timer);
	});

	function goTo(step: number) {
		at = Math.max(0, Math.min(last, step));
		reached = Math.max(reached, at);
	}

	function stepBy(by: number) {
		following = false;
		goTo(at + by);
	}

	/** Arrow keys step through, unless they’re moving a caret or something else has them. */
	function keydown(event: KeyboardEvent) {
		const { target } = event;
		const typing =
			target instanceof HTMLElement &&
			(target.isContentEditable || target.matches('input, textarea, select'));
		if (typing || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
		const by = event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0;
		if (by === 0 || steps.length === 0) return;
		event.preventDefault();
		stepBy(by);
	}

	function point(event: PointerEvent, index: number) {
		// Touch has no pointing without tapping: a tap steps there instead.
		if (event.pointerType === 'mouse') pointed = index;
	}
</script>

<svelte:window onkeydown={keydown} />

<div class={['panel', { expanded }]} bind:this={panel}>
	<Surface>
		<div class="controls">
			<div class="headline">
				<AppMessage
					text="Baby picks each word based on all the words before it, yours and its own."
				/>
			</div>
			<IconButton
				icon="previous"
				label="Previous word"
				disabled={steps.length === 0 || shown === 0}
				onclick={() => stepBy(-1)}
			/>
			<IconButton
				icon="next"
				label="Next word"
				disabled={steps.length === 0 || shown === last}
				onclick={() => stepBy(1)}
			/>
			<IconButton
				icon={expanded ? 'shrink' : 'enlarge'}
				label={expanded ? 'Shrink' : 'Enlarge'}
				onclick={ontoggleexpanded}
			/>
			<IconButton icon="close" label="Close" onclick={onclose} />
		</div>
		<div class="map">
			{#if steps[shown]}
				<GuessMap step={steps[shown]} ended={ended && shown === last} {expanded} />
			{/if}
		</div>
		<!-- Baby’s own words, written as its replies are; a line is kept for them before it says any. -->
		<div class="said" role="presentation" onpointerleave={() => (pointed = undefined)}>
			<MessageText>
				{#each words as word, index (index)}<button
						type="button"
						tabindex="-1"
						class={['word', wordLook(index, { at: shown, reached, focused, steps })]}
						onpointerenter={(event) => point(event, index)}
						onclick={() => {
							following = false;
							goTo(index);
						}}>{word}</button
					>{/each}
			</MessageText>
		</div>
	</Surface>
</div>

<style>
	.panel {
		display: flex;
		flex-direction: column;
		block-size: var(--height-guess-panel);
	}

	.expanded {
		flex: 1;
		block-size: auto;
		min-block-size: 0;
	}

	/* The surface fills the panel: the controls on top, the reply under the map, the map in the rest. */
	.panel > :global(.surface) {
		display: flex;
		flex: 1;
		flex-direction: column;
		gap: var(--space-tight);
		min-block-size: 0;
	}

	.controls {
		display: flex;
		align-items: flex-start;
		gap: var(--space-inline);
	}

	.headline {
		flex: 1;
	}

	.map {
		flex: 1;
		min-block-size: 0;
	}

	.said {
		min-block-size: 1lh;
	}

	/* A word is text that can be pointed at or tapped, not a button to look at. */
	.word {
		padding: 0;
		border: 0;
		background: none;
		cursor: pointer;
		transition:
			opacity var(--duration-guess-glide) var(--easing-guess-glide),
			color var(--duration-guess-glide) var(--easing-guess-glide);
	}

	.hidden {
		opacity: 0;
		pointer-events: none;
	}

	.dim {
		color: var(--color-text-muted);
	}

	@media (prefers-reduced-motion: reduce) {
		.word {
			transition: none;
		}
	}
</style>
