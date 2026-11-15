<!-- Every UI part in every state, on one page, for design review. -->
<script lang="ts">
	import type { ReplyStep } from '#lib/baby/index.ts';
	import {
		describeKnowledge,
		describeNewWords,
		describeReading,
		readingStats
	} from '#lib/baby/reading.ts';
	import { noticeText } from '#lib/chat/notices.ts';
	import { chatbot101 } from '#lib/library/chatbot-101.ts';
	import { therapyBot } from '#lib/library/therapy-bot/index.ts';
	import AddMenu from '#lib/ui/AddMenu.svelte';
	import AppMessage from '#lib/ui/AppMessage.svelte';
	import BabyMessage from '#lib/ui/BabyMessage.svelte';
	import Composer from '#lib/ui/Composer.svelte';
	import GuessPanel from '#lib/ui/GuessPanel.svelte';
	import Button from '#lib/ui/Button.svelte';
	import IconButton from '#lib/ui/IconButton.svelte';
	import { icons, type IconName } from '#lib/ui/icons.ts';
	import { pointerVerb } from '#lib/ui/pointer.svelte.ts';
	import ProgressBar from '#lib/ui/ProgressBar.svelte';
	import ResetDialog from '#lib/ui/ResetDialog.svelte';
	import SettingsMenu from '#lib/ui/SettingsMenu.svelte';
	import ScriptText from '#lib/ui/ScriptText.svelte';
	import SourceDialog from '#lib/ui/SourceDialog.svelte';
	import SourcesPanel from '#lib/ui/SourcesPanel.svelte';
	import Spinner from '#lib/ui/Spinner.svelte';
	import StepDots from '#lib/ui/StepDots.svelte';
	import StatusLine from '#lib/ui/StatusLine.svelte';
	import UserMessage from '#lib/ui/UserMessage.svelte';

	const short = 'Hello Baby!';
	const long =
		'Lorem ipsum dolor sit amet, consectetuer adipiscing elit, sed diam nonummy nibh euismod tincidunt ut laoreet dolore magna aliquam erat volutpat. Ut wisi enim ad minim veniam.';
	const multiline = 'First line\nSecond line\nThird line';
	const noop = () => {};
	const iconNames = Object.keys(icons) as IconName[];

	/**
	 * A reply like a trained Baby’s, word by word: at each, a few likely words, markers
	 * among them, and a long tail of 200, the word picked usually the likeliest.
	 */
	function odds(likely: string[]) {
		const words = [
			...likely,
			'[EOS]',
			'[YOU]',
			...Array.from({ length: 200 }, (_, i) => `word${i}`)
		];
		const total = words.reduce((sum, _, rank) => sum + 1 / (rank + 1) ** 1.6, 0);
		return words.map((word, rank) => ({ word, chance: 1 / (rank + 1) ** 1.6 / total }));
	}
	const cake = ['i', 'want', 'to', 'eat', 'a', 'piece', 'of', 'cake', '.'];
	const alternatives = ['really', 'just', 'extraordinarily', 'hangover', 'so'];
	const replySteps: ReplyStep[] = [
		...cake.map((word, index) => ({
			guesses: odds([word, ...alternatives.slice(index % 3)]),
			// One word picked against the odds, as a reply sometimes does.
			picked: index === 5 ? 'word150' : word
		})),
		{ guesses: odds([]) }
	];
	const replyWords = replySteps.flatMap(({ picked }) => picked ?? []);
	/** The Graph under a reply: closed, then open at each kind of step. */
	const graphDemos: {
		title: string;
		open: boolean;
		at: number;
		pointed?: number | undefined;
		waiting?: boolean;
	}[] = $state([
		{ title: 'Closed', open: false, at: 0 },
		{ title: 'Asked for before it’s ready', open: false, at: 0, waiting: true },
		{ title: 'Open, at the first word', open: true, at: 0 },
		{ title: 'At a word picked against the odds', open: true, at: 5 },
		{ title: 'Where Baby ended the reply', open: true, at: replySteps.length - 1 }
	]);

	const greetings = chatbot101.find(({ id }) => id === 'greetings');
	if (!greetings) throw new Error('Chatbot 101 has no Greetings');

	/** New-word counts for the sources panel, covering every way a count reads. */
	const newWordCounts = [1, 27, 0, 10_940, 45];

	/** Sources panel groups with the first `read` of Chatbot 101 read and nothing else. */
	function panelGroups(read: number) {
		return [
			{
				title: 'Chatbot 101',
				sources: chatbot101.map(({ id, title }, index) => ({
					id,
					title,
					read: index < read,
					newWords: describeNewWords(newWordCounts[index % newWordCounts.length] ?? 0)
				}))
			},
			{
				title: 'Psychology',
				sources: [
					{
						id: therapyBot.id,
						title: therapyBot.title,
						read: false,
						newWords: describeNewWords(812)
					}
				]
			}
		];
	}

	/** Which source preview is open: never read, read before, or adapted from something. */
	let previewing: 'unread' | 'read' | 'credited' | undefined = $state();
	const previewed = $derived(previewing === 'credited' ? therapyBot : greetings);
	let confirmingReset = $state(false);
