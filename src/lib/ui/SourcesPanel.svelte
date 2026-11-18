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
		/** Shown at the end of the row in place of the read mark, e.g. “28 new words”, “4 replies”. */
		note?: string | undefined;
	}

	interface PanelGroup {
		title: string;
		/** Shown at the end of the group’s row in place of how many are read (“1 of 5”), e.g. “41 replies”. */
		tally?: string;
		sources: PanelSource[];
	}

	interface Props {
		/** One line on what Baby knows, e.g. “Baby knows 412 words”. */
		summary: string;
		groups: PanelGroup[];
		/** Sources can't be opened (Baby is busy reading). */
		disabled?: boolean;
		/** Showing the sources, not just the title. Closed until the user opens it. */
		open?: boolean;
		/**
		 * Titles of the open groups, once the user has toggled one (or the page has
		 * opened one for them); until then, the first one not finished is open.
		 */
		expanded?: string[] | undefined;
		onopen: (id: string) => void;
	}

	let {
		summary,
		groups,
		disabled = false,
		open = $bindable(false),
		expanded = $bindable(),
		onopen
	}: Props = $props();

	const shown = $derived(
		expanded ??
			groups
				.filter((group) => group.sources.some((source) => !source.read))
				.slice(0, 1)
				.map((group) => group.title)
	);

	function toggle(title: string) {
		expanded = shown.includes(title)
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
					<p class="mark label-size">{summary}</p>
					{#each groups as group (group.title)}
						{@const expanded = shown.includes(group.title)}
						<section>
							<Row muted aria-expanded={expanded} onclick={() => toggle(group.title)}>
								<span class="label label-size">
									{group.title}
									<Icon name={expanded ? 'collapse' : 'expand'} small />
								</span>
								{group.tally ??
									`${group.sources.filter((source) => source.read).length} of ${group.sources.length}`}
							</Row>
							{#if expanded}
								<ul>
									{#each group.sources as source (source.id)}
										<li>
											<Row {disabled} onclick={() => onopen(source.id)}>
												<span class="title">{source.title}</span>
												{#if source.note !== undefined}
													<span class="mark">{source.note}</span>
												{:else if source.read}
													<span class="mark" aria-label="Read"><Icon name="check" /></span>
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
		font-weight: var(--font-weight-strong);
		cursor: pointer;
	}

	/*
	 * The summary hugs the title as its subtitle and stands apart from the groups.
	 */
	.body {
		margin-block-start: var(--space-subtitle);
		max-block-size: var(--height-panel-max);
		overflow-y: auto;
	}

	p {
		margin: 0 0 var(--space-section);
	}

	/* A little more room between groups than between rows, so each group reads as one. */
	section + section {
		margin-block-start: var(--space-heading);
	}

	.label {
		display: flex;
		align-items: center;
		gap: var(--space-inline-tight);
		font-weight: var(--font-weight-strong);
	}

	.label-size {
		font-size: var(--font-size-label);
	}

	.mark {
		color: var(--color-text-muted);
	}

	/*
	 * A source’s title takes the row’s room and wraps, up to a limit, ending in “…”
	 * past it (the preview shows it whole). Its count or mark keeps its width and
	 * sits on the title’s first line.
	 */
	.title {
		display: -webkit-box;
		flex: 1;
		min-inline-size: 0;
		overflow: hidden;
		overflow-wrap: break-word;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: var(--lines-row-title);
		line-clamp: var(--lines-row-title);
	}

	li .mark {
		display: flex;
		flex-shrink: 0;
		align-items: center;
		align-self: flex-start;
		min-block-size: 1lh;
		white-space: nowrap;
	}

	ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}
</style>
