<script lang="ts">
	import { spawnBaby, type ReplyStep } from '#lib/baby/index.ts';
	import {
		describeKnowledge,
		describeNewWords,
		describeReading,
		readingStats
	} from '#lib/baby/reading.ts';
	import { typeset } from '#lib/baby/typeset.ts';
	import { Chat } from '#lib/chat/chat.svelte.ts';
	import { finishedPart } from '#lib/chat/draft.ts';
	import { noticeText } from '#lib/chat/notices.ts';
	import { transcript } from '#lib/chat/transcript.ts';
	import { groups, type Primer } from '#lib/library/index.ts';
	import AddMenu from '#lib/ui/AddMenu.svelte';
	import AppMessage from '#lib/ui/AppMessage.svelte';
	import BabyMessage from '#lib/ui/BabyMessage.svelte';
	import Button from '#lib/ui/Button.svelte';
	import Composer from '#lib/ui/Composer.svelte';
	import GuessPanel from '#lib/ui/GuessPanel.svelte';
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

	/** What’s in the composer, unsent. */
	let draft = $state('');
	/** The map of Baby’s guesses at its next word is open, and whether it fills the conversation’s place. */
	let showingGuesses = $state(false);
	let guessesExpanded = $state(false);
	const expanded = $derived(showingGuesses && guessesExpanded);
	/**
	 * The reply Baby would likeliest give to the finished words of the draft, word by
	 * word; with none finished, its reply to an empty message. Raw: replaced whole.
	 */
	let draftSteps: ReplyStep[] | undefined = $state.raw();
	/**
	 * The map follows Baby’s reply as it’s said, and keeps where it ended until you
	 * type again; otherwise it shows what Baby would likeliest say if the draft were sent.
	 */
	const followingReply = $derived(chat.replying || (chat.replySteps !== undefined && draft === ''));
	/** Before a reply’s first guesses arrive, the map keeps the draft’s. */
	const steps = $derived((followingReply ? chat.replySteps : undefined) ?? draftSteps ?? []);
	const replyEnded = $derived(!(followingReply && chat.replying));
	const said = $derived(typeset(steps.flatMap(({ picked }) => picked ?? [])));

	// Ask again whenever a word of the draft is finished, the conversation moves on
	// (`chat.guess` reads it), or Baby has read something (its state changes).
	$effect(() => {
		if (!showingGuesses || followingReply) return;
		const prompt = finishedPart(draft);
		void chat.knowledge;
		let current = true;
		chat.guess(prompt).then(
			(latest) => {
				if (current) draftSteps = latest;
			},
			// A debugging aid: the map just keeps its last guesses.
			(error) => console.error('Couldn’t get Baby’s guesses', error)
		);
		return () => (current = false);
	});

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

	/** The offer to teach a reply ends the turn it’s for, under Baby’s reply or the app’s notice after it. */
	function offersTeaching(id: string) {
		return chat.teachable?.after === id && chat.teaching === undefined;
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
	<Button inline icon="personEdit" onclick={startTeaching}>Teach a reply</Button>
{/snippet}

<div class={['page', { expanded }]}>
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
		{#if !empty && !expanded}
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
								actions={offersTeaching(message.id) ? teachLink : undefined}
							/>
						{:else}
							<AppMessage
								text={noticeText(message.notice, pointerVerb())}
								actions={offersTeaching(message.id) ? teachLink : undefined}
							/>
						{/if}
					</li>
				{/each}
			</ol>
		{/if}

		<!-- One composer for both states, so focus and draft text survive the first send. -->
		<div class={['composer', { expanded }]}>
			{#if showingGuesses}
				<GuessPanel
					{steps}
					ended={replyEnded}
					{said}
					expanded={guessesExpanded}
					ontoggleexpanded={() => (guessesExpanded = !guessesExpanded)}
					onclose={() => (showingGuesses = false)}
				/>
			{/if}
			<Composer
				bind:this={composer}
				bind:value={draft}
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
				{#snippet end()}
					<SettingsMenu
						resetDisabled={chat.reading || chat.replying}
						oncopytranscript={copyTranscript}
						onreset={() => (confirmingReset = true)}
					/>
				{/snippet}
			</Composer>
			<div class="offer">
				<Button inline app onclick={() => (showingGuesses = !showingGuesses)}>
					{showingGuesses ? 'Hide what Baby will say next' : 'What will Baby say next?'}
				</Button>
			</div>
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
		credit={primer.credit}
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

	/* The map of Baby’s guesses takes the conversation’s place: everything fits the screen. */
	.page.expanded {
		height: 100dvh;
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

	.page.expanded .chat {
		min-height: 0;
		padding-block-start: var(--space-gutter);
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
		display: flex;
		flex-direction: column;
		gap: var(--space-tight);
		padding-block-end: max(var(--space-gutter), env(safe-area-inset-bottom));
		background: var(--color-bg);
	}

	.composer.expanded {
		flex: 1;
		min-height: 0;
	}

	/* Lined up with the text in the composer above it. */
	.offer {
		padding-inline: var(--space-surface-inline);
	}
</style>
