<!-- Confirms resetting the model, which can’t be undone. -->
<script lang="ts">
	import ConfirmDialog from './ConfirmDialog.svelte';

	interface Props {
		onreset: () => void;
		onclose: () => void;
	}

	let { onreset, onclose }: Props = $props();
</script>

<ConfirmDialog
	title="Reset model?"
	description="Baby will forget everything it has ever read and start over knowing only “Hello”. This can’t be undone."
	confirm="Reset"
	onconfirm={onreset}
	{onclose}
/>
