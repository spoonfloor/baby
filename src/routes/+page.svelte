<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { spawnBaby } from '#lib/baby/index.ts';
	import {
		describeKnowledge,
		describeNewWords,
		describeReading,
		readingStats
	} from '#lib/baby/reading.ts';
	import { Chat, TAUGHT_SOURCE } from '#lib/chat/chat.svelte.ts';
	import { noticeText } from '#lib/chat/notices.ts';
	import { transcript } from '#lib/chat/transcript.ts';
	import { groups, type Primer } from '#lib/library/index.ts';
	import { Saves } from '#lib/saves/saves.svelte.ts';
	import SavesFlow from '#lib/saves/SavesFlow.svelte';
	import AddMenu from '#lib/ui/AddMenu.svelte';
	import AppMessage from '#lib/ui/AppMessage.svelte';
	import BabyMessage from '#lib/ui/BabyMessage.svelte';
	import Button from '#lib/ui/Button.svelte';
	import Composer from '#lib/ui/Composer.svelte';
	import { layOutReply } from '#lib/ui/graphLayout.svelte.ts';
	import GuessPanel from '#lib/ui/GuessPanel.svelte';
	import { pointerIsFinger, pointerVerb } from '#lib/ui/pointer.svelte.ts';
	import ResetDialog from '#lib/ui/ResetDialog.svelte';
	import SettingsMenu from '#lib/ui/SettingsMenu.svelte';
	import SourceDialog from '#lib/ui/SourceDialog.svelte';
	import SourcesPanel from '#lib/ui/SourcesPanel.svelte';
	import { stickToBottom } from '#lib/ui/stickToBottom.ts';
	import UserMessage from '#lib/ui/UserMessage.svelte';

	const chat = new Chat(spawnBaby());
	const saves = new Saves(chat);
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

	/** The Saves dialog is open. */
	let savesOpen = $state(false);

	/** A name for a new save: the title of what the model read last. */
	const defaultSaveName = $derived.by(() => {
		const latest = chat.readSources.at(-1);
		if (latest === undefined) return 'Untitled';
		return (
			primers.get(latest)?.title ?? (latest.startsWith(TAUGHT_SOURCE) ? 'Taught reply' : 'Untitled')
		);
	});

	/** What’s in the composer, unsent. */
	let draft = $state('');

	/** The reply the Graph is open under, if any: one at a time. */
	let inspecting: string | undefined = $state();
	/** The step the Graph is on, and the one being previewed (a word or dot pointed at). */
	let at = $state(0);
	let pointed: number | undefined = $state();
	/** Baby’s latest finished reply that the Graph can look into. */
	const latest = $derived(
		chat.messages.findLast(
			(message) => message.role === 'baby' && !message.pending && message.steps !== undefined
		)
	);
	const latestReply = $derived(latest?.id);

	// The latest reply’s Graph is laid out as soon as it’s finished, so it’s ready when opened.
	$effect(() => {
		const steps = latest?.role === 'baby' ? latest.steps : undefined;
		if (steps) untrack(() => layOutReply(steps));
	});

	function inspect(id: string | undefined) {
		inspecting = id;
		at = 0;
		pointed = undefined;
	}

	// While the Graph is open, a new reply takes it over, from its first word.
	$effect(() => {
		const latest = latestReply;
		if (untrack(() => inspecting) !== undefined && latest !== undefined) inspect(latest);
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

	// The page opens ready to type in, where that won’t pop an on-screen keyboard over it.
	onMount(() => {
		if (!pointerIsFinger()) composer.focus();
	});

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
							{@const steps = message.steps}
							{@const asked = inspecting === message.id}
							<!-- The Graph opens once its first step is laid out; until then, it’s waited for. -->
							{@const open = asked && steps !== undefined && layOutReply(steps).ready > 0}
							<BabyMessage
								words={message.text ? message.text.split(' ') : []}
								status={message.status}
								pending={message.pending}
								progress={message.progress}
								inspect={steps && {
									open,
									waiting: asked && !open,
									ended: steps.at(-1)?.picked === undefined,
									word: pointed ?? at,
									ontoggle: () => inspect(asked ? undefined : message.id),
									onpoint: (word) => (pointed = word),
									onstep: (word) => {
										at = word;
										pointed = undefined;
									}
								}}
								actions={offersTeaching(message.id) ? teachLink : undefined}
							>
								{#snippet graph()}
									{#if steps}
										<GuessPanel
											{steps}
											{at}
											{pointed}
											onstep={(step) => (at = step)}
											onpoint={(step) => (pointed = step)}
											onclose={() => inspect(undefined)}
										/>
									{/if}
								{/snippet}
							</BabyMessage>
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
		<div class="composer">
			<Composer
				bind:this={composer}
				bind:value={draft}
				catchTyping
				placeholder={chat.teaching !== undefined
					? 'What should Baby say?'
					: empty
						? 'Say hi to Baby'
						: 'Reply'}
				ready={!chat.changing && (chat.teaching !== undefined ? !chat.reading : !chat.replying)}
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
						busy={chat.busy}
						undoable={chat.knowledge?.undoable ?? false}
						onreset={() => (confirmingReset = true)}
						onsaves={() => (savesOpen = true)}
						onundo={() => chat.undo()}
						oncopytranscript={copyTranscript}
					/>
				{/snippet}
			</Composer>
		</div>
	</main>
</div>

{#if confirmingReset}
	<ResetDialog onreset={reset} onclose={() => (confirmingReset = false)} />
{/if}

{#if savesOpen}
	<SavesFlow {saves} defaultName={defaultSaveName} onclose={() => (savesOpen = false)} />
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

	/*
	 * Pinned to the top corner, only as wide as its panel and with no band behind it, so the
	 * conversation scrolls all the way to the top of the page.
	 */
	.toolbar {
		position: sticky;
		top: 0;

		/* The open sources panel hangs below the toolbar, over the conversation and composer. */
		z-index: 1;
		align-self: flex-end;
		padding: max(var(--space-gutter), env(safe-area-inset-top)) var(--space-gutter) 0;
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

	.composer {
		position: sticky;
		bottom: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-tight);
		padding-block-end: max(var(--space-gutter), env(safe-area-inset-bottom));
		background: var(--color-bg);
	}
</style>
