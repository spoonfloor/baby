<script lang="ts">
	import '@fontsource-variable/inter';
	import '@fontsource/ibm-plex-sans-condensed/400.css';
	import '#lib/styles/tokens.css';
	import '#lib/styles/base.css';

	let { children } = $props();
</script>

{@render children()}
