<!-- Confirms resetting the model, which can’t be undone. Cancel comes first, so it has focus. -->
<script lang="ts">
	import Button from './Button.svelte';
	import Dialog from './Dialog.svelte';

	interface Props {
		onreset: () => void;
		onclose: () => void;
	}

	let { onreset, onclose }: Props = $props();
</script>

<Dialog
	title="Reset model?"
	size="narrow"
	line={{
		description:
			'Baby will forget everything it has ever read and start from a blank slate. This can’t be undone.'
	}}
	{onclose}
>
	{#snippet actions(close)}
		<Button onclick={close}>Cancel</Button>
		<Button primary onclick={onreset}>Reset</Button>
	{/snippet}
</Dialog>
