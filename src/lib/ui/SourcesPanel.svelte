<!--
	What Baby has read and what it could read next, pinned to the top corner. Closed,
	it's a one-line title; open, it sums up what Baby knows and lists sources in groups
	that each open and close.
	It's the same width either way, and opening only grows it downward, over the page,
	so nothing under it moves. Clicking a source opens it (its preview).
-->
<script lang="ts">
	import Icon from './Icon.svelte';
	import Row from './Row.svelte';
	import Surface from './Surface.svelte';

	interface PanelSource {
		id: string;
		title: string;
		/** Baby has read it, so it's marked. */
		read: boolean;
		/** What reading it would add, e.g. “28 new words”; shown until it's read. */
		newWords: string;
	}

	interface PanelGroup {
		title: string;
		sources: PanelSource[];
	}

	interface Props {
		/** One line on what Baby knows, e.g. “Baby knows 412 words”. */
		summary: string;
		groups: PanelGroup[];
		/** Sources can't be opened (Baby is busy reading). */
		disabled?: boolean;
		onopen: (id: string) => void;
	}

	let { summary, groups, disabled = false, onopen }: Props = $props();

	let open = $state(true);

	/** Groups the user has opened, once they've toggled one; until then, the first one not finished. */
	let opened: string[] | undefined = $state();
	const shown = $derived(
		opened ??
			groups
				.filter((group) => group.sources.some((source) => !source.read))
				.slice(0, 1)
				.map((group) => group.title)
	);

	function toggle(title: string) {
		opened = shown.includes(title)
			? shown.filter((shownTitle) => shownTitle !== title)
			: [...shown, title];
	}
</script>

<div class="panel">
	<div class="sheet">
		<Surface>
			<button class="summary" type="button" aria-expanded={open} onclick={() => (open = !open)}>
				Sources
				<span class="mark"><Icon name={open ? 'collapse' : 'expand'} /></span>
			</button>
			{#if open}
				<div class="body">
					<p class="mark">{summary}</p>
					{#each groups as group (group.title)}
						{@const expanded = shown.includes(group.title)}
						<section>
							<Row muted aria-expanded={expanded} onclick={() => toggle(group.title)}>
								<span class="label">
									{group.title}
									<Icon name={expanded ? 'collapse' : 'expand'} small />
								</span>
								{group.sources.filter((source) => source.read).length} of {group.sources.length}
							</Row>
							{#if expanded}
								<ul>
									{#each group.sources as source (source.id)}
										<li>
											<Row {disabled} onclick={() => onopen(source.id)}>
												{source.title}
												{#if source.read}
													<span class="mark" aria-label="Read"><Icon name="check" /></span>
												{:else}
													<span class="mark">{source.newWords}</span>
												{/if}
											</Row>
										</li>
									{/each}
								</ul>
							{/if}
						</section>
					{/each}
				</div>
			{/if}
		</Surface>
	</div>
</div>

<style>
	/*
	 * Holds the closed panel's place (one line inside a surface, as tall as the composer),
	 * so opening it covers the page instead of pushing it down.
	 */
	.panel {
		position: relative;
		width: var(--width-panel);
		max-width: 100%;
		block-size: calc(1lh + 2 * var(--space-surface-block));
	}

	.sheet {
		position: absolute;
		inset: 0 0 auto;
	}

	/* One line tall, like the composer's field, so the closed panel matches its height. */
	.summary {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-inline);
		width: 100%;
		block-size: 1lh;
		padding: 0;
		border: none;
		background: none;
		cursor: pointer;
	}

	.body {
		display: flex;
		flex-direction: column;
		gap: var(--space-tight);
		margin-block-start: var(--space-tight);
		max-block-size: var(--height-panel-max);
		overflow-y: auto;
	}

	p {
		margin: 0;
	}

	.label {
		display: flex;
		align-items: center;
		gap: var(--space-inline-tight);
	}

	.mark {
		color: var(--color-text-muted);
	}

	ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}
</style>
