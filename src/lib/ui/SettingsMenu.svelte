<!-- The gear button and its menu of settings. -->
<script lang="ts">
	import Menu from './Menu.svelte';

	interface Props {
		disabled?: boolean;
		/** Reset model was chosen; the caller confirms before resetting. */
		onreset: () => void;
	}

	let { disabled = false, onreset }: Props = $props();
</script>

<Menu icon="gear" label="Settings" placement="below-end" {disabled}>
	{#snippet children(close)}
		<ul>
			<li>
				<button
					onclick={() => {
						close();
						onreset();
					}}
				>
					Reset model
				</button>
			</li>
		</ul>
	{/snippet}
</Menu>
