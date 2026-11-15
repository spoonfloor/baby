<!--
	The next-word map: Baby’s reply as one cluster of every word it could have said,
	its own words lit (see GuessMap), over the reply itself in Baby’s words: as it’s
	said, or the reply it would likeliest give. Opens above the composer; `expanded`,
	it takes the place of the conversation.
-->
<script lang="ts">
	import type { ReplyStep } from '#lib/baby/index.ts';
	import GuessMap from './GuessMap.svelte';
	import IconButton from './IconButton.svelte';
	import MessageText from './MessageText.svelte';
	import Surface from './Surface.svelte';

	interface Props {
		/** The reply, word by word; empty shows nothing. */
		steps: readonly ReplyStep[];
		/** The reply is over (see GuessMap). */
		ended: boolean;
		/** The reply’s words under the map, typeset. */
		said: string;
		expanded: boolean;
		ontoggleexpanded: () => void;
		onclose: () => void;
	}

	let { steps, ended, said, expanded, ontoggleexpanded, onclose }: Props = $props();
</script>

<div class={['panel', { expanded }]}>
	<Surface>
		<div class="controls">
			<IconButton
				icon={expanded ? 'shrink' : 'enlarge'}
				label={expanded ? 'Shrink' : 'Enlarge'}
				onclick={ontoggleexpanded}
			/>
			<IconButton icon="close" label="Close" onclick={onclose} />
		</div>
		<div class="map">
			{#if steps.length > 0}
				<GuessMap {steps} {ended} />
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

	/* The surface fills the panel: the controls on top, the reply under the map, the map in the rest. */
	.panel > :global(.surface) {
		display: flex;
		flex: 1;
		flex-direction: column;
		gap: var(--space-tight);
		min-block-size: 0;
	}

	.controls {
		display: flex;
		justify-content: flex-end;
		gap: var(--space-inline);
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
