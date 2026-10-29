<!-- The gear button and its menu of settings. -->
<script lang="ts">
	import Menu from './Menu.svelte';
	import Row from './Row.svelte';

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

<Menu icon="gear" label="Settings" placement="above-end">
	{#snippet children(close)}
		<ul>
			<li>
				<Row
					onclick={() => {
						close();
						oncopytranscript();
					}}
				>
					Copy transcript
				</Row>
			</li>
			<li>
				<Row
					disabled={resetDisabled}
					onclick={() => {
						close();
						onreset();
					}}
				>
					Reset model
				</Row>
			</li>
		</ul>
	{/snippet}
</Menu>
