<!--
	The + button and its menu of ways to bring your own text for Baby to read.
	What we supply lives in the sources panel instead.
-->
<script lang="ts">
	import Menu from './Menu.svelte';
	import Row from './Row.svelte';
</script>

<Menu icon="plus" label="Give Baby something to read" placement="above-start">
	<!-- Shown so the menu’s shape is clear, but not built yet. -->
	<ul>
		<li><Row disabled>Upload text files</Row></li>
		<li><Row disabled>Read from URL</Row></li>
	</ul>
</Menu>
