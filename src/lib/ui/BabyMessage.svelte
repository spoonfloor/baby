<script lang="ts">
	import type { Snippet } from 'svelte';
	import { typesetWords } from '#lib/baby/typeset.ts';
	import { END } from './guessMap.ts';
	import IconButton from './IconButton.svelte';
	import MessageText from './MessageText.svelte';
	import ProgressBar from './ProgressBar.svelte';
	import StatusLine from './StatusLine.svelte';

	interface Props {
		/** Baby’s words, as it said them (see typeset). */
		words: readonly string[];
		status: string;
		pending: boolean;
		/** How far through its work Baby is, when it knows; shown only while pending. */
		progress?: { done: number; total: number } | undefined;
		/**
		 * A finished reply that can be looked into with the Graph, which opens under it
		 * from a chevron after its last word. While it’s open, the reply’s words point
		 * to their steps, and where Baby ended it is a last word of its own.
		 */
		inspect?:
			| {
					open: boolean;
					/** Baby ended the reply itself, rather than running out of room. */
					ended: boolean;
					/** The word the Graph is on, the rest dimmed: the end is the one after the last. */
					word: number;
					ontoggle: () => void;
					/** The word under the pointer, or undefined once it leaves the reply. */
					onpoint: (word: number | undefined) => void;
					onstep: (word: number) => void;
			  }
			| undefined;
		/** The Graph, under the reply while `inspect` is open. */
		graph?: Snippet | undefined;
		/** Things to do with a finished message, under it. */
		actions?: Snippet | undefined;
	}

	let { words, status, pending, progress, inspect, graph, actions }: Props = $props();

	const written = $derived(typesetWords(words));
	/** The reply’s words while the Graph is open, the end among them. */
	const steps = $derived(inspect?.ended ? [...written, ` ${END}`] : written);
</script>

<div class="baby">
	{#if status}
		<!-- A progress bar shows activity itself, so the status line drops its spinner. -->
		<StatusLine text={status} active={pending && !progress} />
	{/if}
	{#if progress && pending}
		<ProgressBar done={progress.done} total={progress.total} />
	{/if}
	<!-- The reply streams in behind the scenes but is shown all at once, when finished. -->
	{#if written.length > 0 && !pending}
		<div role="presentation" onpointerleave={() => inspect?.onpoint(undefined)}>
			<MessageText>
				{#if inspect?.open}
					{#each steps as word, index (index)}<button
							type="button"
							tabindex="-1"
							class={['word', { dim: inspect.word !== index }]}
							onpointermove={(event) => {
								// Only a mouse that moved: opening the Graph lays words out under a still one.
								if (event.pointerType === 'mouse' && (event.movementX || event.movementY)) {
									inspect.onpoint(index);
								}
							}}
							onclick={() => inspect.onstep(index)}>{word}</button
						>{/each}
				{:else}
					{written.join('')}
				{/if}
				{#if inspect}<IconButton
						inline
						icon={inspect.open ? 'collapse' : 'expand'}
						label={inspect.open
							? 'Hide how Baby picked each word'
							: 'Show how Baby picked each word'}
						aria-expanded={inspect.open}
						onclick={inspect.ontoggle}
					/>{/if}
			</MessageText>
		</div>
	{/if}
	{#if graph && inspect?.open && !pending}
		{@render graph()}
	{/if}
	{#if actions && !pending}
		<div>{@render actions()}</div>
	{/if}
</div>

<style>
	.baby {
		display: flex;
		flex-direction: column;
		gap: var(--space-tight);
	}

	/* A word is text that can be pointed at or tapped, not a button to look at. */
	.word {
		padding: 0;
		border: 0;
		background: none;
		cursor: pointer;
	}

	.dim {
		color: var(--color-text-muted);
	}
</style>
