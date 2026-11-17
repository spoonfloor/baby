<!-- A checkbox’s look, for a row that toggles: checked or not. The row carries the meaning (aria-pressed). -->
<script lang="ts">
	import Icon from './Icon.svelte';

	let { checked }: { checked: boolean } = $props();
</script>

<span class={['check', { checked }]} aria-hidden="true">
	{#if checked}
		<Icon name="check" small />
	{/if}
</span>

<style>
	.check {
		display: inline-flex;
		flex: none;
		align-items: center;
		justify-content: center;
		inline-size: var(--size-icon-small);
		block-size: var(--size-icon-small);
		border: var(--width-check-border) solid var(--color-check-border);
		border-radius: var(--radius-check);
	}

	.checked {
		border-color: var(--color-check);
		background: var(--color-check);
		color: var(--color-on-check);
	}
</style>
