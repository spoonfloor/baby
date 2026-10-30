<!--
	How much of a known amount of work is done. The fill jumps to each new value; diagonal
	stripes move right to left through the track to show work is still going. Approved
	animation (see APPROVED_ANIMATIONS in stylelint.config.js).
	Decorative, since the status line above it says the same in words.
-->
<script lang="ts">
	let { done, total }: { done: number; total: number } = $props();
</script>

<progress value={done} max={total} aria-hidden="true"></progress>

<style>
	progress {
		/* One stripe and one gap at 45°, measured along the bar: a seamless repeat. */
		--stripe-repeat: calc(var(--width-progress-stripe) * 2 * sqrt(2));

		appearance: none;
		display: block;
		inline-size: 100%;
		max-inline-size: var(--measure);
		block-size: var(--height-progress);
		border: none;
		border-radius: var(--radius-pill);
		overflow: hidden;
		background-color: var(--color-progress-track);
		background-image: repeating-linear-gradient(
			-45deg,
			var(--color-progress-track) 0 var(--width-progress-stripe),
			var(--color-progress-stripe) var(--width-progress-stripe)
				calc(var(--width-progress-stripe) * 2)
		);
		background-size: var(--stripe-repeat) var(--stripe-repeat);
		color: var(--color-progress);
		animation: stripes var(--duration-progress-stripe) linear infinite;
	}

	/* The track is the element itself, so its stripes show through. */
	progress::-webkit-progress-bar {
		background: transparent;
	}

	progress::-webkit-progress-value {
		background: var(--color-progress);
	}

	progress::-moz-progress-bar {
		background: var(--color-progress);
	}

	@keyframes stripes {
		to {
			background-position: calc(-1 * var(--stripe-repeat)) 0;
		}
	}
</style>
