<!--
	Placeholder progress glyph, cycling ◐ ◓ ◑ ◒ old-school style. Approved animation
	(see APPROVED_ANIMATIONS in stylelint.config.js).
-->
<span class="spinner" aria-hidden="true"></span>

<style>
	.spinner::before {
		content: '◐';
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
