<!--
	The next-word map with the app saying what it shows: Baby’s guesses at its next
	word, under what it has said so far. Opens above the composer; `expanded`, it takes
	the place of the conversation.
-->
<script lang="ts">
	import type { Guess } from '#lib/baby/index.ts';
	import GuessMap from './GuessMap.svelte';
	import IconButton from './IconButton.svelte';
	import MessageText from './MessageText.svelte';
	import Surface from './Surface.svelte';

	interface Props {
		/** What Baby has said so far in the reply the guesses are for, typeset; empty before it says anything. */
		said: string;
		/** Undefined until Baby’s first guesses arrive. */
		guesses: readonly Guess[] | undefined;
		expanded: boolean;
		ontoggleexpanded: () => void;
		onclose: () => void;
	}

	let { said, guesses, expanded, ontoggleexpanded, onclose }: Props = $props();
</script>

<div class={['panel', { expanded }]}>
	<Surface>
		<div class="heading">
			<p>Baby’s next word</p>
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
		<div class="said"><MessageText text={said} /></div>
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

	/* Baby’s own words, written as its replies are; a line is kept for them before it says any. */
	.said {
		min-block-size: 1lh;
	}
</style>
