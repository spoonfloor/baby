<!--
	A choice of a few options, side by side, one always chosen: a labeled radio group
	drawn as a recessed track with the chosen option lifted out of it.
-->
<script lang="ts" generics="T extends string">
	interface Props {
		label: string;
		options: { value: T; label: string }[];
		value: T;
	}

	let { label, options, value = $bindable() }: Props = $props();

	const id = $props.id();
</script>

<div class="choice">
	<span {id}>{label}</span>
	<div class="track" role="radiogroup" aria-labelledby={id}>
		{#each options as option (option.value)}
			<label class={{ chosen: value === option.value }}>
				<input type="radio" name={id} value={option.value} bind:group={value} />
				{option.label}
			</label>
		{/each}
	</div>
</div>

<style>
	.choice {
		display: flex;
		flex-direction: column;
		gap: var(--space-subtitle);
	}

	span {
		color: var(--color-text-muted);
		font-size: var(--font-size-label);
	}

	.track {
		display: flex;
		padding: var(--space-inline-tight);
		border-radius: var(--radius-pill);
		background: var(--color-choice-track);
	}

	label {
		flex: 1;
		padding: var(--space-inline-tight) 0;
		border-radius: var(--radius-pill);
		text-align: center;
		cursor: pointer;
	}

	.chosen {
		background: var(--color-choice-selected);
	}

	/* The radio itself is invisible but still focusable and announced; the label is its look. */
	input {
		position: absolute;
		opacity: 0;
		pointer-events: none;
	}

	label:has(input:focus-visible) {
		outline: auto;
	}
</style>
