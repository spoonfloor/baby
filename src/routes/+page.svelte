<script lang="ts">
	import { spawnBaby } from '#lib/baby/index.ts';
	import { Chat } from '#lib/chat/chat.svelte.ts';
	import { noticeText } from '#lib/chat/notices.ts';
	import AddMenu from '#lib/ui/AddMenu.svelte';
	import AppMessage from '#lib/ui/AppMessage.svelte';
	import BabyMessage from '#lib/ui/BabyMessage.svelte';
	import Composer from '#lib/ui/Composer.svelte';
	import { pointerVerb } from '#lib/ui/pointer.svelte.ts';
	import ReadDialog from '#lib/ui/ReadDialog.svelte';
	import { stickToBottom } from '#lib/ui/stickToBottom.ts';
	import UserMessage from '#lib/ui/UserMessage.svelte';

	const chat = new Chat(spawnBaby());
	const empty = $derived(chat.messages.length === 0);

	let reader: ReadDialog;
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
				<AddMenu disabled={chat.busy} onpaste={() => reader.show()} />
			{/snippet}
		</Composer>
	</div>
</main>

<ReadDialog bind:this={reader} onread={(text) => chat.read(text)} />

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
