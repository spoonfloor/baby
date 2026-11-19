<!--
	The + button and its menu of ways to bring your own text for Baby to read.
	What we supply lives in the sources panel instead.
-->
<script lang="ts">
	import Menu from './Menu.svelte';
	import Row from './Row.svelte';

	interface Props {
		/** The file types Upload text files offers, as the file input’s `accept`. */
		accept: string;
		/** Files were chosen to upload. */
		onfiles: (files: File[]) => void;
		/** Read from URL was chosen. */
		onurl: () => void;
	}

	let { accept, onfiles, onurl }: Props = $props();
	let picker: HTMLInputElement;

	function picked() {
		const files = [...(picker.files ?? [])];
		picker.value = '';
		if (files.length > 0) onfiles(files);
	}
</script>

<Menu icon="plus" label="Give Baby something to read" placement="above-start">
	{#snippet children(close)}
		<ul>
			<li>
				<Row
					onclick={() => {
						close();
						picker.click();
					}}
				>
					Upload text files
				</Row>
			</li>
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
<input bind:this={picker} type="file" multiple {accept} hidden onchange={picked} />
