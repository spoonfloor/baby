<!--
	Steps through a sequence one at a time: a dot per step, the current one filled,
	between previous and next arrows. Click a dot to go there; point at one to
	preview it.
-->
<script lang="ts">
	import IconButton from './IconButton.svelte';

	interface Props {
		/** What each step is, for its dot’s label. */
		labels: readonly string[];
		at: number;
		onstep: (step: number) => void;
		/** The step under the pointer, or undefined once it leaves the dots. */
		onpoint: (step: number | undefined) => void;
	}

	let { labels, at, onstep, onpoint }: Props = $props();
</script>

<div class="steps">
	<IconButton icon="previous" label="Previous" disabled={at === 0} onclick={() => onstep(at - 1)} />
	<div class="dots" role="presentation" onpointerleave={() => onpoint(undefined)}>
		{#each labels as label, index (index)}
			<button
				type="button"
				class={['dot', { current: index === at }]}
				aria-label={label}
				aria-current={index === at ? 'step' : undefined}
				onpointerenter={(event) => {
					if (event.pointerType === 'mouse') onpoint(index);
				}}
				onclick={() => onstep(index)}
			></button>
		{/each}
	</div>
	<IconButton
		icon="next"
		label="Next"
		disabled={at === labels.length - 1}
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
</style>
