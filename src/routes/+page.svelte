<script lang="ts">
	import { spawnBaby } from '#lib/baby/index.ts';
	import { describeReading, readingStats } from '#lib/baby/reading.ts';
	import { Chat } from '#lib/chat/chat.svelte.ts';
	import { noticeText } from '#lib/chat/notices.ts';
	import { shelves, type Pack } from '#lib/library/index.ts';
	import AddMenu from '#lib/ui/AddMenu.svelte';
	import AppMessage from '#lib/ui/AppMessage.svelte';
	import BabyMessage from '#lib/ui/BabyMessage.svelte';
	import Composer from '#lib/ui/Composer.svelte';
	import PackDialog from '#lib/ui/PackDialog.svelte';
	import { pointerVerb } from '#lib/ui/pointer.svelte.ts';
	import { stickToBottom } from '#lib/ui/stickToBottom.ts';
	import UserMessage from '#lib/ui/UserMessage.svelte';

	const chat = new Chat(spawnBaby());
	const empty = $derived(chat.messages.length === 0);

	const packs = new Map(shelves.flatMap((shelf) => shelf.packs.map((pack) => [pack.id, pack])));
	const menuShelves = $derived(
		shelves.map((shelf) => ({
			...shelf,
			packs: shelf.packs.map(({ id, title }) => ({ id, title, read: chat.readPacks.has(id) }))
		}))
	);
	const known = $derived(new Set(chat.knowledge?.words));

	/** The pack being previewed. Raw, not deeply reactive: packs never change, and Baby’s worker can only be sent plain data. */
	let previewing: Pack | undefined = $state.raw();

	function read(pack: Pack) {
		previewing = undefined;
		chat.read(pack);
	}
</script>

<main class={['chat', { empty }]}>
	{#if !empty}
		<ol class="transcript" {@attach stickToBottom}>
			{#each chat.messages as message (message.id)}
				<li>
					{#if message.role === 'user'}
						<UserMessage text={message.text} />
					{:else if message.role === 'baby'}
						<BabyMessage text={message.text} status={message.status} pending={message.pending} />
					{:else}
						<AppMessage text={noticeText(message.notice, pointerVerb())} />
					{/if}
				</li>
			{/each}
		</ol>
	{/if}

	<!-- One composer for both states, so focus and draft text survive the first send. -->
	<div class="composer">
		<Composer
			placeholder={empty ? 'Say hi to Baby' : 'Reply'}
			ready={!chat.busy}
			onsend={(text) => chat.send(text)}
		>
			{#snippet start()}
				<AddMenu
					disabled={chat.busy}
					shelves={menuShelves}
					onopen={(id) => (previewing = packs.get(id))}
				/>
			{/snippet}
		</Composer>
	</div>
</main>

{#if previewing}
	{@const pack = previewing}
	<PackDialog
		title={pack.title}
		summary={describeReading(readingStats(pack.documents, (word) => known.has(word)))}
		documents={pack.documents}
		read={chat.readPacks.has(pack.id)}
		onread={() => read(pack)}
		onclose={() => (previewing = undefined)}
	/>
{/if}

<style>
	.chat {
		display: flex;
		flex-direction: column;
		min-height: 100dvh;
		max-width: var(--width-content);
		margin-inline: auto;
		padding-inline: var(--space-gutter);
	}

	.chat.empty {
		justify-content: center;
	}

	.transcript {
		display: flex;
		flex: 1;
		flex-direction: column;
		gap: var(--space-stack);
		margin: 0;
		padding: var(--space-gutter) 0 var(--space-stack);
		list-style: none;
	}

	.composer {
		position: sticky;
		bottom: 0;
		padding-block-end: max(var(--space-gutter), env(safe-area-inset-bottom));
		background: var(--color-bg);
	}
</style>
