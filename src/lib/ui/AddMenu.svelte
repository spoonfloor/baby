<!--
	The + button and its menu of ways to bring your own text for Baby to read.
	What we supply lives in the sources panel instead.
-->
<script lang="ts">
	import Menu from './Menu.svelte';
	import Row from './Row.svelte';

	interface Props {
		/** Read from URL was chosen. */
		onurl: () => void;
	}

	let { onurl }: Props = $props();
</script>

<Menu icon="plus" label="Give Baby something to read" placement="above-start">
	{#snippet children(close)}
		<ul>
			<!-- Shown so the menu’s shape is clear, but not built yet. -->
			<li><Row disabled>Upload text files</Row></li>
			<li>
				<Row
					onclick={() => {
						close();
						onurl();
					}}
				>
					Read from URL
				</Row>
			</li>
		</ul>
	{/snippet}
</Menu>
