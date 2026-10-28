<!--
	How much of a known amount of work is done. Jumps to each new value: no motion.
	Decorative, since the status line above it says the same in words.
-->
<script lang="ts">
	let { done, total }: { done: number; total: number } = $props();
</script>

<progress value={done} max={total} aria-hidden="true"></progress>

<style>
	progress {
		appearance: none;
		display: block;
		inline-size: 100%;
		max-inline-size: var(--measure);
		block-size: var(--height-progress);
		border: none;
		border-radius: var(--radius-pill);
		overflow: hidden;
		background: var(--color-progress-track);
		color: var(--color-progress);
	}

	progress::-webkit-progress-bar {
		background: var(--color-progress-track);
	}

	progress::-webkit-progress-value {
		background: var(--color-progress);
	}

	progress::-moz-progress-bar {
		background: var(--color-progress);
	}
</style>
