<!--
	Documents exactly as Baby reads them: one token after another, separated by
	spaces. Each turn starts a new line after its [EOS], and markers like [EOS] are
	muted so the words stand out.
-->
<script lang="ts">
	import type { Document } from '#lib/baby/index.ts';
	import { EOS, isSpecial } from '#lib/baby/vocabulary.ts';

	let { documents }: { documents: Document[] } = $props();

	/** Splits a document after each [EOS], so every turn is its own line. */
	function lines(document: Document): string[][] {
		const result: string[][] = [[]];
		for (const token of document) {
			result.at(-1)?.push(token);
			if (token === EOS) result.push([]);
		}
		return result.filter((line) => line.length > 0);
	}
</script>

<div class="script">
	{#each documents as document, index (index)}
		<p>
			{#each lines(document) as line, index (index)}
				<span class="line">
					{#each line as token, index (index)}{index > 0 ? ' ' : ''}{#if isSpecial(token)}<span
								class="special">{token}</span
							>{:else}{token}{/if}{/each}
				</span>
			{/each}
		</p>
	{/each}
</div>

<style>
	.script {
		display: flex;
		flex-direction: column;
		gap: var(--space-tight);
	}

	p {
		margin: 0;
		overflow-wrap: anywhere;
	}

	.line {
		display: block;
	}

	.special {
		color: var(--color-text-muted);
	}
</style>
