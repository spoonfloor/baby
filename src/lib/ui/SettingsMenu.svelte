<!-- The gear button and its menu of settings. -->
<script lang="ts">
	import Menu from './Menu.svelte';

	interface Props {
		/** Reset model can’t be chosen (Baby is busy). */
		resetDisabled?: boolean;
		/** Copy transcript was chosen. */
		oncopytranscript: () => void;
		/** Reset model was chosen; the caller confirms before resetting. */
		onreset: () => void;
	}

	let { resetDisabled = false, oncopytranscript, onreset }: Props = $props();
</script>

<Menu icon="gear" label="Settings" placement="below-end">
	{#snippet children(close)}
		<ul>
			<li>
				<button
					onclick={() => {
						close();
						oncopytranscript();
					}}
				>
					Copy transcript
				</button>
			</li>
			<li>
				<button
					disabled={resetDisabled}
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