</script>

{#snippet teachLink()}
	<Button inline icon="personEdit">Teach a reply</Button>
{/snippet}

<main>
	<section>
		<h2>Composer</h2>
		<Composer placeholder="Say hi to Baby" onsend={noop}>
			{#snippet start()}
				<AddMenu />
			{/snippet}
			{#snippet end()}
				<SettingsMenu oncopytranscript={noop} onreset={() => (confirmingReset = true)} />
			{/snippet}
		</Composer>
		<Composer placeholder="Reply" value={short} onsend={noop} />
		<Composer placeholder="Reply" value={multiline} onsend={noop} />
		<Composer placeholder="Reply" value={long} ready={false} onsend={noop} />
		<Composer
			placeholder="What should Baby say?"
			note={{ text: 'Teaching Baby a reply to “IDK”', oncancel: noop }}
			onsend={noop}
		/>
		<Composer
			placeholder="What should Baby say?"
			note={{ text: `Teaching Baby a reply to “${long}”`, oncancel: noop }}
			onsend={noop}
		/>
	</section>

	<section>
		<h2>Sources panel</h2>
		<div class="panels">
			<SourcesPanel
				summary={describeKnowledge(1)}
				groups={panelGroups(1)}
				onopen={() => (previewing = 'unread')}
			/>
			<SourcesPanel
				summary={describeKnowledge(1)}
				groups={panelGroups(1)}
				open
				onopen={() => (previewing = 'unread')}
			/>
			<SourcesPanel
				summary={describeKnowledge(412)}
				groups={panelGroups(3)}
				open
				onopen={() => (previewing = 'unread')}
			/>
			<SourcesPanel
				summary={describeKnowledge(412)}
				groups={panelGroups(3)}
				open
				disabled
				onopen={noop}
			/>
		</div>
	</section>

	<section>
		<h2>Source preview</h2>
		<div class="row">
			<Button onclick={() => (previewing = 'unread')}>Never read</Button>
			<Button onclick={() => (previewing = 'read')}>Read before</Button>
			<Button onclick={() => (previewing = 'credited')}>Inspired by</Button>
		</div>
		{#if previewing}
			<SourceDialog
				title={previewed.title}
				credit={previewed.credit}
				summary={describeReading(readingStats(previewed.documents, () => previewing === 'read'))}
				documents={previewed.documents}
				read={previewing === 'read'}
				onread={() => (previewing = undefined)}
				onclose={() => (previewing = undefined)}
			/>
		{/if}
	</section>

	<section>
		<h2>Settings menu</h2>
		<div class="row end">
			<SettingsMenu oncopytranscript={noop} onreset={() => (confirmingReset = true)} />
			<SettingsMenu resetDisabled oncopytranscript={noop} onreset={noop} />
		</div>
	</section>

	<section>
		<h2>Reset dialog</h2>
		<div class="row">
			<Button onclick={() => (confirmingReset = true)}>Open</Button>
		</div>
		{#if confirmingReset}
			<ResetDialog
				onreset={() => (confirmingReset = false)}
				onclose={() => (confirmingReset = false)}
			/>
		{/if}
	</section>

	<section>
		<h2>Script text</h2>
		<ScriptText documents={greetings.documents.slice(7, 9)} />
	</section>

	<section>
		<h2>Buttons</h2>
		<div class="row">
			<Button>Cancel</Button>
			<Button primary>Read</Button>
			<Button inline icon="personEdit">Teach a reply</Button>
		</div>
	</section>

	<section>
		<h2>The Graph</h2>
		{#each graphDemos as demo, index (index)}
			<h3>{demo.title}</h3>
			<BabyMessage
				status="Picked 9 words, each a guess at what comes next"
				words={replyWords}
				pending={false}
				inspect={{
					open: demo.open,
					waiting: demo.waiting ?? false,
					ended: replySteps.at(-1)?.picked === undefined,
					word: demo.pointed ?? demo.at,
					ontoggle: () => {
						demo.open = !demo.open;
						demo.at = 0;
					},
					onpoint: (word) => (demo.pointed = word),
					onstep: (word) => (demo.at = word)
				}}
				actions={teachLink}
			>
				{#snippet graph()}
					<GuessPanel
						steps={replySteps}
						at={demo.at}
						pointed={demo.pointed}
						onstep={(step) => (demo.at = step)}
						onpoint={(step) => (demo.pointed = step)}
						onclose={() => (demo.open = false)}
					/>
				{/snippet}
			</BabyMessage>
		{/each}
		<h3>Steps, the last few not ready yet</h3>
		<StepDots
			labels={replySteps.map(({ picked }) => picked ?? 'End')}
			ready={4}
			at={1}
			onstep={() => {}}
			onpoint={() => {}}
		/>
	</section>

	<section>
		<h2>User message</h2>
		<UserMessage text={short} />
		<UserMessage text={long} />
		<UserMessage text={multiline} />
		<UserMessage text="Me too!" label="Your reply to “IDK”" />
	</section>

	<section>
		<h2>Baby message</h2>
		<BabyMessage status="Recognized 0 of 3 words" words={[]} pending />
		<BabyMessage status="Looked for words to say but found none" words={[]} pending={false} />
		<BabyMessage
			status="Looked for words to say but found none"
			words={[]}
			pending={false}
			actions={teachLink}
		/>
		<BabyMessage
			status="Picked 3 words, each a guess at what comes next"
			words={['thank', 'you', '?']}
			pending={false}
			actions={teachLink}
		/>
		<BabyMessage
			status="Picked 29 words, each a guess at what comes next"
			words={long.toLowerCase().split(' ')}
			pending={false}
		/>
		<BabyMessage
			status="Practicing “Greetings”"
			words={[]}
			pending
			progress={{ done: 0, total: 800 }}
		/>
		<BabyMessage
			status="Practicing “Greetings” · step 300 of 800 · about 25 seconds left"
			words={[]}
			pending
			progress={{ done: 300, total: 800 }}
		/>
		<BabyMessage
			status="Read “Greetings”: 256 words · 28 new · loss 1.24 → 0.29 in 450 of 800 steps"
			words={[]}
			pending={false}
		/>
	</section>

	<section>
		<h2>App message</h2>
		<AppMessage text={noticeText('oneWord', pointerVerb())} />
		<AppMessage text={noticeText('guess', pointerVerb())} />
		<AppMessage text={noticeText('repertoire', pointerVerb())} />
		<AppMessage text={noticeText('unrecognized', pointerVerb())} actions={teachLink} />
		<AppMessage text={noticeText('failed', pointerVerb())} />
	</section>

	<section>
		<h2>Status line</h2>
		<StatusLine text="Active" active />
		<StatusLine text="Finished" active={false} />
	</section>

	<section>
		<h2>ProgressBar</h2>
		<ProgressBar done={0} total={800} />
		<ProgressBar done={300} total={800} />
		<ProgressBar done={800} total={800} />
	</section>

	<section>
		<h2>Spinner</h2>
		<Spinner />
	</section>

	<section>
		<h2>Icon buttons</h2>
		<div class="row">
			{#each iconNames as icon (icon)}
				<IconButton {icon} label={icon} />
			{/each}
		</div>
	</section>
</main>

<style>
	main {
		display: flex;
		flex-direction: column;
		gap: var(--space-stack);
		max-width: var(--width-content);
		margin-inline: auto;
		padding: var(--space-gutter);
	}

	section {
		display: flex;
		flex-direction: column;
		gap: var(--space-tight);
	}

	h2 {
		margin: 0;
		color: var(--color-text-muted);
		font-weight: var(--font-weight-body);
	}

	.row {
		display: flex;
		gap: var(--space-inline);
	}

	.end {
		justify-content: flex-end;
	}

	/* Each panel hangs over what's below it when open, so give them room side by side. */
	.panels {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-inline);
		min-block-size: var(--height-panel-max);
	}
</style>
