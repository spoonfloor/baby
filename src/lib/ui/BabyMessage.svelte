<script lang="ts">
	import type { Snippet } from 'svelte';
	import { typesetWords } from '#lib/baby/typeset.ts';
	import { END } from './guessMap.ts';
	import IconButton from './IconButton.svelte';
	import MessageText from './MessageText.svelte';
	import ProgressBar from './ProgressBar.svelte';
	import StatusLine from './StatusLine.svelte';

	/** How long the Graph can take to get ready before a progress bar says it’s coming, in ms. */
	const QUIET_WAIT = 300;

	interface Props {
		/** Baby’s words, as it said them (see typeset). */
		words: readonly string[];
		status: string;
		pending: boolean;
		/** Waiting its turn: an empty progress bar in place of a spinner. */
		waiting?: boolean | undefined;
		/** Cancels what Baby is doing, from a × after the status line; shown only while pending. */
		oncancel?: (() => void) | undefined;
		/** How far through its work Baby is, when it knows; shown only while pending. */
		progress?: { done: number; total: number } | undefined;
		/**
		 * A finished reply that can be looked into with the Graph, which opens under it
		 * from a chevron after its last word. While it’s open, the reply’s words point
		 * to their steps, and where Baby ended it is a last word of its own. Asked for
		 * before it’s ready, it opens once it is, a progress bar standing in for it if
		 * that takes a moment.
		 */
		inspect?:
			| {
					open: boolean;
					/** Asked for, but not ready to open yet. */
					waiting?: boolean;
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

	let {
		words,
		status,
		pending,
		waiting = false,
		oncancel,
		progress,
		inspect,
		graph,
		actions
	}: Props = $props();

	const written = $derived(typesetWords(words));
	/** The reply’s words while the Graph is open, the end among them. */
	const steps = $derived(inspect?.ended ? [...written, ` ${END}`] : written);

	/** The Graph has been waited for long enough to say it’s coming. */
	let slow = $state(false);
	$effect(() => {
		slow = false;
		if (!inspect?.waiting) return;
		const timer = setTimeout(() => (slow = true), QUIET_WAIT);
		return () => clearTimeout(timer);
	});
</script>

<div class="baby">
	{#if status || (oncancel && pending)}
		<div class="status">
			<!-- A progress bar shows activity itself, so the status line drops its spinner. -->
			<StatusLine text={status} active={pending && !waiting && !progress} />
			{#if oncancel && pending}
				<IconButton icon="close" label="Cancel" onclick={oncancel} />
			{/if}
		</div>
	{/if}
	{#if progress && pending}
		<ProgressBar done={progress.done} total={progress.total} />
	{:else if waiting && pending}
		<!-- Nothing done yet: the bare striped track, ready for the work to start. -->
		<ProgressBar done={0} total={1} />
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
						icon={inspect.open || inspect.waiting ? 'collapse' : 'expand'}
						label={inspect.open || inspect.waiting
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
	{:else if inspect?.waiting && slow && !pending}
		<ProgressBar done={0} total={1} />
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

	.status {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--space-inline);
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
