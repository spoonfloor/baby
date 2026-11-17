<!--
	The line under a dialog’s content about its latest action: what’s under way (muted),
	or what went wrong (in the app’s voice). Nothing when there’s neither.
-->
<script lang="ts">
	interface Props {
		working?: string | undefined;
		problem?: string | undefined;
	}

	let { working, problem }: Props = $props();
</script>

{#if working}
	<p class="working">{working}</p>
{:else if problem}
	<p class="problem">{problem}</p>
{/if}

<style>
	p {
		margin: 0;
	}

	.working {
		color: var(--color-text-muted);
	}

	.problem {
		color: var(--color-app-voice);
	}
</style>
