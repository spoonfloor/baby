<!--
	The Graph: how Baby picked each word of a finished reply, one step at a time. The
	map shows the odds Baby had at the step (see GuessMap); dots under it step
	through the reply, as do the arrow keys. Each step can be gone to once it’s laid
	out (see graphLayout.svelte.ts), first to last. Opens under the reply it’s for.
-->
<script lang="ts">
	import type { ReplyStep } from '#lib/baby/index.ts';
	import { layOutReply } from './graphLayout.svelte.ts';
	import GuessMap from './GuessMap.svelte';
	import IconButton from './IconButton.svelte';
	import StepDots from './StepDots.svelte';
	import Surface from './Surface.svelte';

	interface Props {
		/** The reply, word by word. */
		steps: readonly ReplyStep[];
		/** The step the Graph is on. */
		at: number;
		/** A step being previewed (a word or dot pointed at), shown in place of `at`. */
		pointed?: number | undefined;
		onstep: (step: number) => void;
		onpoint: (step: number | undefined) => void;
		onclose: () => void;
	}

	let { steps, at, pointed, onstep, onpoint, onclose }: Props = $props();

	const showing = $derived(pointed ?? at);
	const last = $derived(steps.length - 1);
	const labels = $derived(steps.map(({ picked }) => picked ?? 'End'));
	const layout = $derived(layOutReply(steps));

	/** Goes to a step, if it’s laid out. */
	function goTo(step: number) {
		onstep(Math.max(0, Math.min(last, layout.ready - 1, step)));
	}

	/** Arrow keys step through, unless they’re moving a caret or something else has them. */
	function keydown(event: KeyboardEvent) {
		const { target } = event;
		const typing =
			target instanceof HTMLElement &&
			(target.isContentEditable || target.matches('input, textarea, select'));
		if (typing || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
		const by = event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0;
		if (by === 0) return;
		event.preventDefault();
		goTo(at + by);
	}
</script>

<svelte:window onkeydown={keydown} />

<div class="panel">
	<Surface>
		<div class="controls">
			<IconButton icon="close" label="Close" onclick={onclose} />
		</div>
		<div class="map">
			{#if layout.graph}
				<GuessMap graph={layout.graph} places={layout.places} step={showing} />
			{/if}
		</div>
		<StepDots {labels} ready={layout.ready} at={showing} onstep={goTo} {onpoint} />
	</Surface>
</div>

<style>
	.panel {
		display: flex;
		flex-direction: column;
		block-size: var(--height-guess-panel);
	}

	/* The surface fills the panel: the close button on top, the dots under the map, the map in the rest. */
	.panel > :global(.surface) {
		display: flex;
		flex: 1;
		flex-direction: column;
		gap: var(--space-tight);
		min-block-size: 0;
	}

	.controls {
		display: flex;
		justify-content: flex-end;
	}

	.map {
		flex: 1;
		min-block-size: 0;
	}
</style>
