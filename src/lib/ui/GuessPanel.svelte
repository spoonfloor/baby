<!--
	The next-word map with the app saying what it shows: Baby’s guesses at the first
	word of its reply, if the finished words of the draft were sent. Opens above the
	composer; `expanded`, it takes the place of the conversation.
-->
<script lang="ts">
	import type { Guess } from '#lib/baby/index.ts';
	import GuessMap from './GuessMap.svelte';
	import IconButton from './IconButton.svelte';
	import Surface from './Surface.svelte';

	interface Props {
		/** The finished words of the draft the guesses are for; empty before any. */
		prompt: string;
		/** Undefined until Baby’s first guesses arrive. */
		guesses: readonly Guess[] | undefined;
		expanded: boolean;
		ontoggleexpanded: () => void;
		onclose: () => void;
	}

	let { prompt, guesses, expanded, ontoggleexpanded, onclose }: Props = $props();
</script>

<div class={['panel', { expanded }]}>
	<Surface>
		<div class="heading">
			<p>
				{prompt === ''
					? 'Baby’s first word if you sent nothing'
					: `Baby’s first word if you sent “${prompt}”`}
			</p>
			<IconButton
				icon={expanded ? 'shrink' : 'enlarge'}
				label={expanded ? 'Shrink' : 'Enlarge'}
				onclick={ontoggleexpanded}
			/>
			<IconButton icon="close" label="Close" onclick={onclose} />
		</div>
		<div class="map">
			{#if guesses}
				<GuessMap {guesses} />
			{/if}
		</div>
	</Surface>
</div>

<style>
	.panel {
		display: flex;
		flex-direction: column;
		block-size: var(--height-guess-panel);
	}

	.expanded {
		flex: 1;
		block-size: auto;
		min-block-size: 0;
	}

	/* The surface fills the panel: the heading on top, the map in the rest. */
	.panel > :global(.surface) {
		display: flex;
		flex: 1;
		flex-direction: column;
		gap: var(--space-tight);
		min-block-size: 0;
	}

	.heading {
		display: flex;
		align-items: center;
		gap: var(--space-inline);
		color: var(--color-app-voice);
		font-size: var(--font-size-label);
		font-style: var(--font-style-app-voice);
	}

	.heading p {
		flex: 1;
		min-width: 0;
		margin: 0;
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
	}

	.map {
		flex: 1;
		min-block-size: 0;
	}
</style>
