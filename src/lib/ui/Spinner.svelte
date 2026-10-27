<!--
	Placeholder progress glyph, cycling ◐ ◓ ◑ ◒ old-school style. Approved animation
	(see APPROVED_ANIMATIONS in stylelint.config.js). Shows a still ◐ when not spinning.
-->
<script lang="ts">
	let { spinning }: { spinning: boolean } = $props();
</script>

<span class={['spinner', { spinning }]} aria-hidden="true"></span>

<style>
	.spinner::before {
		content: '◐';
	}

	.spinning::before {
		animation: cycle var(--duration-spinner-cycle) steps(1, end) infinite;
	}

	@keyframes cycle {
		0% {
			content: '◐';
		}

		25% {
			content: '◓';
		}

		50% {
			content: '◑';
		}

		75% {
			content: '◒';
		}
	}
</style>
