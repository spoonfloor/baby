<script lang="ts">
	import { spawnBaby } from '#lib/baby/index.ts';
	import {
		describeKnowledge,
		describeNewWords,
		describeReading,
		readingStats
	} from '#lib/baby/reading.ts';
	import { typeset } from '#lib/baby/typeset.ts';
	import { Chat } from '#lib/chat/chat.svelte.ts';
	import { noticeText } from '#lib/chat/notices.ts';
	import { transcript } from '#lib/chat/transcript.ts';
	import { groups, type Primer } from '#lib/library/index.ts';
	import AddMenu from '#lib/ui/AddMenu.svelte';
	import AppMessage from '#lib/ui/AppMessage.svelte';
	import BabyMessage from '#lib/ui/BabyMessage.svelte';
	import Button from '#lib/ui/Button.svelte';
	import Composer from '#lib/ui/Composer.svelte';
	import { pointerVerb } from '#lib/ui/pointer.svelte.ts';
	import ResetDialog from '#lib/ui/ResetDialog.svelte';
	import SettingsMenu from '#lib/ui/SettingsMenu.svelte';
	import SourceDialog from '#lib/ui/SourceDialog.svelte';
	import SourcesPanel from '#lib/ui/SourcesPanel.svelte';
	import { stickToBottom } from '#lib/ui/stickToBottom.ts';
	import UserMessage from '#lib/ui/UserMessage.svelte';

	const chat = new Chat(spawnBaby());
	const empty = $derived(chat.messages.length === 0);

	const primers = new Map(
		groups.flatMap((group) => group.primers.map((primer) => [primer.id, primer]))
	);
	const known = $derived(new Set(chat.knowledge?.words));
	const panelGroups = $derived(
		groups.map(({ title, primers }) => ({
			title,
			sources: primers.map(({ id, title, documents }) => ({
				id,
				title,
				read: chat.readSources.includes(id),
				newWords: describeNewWords(readingStats(documents, (word) => known.has(word)).newWords)
			}))
		}))
	);
	const bottom = stickToBottom();
	let composer: Composer;

	/** The primer being previewed. Raw, not deeply reactive: primers never change, and Baby’s worker can only be sent plain data. */
	let previewing: Primer | undefined = $state.raw();

	/** The Reset model confirmation is open. */
	let confirmingReset = $state(false);

	function read(primer: Primer) {
		previewing = undefined;
		chat.read(primer);
	}

	async function copyTranscript() {
		const text = transcript(chat.messages, {
			knowledge: chat.knowledge,
			primers: [...primers.values()],
			noticeText: (notice) => noticeText(notice, pointerVerb()),
			at: new Date()
		});
		try {
			await navigator.clipboard.writeText(text);
		} catch (error) {
			// A debugging aid: say why in the console rather than in the conversation.
			console.error('Couldn’t copy the transcript', error);
		}
	}

	function startTeaching() {
		chat.startTeaching();
		composer.focus();
	}

	function reset() {
		confirmingReset = false;
		chat.reset();
	}
</script>

{#snippet teachLink()}
	<Button inline onclick={startTeaching}>Teach a reply</Button>
{/snippet}

<div class="page">
	<header class="toolbar">
		<SourcesPanel
			summary={describeKnowledge(known.size)}
			groups={panelGroups}
			disabled={chat.reading}
			onopen={(id) => (previewing = primers.get(id))}
		/>
	</header>

	<!-- The transcript and the composer both grow (a reply streaming, a draft wrapping), so follow them together. -->
	<main class={['chat', { empty }]} {@attach bottom.attachment}>
		{#if !empty}
			<ol class="transcript">
				{#each chat.messages as message (message.id)}
					<li>
						{#if message.role === 'user'}
							<UserMessage
								text={message.text}
								label={message.replyTo === undefined
									? undefined
									: `Your reply to “${message.replyTo}”`}
							/>
						{:else if message.role === 'baby'}
							<BabyMessage
								text={typeset(message.text.split(' '))}
								status={message.status}
								pending={message.pending}
								progress={message.progress}
								actions={chat.teachable?.reply === message.id && chat.teaching === undefined
									? teachLink
									: undefined}
							/>
						{:else}
							<AppMessage text={noticeText(message.notice, pointerVerb())} />
						{/if}
					</li>
				{/each}
			</ol>
		{/if}

		<!-- One composer for both states, so focus and draft text survive the first send. -->
		<div class="composer">
			<div class="field">
				<Composer
					bind:this={composer}
					placeholder={chat.teaching !== undefined
						? 'What should Baby say?'
						: empty
							? 'Say hi to Baby'
							: 'Reply'}
					ready={chat.teaching !== undefined ? !chat.reading : !chat.replying}
					note={chat.teaching === undefined
						? undefined
						: {
								text: `Teaching Baby a reply to “${chat.teaching}”`,
								oncancel: () => chat.cancelTeaching()
							}}
					onsend={(text) => {
						bottom.pin();
						if (chat.teaching !== undefined) chat.teach(text);
						else chat.send(text);
					}}
				>
					{#snippet start()}
						<AddMenu />
					{/snippet}
				</Composer>
			</div>
			<SettingsMenu
				resetDisabled={chat.reading || chat.replying}
				oncopytranscript={copyTranscript}
				onreset={() => (confirmingReset = true)}
			/>
		</div>
	</main>
</div>

{#if confirmingReset}
	<ResetDialog onreset={reset} onclose={() => (confirmingReset = false)} />
{/if}

{#if previewing}
	{@const primer = previewing}
	<SourceDialog
		title={primer.title}
		summary={describeReading(readingStats(primer.documents, (word) => known.has(word)))}
		documents={primer.documents}
		read={chat.readSources.includes(primer.id)}
		onread={() => read(primer)}
		onclose={() => (previewing = undefined)}
	/>
{/if}

<style>
	.page {
		display: flex;
		flex-direction: column;
		min-height: 100dvh;
	}

	/* Pinned to the top as the composer is to the bottom, so messages scroll beneath it. */
	.toolbar {
		position: sticky;
		top: 0;

		/* The open sources panel hangs below the toolbar, over the conversation and composer. */
		z-index: 1;
		display: flex;
		justify-content: flex-end;
		padding: max(var(--space-gutter), env(safe-area-inset-top)) var(--space-gutter) 0;
		background: var(--color-bg);
	}

	.chat {
		display: flex;
		flex-direction: column;
		flex: 1;
		width: 100%;
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

	/* The settings gear sits beside the composer, at the bottom end. */
	.composer {
		position: sticky;
		bottom: 0;
		display: flex;
		align-items: center;
		gap: var(--space-inline);
		padding-block-end: max(var(--space-gutter), env(safe-area-inset-bottom));
		background: var(--color-bg);
	}

	.field {
		flex: 1;
	}
</style>
