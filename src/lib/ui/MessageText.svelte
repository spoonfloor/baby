<!-- Message body text. User and Baby messages share it so they always read the same. -->
<script lang="ts">
	let { text }: { text: string } = $props();
</script>

<p>{text}</p>

<style>
	p {
		margin: 0;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}
</style>
