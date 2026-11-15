<!--
	Steps through a sequence one at a time: a dot per step, the current one filled,
	between previous and next arrows. Click a dot to go there; point at one to
	preview it. Steps not ready yet show as rings and can’t be gone to.
-->
<script lang="ts">
	import IconButton from './IconButton.svelte';

	interface Props {
		/** What each step is, for its dot’s label. */
		labels: readonly string[];
		/** How many steps, from the first, can be gone to; the rest aren’t ready yet. */
		ready?: number;
		at: number;
		onstep: (step: number) => void;
		/** The step under the pointer, or undefined once it leaves the dots. */
		onpoint: (step: number | undefined) => void;
	}

	let { labels, ready = labels.length, at, onstep, onpoint }: Props = $props();
</script>

<div class="steps">
	<IconButton icon="previous" label="Previous" disabled={at === 0} onclick={() => onstep(at - 1)} />
	<div class="dots" role="presentation" onpointerleave={() => onpoint(undefined)}>
		{#each labels as label, index (index)}
			<button
				type="button"
				class={['dot', { current: index === at }]}
				disabled={index >= ready}
				aria-label={label}
				aria-current={index === at ? 'step' : undefined}
				onpointermove={(event) => {
					// Only a mouse that moved, as with the reply’s words.
					if (event.pointerType === 'mouse' && (event.movementX || event.movementY)) {
						onpoint(index);
					}
				}}
				onclick={() => onstep(index)}
			></button>
		{/each}
	</div>
	<IconButton
		icon="next"
		label="Next"
		disabled={at >= Math.min(labels.length, ready) - 1}
		onclick={() => onstep(at + 1)}
	/>
</div>

<style>
	.steps {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-inline);
	}

	.dots {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
	}

	/* The hit area is bigger than the dot drawn in it. */
	.dot {
		display: grid;
		place-items: center;
		inline-size: var(--size-step-dot-target);
		block-size: var(--size-step-dot-target);
		padding: 0;
		border: none;
		background: none;
		cursor: pointer;
	}

	.dot::before {
		inline-size: var(--size-step-dot);
		block-size: var(--size-step-dot);
		border-radius: 50%;
		background: var(--color-text-muted);
		content: '';
	}

	.dot.current::before {
		background: var(--color-text);
	}

	/* Not ready yet: a ring where the dot will be. */
	.dot:disabled {
		cursor: default;
	}

	.dot:disabled::before {
		box-shadow: inset 0 0 0 var(--width-step-dot-pending) var(--color-text-muted);
		background: none;
	}
</style>
