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
	import { describeDay, repliesGroup, TAUGHT_SOURCE, taughtDays } from '#lib/chat/taught.ts';
	import { turnTokens } from '#lib/baby/script.ts';
	import { chatbot101 } from '#lib/library/chatbot-101.ts';
	import { therapyBot } from '#lib/library/therapy-bot/index.ts';
	import AddMenu from '#lib/ui/AddMenu.svelte';
	import AppMessage from '#lib/ui/AppMessage.svelte';
	import BabyMessage from '#lib/ui/BabyMessage.svelte';
	import Choice from '#lib/ui/Choice.svelte';
	import ConfirmDialog from '#lib/ui/ConfirmDialog.svelte';
	import ConnectDialog from '#lib/ui/ConnectDialog.svelte';
	import Composer from '#lib/ui/Composer.svelte';
	import GuessPanel from '#lib/ui/GuessPanel.svelte';
	import Button from '#lib/ui/Button.svelte';
	import IconButton from '#lib/ui/IconButton.svelte';
	import { icons, type IconName } from '#lib/ui/icons.ts';
	import { pointerVerb } from '#lib/ui/pointer.svelte.ts';
	import ProgressBar from '#lib/ui/ProgressBar.svelte';
	import ReadUrlDialog from '#lib/ui/ReadUrlDialog.svelte';
	import { SAVED_PAGE_ACCEPT } from '#lib/web/savedPage.ts';
	import { UPLOAD_ACCEPT } from '#lib/web/upload.ts';
	import { siteOf } from '#lib/web/brought.ts';
	import { SUGGESTED_FEEDS } from '#lib/web/suggestedFeeds.ts';
	import ResetDialog from '#lib/ui/ResetDialog.svelte';
	import SaveNameDialog from '#lib/ui/SaveNameDialog.svelte';
	import SavesDialog from '#lib/ui/SavesDialog.svelte';
	import type { SaveKey } from '#lib/saves/store.ts';
	import SettingsMenu from '#lib/ui/SettingsMenu.svelte';
	import ScriptText from '#lib/ui/ScriptText.svelte';
	import SourceDialog from '#lib/ui/SourceDialog.svelte';
	import SourcesPanel from '#lib/ui/SourcesPanel.svelte';
	import Spinner from '#lib/ui/Spinner.svelte';
	import StepDots from '#lib/ui/StepDots.svelte';
	import StatusLine from '#lib/ui/StatusLine.svelte';
	import TextField from '#lib/ui/TextField.svelte';
	import UserMessage from '#lib/ui/UserMessage.svelte';

	const short = 'Hello Baby!';
	const long =
		'Lorem ipsum dolor sit amet, consectetuer adipiscing elit, sed diam nonummy nibh euismod tincidunt ut laoreet dolore magna aliquam erat volutpat. Ut wisi enim ad minim veniam.';
	const multiline = 'First line\nSecond line\nThird line';
	const noop = () => {};
	const suggestions = SUGGESTED_FEEDS.map(({ name, url }) => ({ name, site: siteOf(url), url }));
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
					note:
						index < read
							? undefined
							: describeNewWords(newWordCounts[index % newWordCounts.length] ?? 0)
				}))
			},
			{
				title: 'Psychology',
				sources: [
					{
						id: therapyBot.id,
						title: therapyBot.title,
						read: false,
						note: describeNewWords(812)
					}
				]
			}
		];
	}

	/** Replies taught today, yesterday, and a week before: 4, 12, and 1 of them. */
	const DAY = 24 * 60 * 60 * 1000;
	const taughtReplies = [
		{ daysAgo: 0, replies: 4 },
		{ daysAgo: 1, replies: 12 },
		{ daysAgo: 8, replies: 1 }
	].flatMap(({ daysAgo, replies }) =>
		Array.from({ length: replies }, (_, n) => ({
			id: `${TAUGHT_SOURCE}${daysAgo}-${n}`,
			at: Date.now() - daysAgo * DAY,
			documents: [
				[...turnTokens('you', n % 2 ? 'hi !' : 'hi baby !'), ...turnTokens('baby', 'hi !')]
			]
		}))
	);
	const days = taughtDays(taughtReplies, new Date());

	/** Sources panel groups as `panelGroups(3)`, with a group of replies taught on three days and a feed’s posts, one new since it was first read. */
	function groupsWithReplies() {
		const [first, ...rest] = panelGroups(3);
		const site = {
			title: 'example.com',
			sources: [
				{
					id: 'web:0',
					title: 'The first frost, mapped',
					read: false,
					fresh: true,
					note: '302 new words'
				},
				{ id: 'web:1', title: 'Why tomatoes split', read: false, note: '214 new words' },
				{ id: 'web:2', title: 'Seed saving, start to finish', read: true },
				{ id: 'web:3', title: 'Notes from the frost', read: false, note: '97 new words' }
			]
		};
		return [...(first ? [first] : []), repliesGroup(days), site, ...rest];
	}

	/** Which source preview is open: never read, read before, adapted from something, or a day of taught replies. */
	let previewing: 'unread' | 'read' | 'credited' | 'taught' | undefined = $state();
	const previewed = $derived(previewing === 'credited' ? therapyBot : greetings);
	let confirmingReset = $state(false);

	const deviceSaves = [
		{ id: 'd1', name: 'Story-only experiment', meta: '3,880 words · 9 sources · Nov 9' }
	];
	const serverSaves = [
		{ id: 's2', name: 'After monkeys, before Aesop', meta: '1,240 words · 6 sources · today' },
		{ id: 's1', name: 'Chatbot 101 done', meta: '412 words · 3 sources · Nov 12' }
	];
	const savePlaces: { value: 'device' | 'server'; label: string }[] = [
		{ value: 'device', label: 'This device' },
		{ value: 'server', label: 'Server' }
	];
	let savesDemo:
		'empty' | 'device' | 'server' | 'working' | 'problems' | 'selecting' | 'partial' | undefined =
		$state();
	/** The saves checked in the select-mode demos. */
	let demoChecked: SaveKey[] = $state([]);
	const sameSave = (a: SaveKey, b: SaveKey) => a.place === b.place && a.id === b.id;
	let naming: 'new' | 'replace' | 'rename' | 'problem' | undefined = $state();
	let saveName = $state('Chatbot 101 plus monkeys');
	let savePlace: 'device' | 'server' = $state('server');
	let connecting = $state(false);
	/** Which Read from URL dialog is open. */
	let readingUrl:
		| 'empty'
		| 'working'
		| 'problem'
		| 'disconnected'
		| 'blocked'
		| 'login'
		| 'readingFile'
		| 'badFile'
		| 'paste'
		| undefined = $state();
	/** The refusal and file states of the Read from URL dialog, which offer a saved copy instead. */
	const URL_SAVED_PROBLEMS: Partial<Record<NonNullable<typeof readingUrl>, string>> = {
		blocked: 'That site blocks automated readers, like your server.',
		login: 'That page needs a login, so your server can’t read it.',
		readingFile: 'That site blocks automated readers, like your server.',
		badFile: 'Safari saved that as a web archive. Save it again as Page Source, then choose that.',
		paste: 'That site blocks automated readers, like your server.'
	};
	/** Opens one of those states, at the address the site refused. */
	function openSaved(state: 'blocked' | 'login' | 'readingFile' | 'badFile' | 'paste') {
		urlAddress = 'https://example.com/post';
		readingUrl = state;
	}
	let urlAddress = $state('');
	let serverAddress = $state('');
	let serverToken = $state('');
	let confirmingSave: 'load' | 'delete' | 'deleteMany' | 'conflict' | undefined = $state();
</script>

{#snippet teachLink()}
	<Button inline icon="personEdit">Teach a reply</Button>
{/snippet}

<main>
	<section>
		<h2>Composer</h2>
		<Composer placeholder="Say hi to Baby" onsend={noop}>
			{#snippet start()}
				<AddMenu accept={UPLOAD_ACCEPT} onfiles={noop} onurl={() => (readingUrl = 'empty')} />
			{/snippet}
			{#snippet end()}
				<SettingsMenu
					undoable
					onreset={() => (confirmingReset = true)}
					onsaves={noop}
					onundo={noop}
					oncopytranscript={noop}
				/>
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
		<Composer
			placeholder="Or write what Baby should say"
			note={{
				text: 'Teaching Baby a reply to “What do you eat?”',
				oncancel: noop,
				picks: {
					label: 'Baby’s other replies',
					options: ['I eat words.', 'I live in your browser.', 'Thank you!']
				}
			}}
			onsend={noop}
		/>
		<Composer
			placeholder="Or write what Baby should say"
			ready={false}
			note={{
				text: 'Teaching Baby a reply to “What do you eat?”',
				oncancel: noop,
				picks: { label: 'Baby’s other replies', options: ['I eat words.', long] }
			}}
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
				groups={groupsWithReplies()}
				open
				onopen={(id) => (previewing = id.startsWith('taught-day:') ? 'taught' : 'unread')}
			/>
		</div>
	</section>

	<section>
		<h2>Source preview</h2>
		<div class="row">
			<Button onclick={() => (previewing = 'unread')}>Never read</Button>
			<Button onclick={() => (previewing = 'read')}>Read before</Button>
			<Button onclick={() => (previewing = 'credited')}>Inspired by</Button>
			<Button onclick={() => (previewing = 'taught')}>Taught replies</Button>
		</div>
		{#if previewing === 'taught' && days[0]}
			{@const day = days[0]}
			<SourceDialog
				title={day.title}
				summary={describeDay(day)}
				documents={day.documents}
				onclose={() => (previewing = undefined)}
			/>
		{:else if previewing}
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
			<SettingsMenu
				undoable
				onreset={() => (confirmingReset = true)}
				onsaves={() => (savesDemo = 'empty')}
				onundo={noop}
				oncopytranscript={noop}
			/>
			<SettingsMenu onreset={noop} onsaves={noop} onundo={noop} oncopytranscript={noop} />
			<SettingsMenu
				busy
				undoable
				onreset={noop}
				onsaves={noop}
				onundo={noop}
				oncopytranscript={noop}
			/>
		</div>
	</section>

	<section>
		<h2>Saves dialog</h2>
		<div class="row wrap">
			<Button onclick={() => (savesDemo = 'empty')}>Nothing saved</Button>
			<Button onclick={() => (savesDemo = 'device')}>Saved on this device</Button>
			<Button onclick={() => (savesDemo = 'server')}>Server, a save picked</Button>
			<Button onclick={() => (savesDemo = 'working')}>Loading</Button>
			<Button onclick={() => (savesDemo = 'problems')}>Problems</Button>
			<Button
				onclick={() => {
					demoChecked = [];
					savesDemo = 'selecting';
				}}>Selecting</Button
			>
			<Button
				onclick={() => {
					demoChecked = [
						{ place: 'server', id: 's2' },
						{ place: 'server', id: 's1' }
					];
					savesDemo = 'partial';
				}}>Some couldn’t be deleted</Button
			>
		</div>
		{#if savesDemo}
			{@const connected = savesDemo !== 'empty' && savesDemo !== 'device'}
			<SavesDialog
				status={savesDemo === 'empty'
					? 'The current model has training that isn’t saved.'
					: 'The current model is saved.'}
				device={savesDemo === 'empty' ? [] : deviceSaves}
				server={connected
					? {
							host: 'baby.example.com',
							saves: serverSaves,
							problem:
								savesDemo === 'problems'
									? 'Couldn’t reach the server. Check the address and your connection.'
									: undefined
						}
					: undefined}
				picked={savesDemo === 'server' || savesDemo === 'working'
					? { place: 'server', id: 's1' }
					: undefined}
				checked={savesDemo === 'selecting' || savesDemo === 'partial' ? demoChecked : undefined}
				working={savesDemo === 'working' ? 'Loading “Chatbot 101 done”' : undefined}
				problem={savesDemo === 'problems'
					? 'That save is gone. It may have been deleted on another device.'
					: savesDemo === 'partial'
						? 'Deleted 1 of 3. Couldn’t reach the server. Check the address and your connection.'
						: undefined}
				onpick={noop}
				onload={noop}
				onrename={noop}
				onmove={noop}
				ondelete={() => (confirmingSave = 'delete')}
				onselect={() => {
					demoChecked = [];
					savesDemo = 'selecting';
				}}
				oncheck={(key) =>
					(demoChecked = demoChecked.some((other) => sameSave(other, key))
						? demoChecked.filter((other) => !sameSave(other, key))
						: [...demoChecked, key])}
				ondeletechecked={() => (confirmingSave = 'deleteMany')}
				onstopselecting={() => (savesDemo = 'device')}
				onsave={() => (naming = 'new')}
				onconnect={() => (connecting = true)}
				ondisconnect={noop}
				onclose={() => (savesDemo = undefined)}
			/>
		{/if}
	</section>

	<section>
		<h2>Save name dialog</h2>
		<div class="row wrap">
			<Button onclick={() => (naming = 'new')}>New save</Button>
			<Button onclick={() => (naming = 'replace')}>Replaces one</Button>
			<Button onclick={() => (naming = 'rename')}>Rename</Button>
			<Button onclick={() => (naming = 'problem')}>Problem</Button>
		</div>
		{#if naming}
			<SaveNameDialog
				title={naming === 'rename' ? 'Rename save' : 'Save current model'}
				note={naming === 'replace'
					? 'Replaces the save named “Chatbot 101 done” on the server.'
					: naming === 'rename'
						? 'Renames the save on this device.'
						: 'Saves the model as it is now to the server, to load again later.'}
				confirm={naming === 'rename' ? 'Rename' : naming === 'replace' ? 'Replace' : 'Save'}
				bind:name={saveName}
				places={naming === 'rename' ? undefined : savePlaces}
				bind:place={savePlace}
				problem={naming === 'problem' ? 'There’s already a save with that name there.' : undefined}
				onconfirm={() => (naming = undefined)}
				onclose={() => (naming = undefined)}
			/>
		{/if}
	</section>

	<section>
		<h2>Connect dialog</h2>
		<div class="row">
			<Button onclick={() => (connecting = true)}>Open</Button>
		</div>
		{#if connecting}
			<ConnectDialog
				bind:address={serverAddress}
				bind:token={serverToken}
				problem={serverAddress === 'nope' ? 'The server didn’t accept the token.' : undefined}
				onconnect={() => (connecting = false)}
				onclose={() => (connecting = false)}
			/>
		{/if}
	</section>

	<section>
		<h2>Read from URL dialog</h2>
		<div class="row">
			<Button onclick={() => (readingUrl = 'empty')}>Open</Button>
			<Button onclick={() => (readingUrl = 'working')}>Fetching</Button>
			<Button onclick={() => (readingUrl = 'problem')}>Problem</Button>
			<Button onclick={() => (readingUrl = 'disconnected')}>No server</Button>
		</div>
		<div class="row wrap">
			<Button onclick={() => openSaved('blocked')}>Site blocks the server</Button>
			<Button onclick={() => openSaved('login')}>Needs a login</Button>
			<Button onclick={() => openSaved('readingFile')}>Reading the saved file</Button>
			<Button onclick={() => openSaved('badFile')}>Safari web archive</Button>
			<Button onclick={() => openSaved('paste')}>On a phone: paste the text</Button>
		</div>
		{#if readingUrl}
			<ReadUrlDialog
				bind:address={urlAddress}
				connected={readingUrl !== 'disconnected'}
				working={readingUrl === 'working'
					? 'Fetching'
					: readingUrl === 'readingFile'
						? 'Reading the saved page'
						: undefined}
				problem={readingUrl === 'problem'
					? 'That page didn’t have any text to read.'
					: URL_SAVED_PROBLEMS[readingUrl]}
				saved={readingUrl in URL_SAVED_PROBLEMS
					? readingUrl === 'paste'
						? { url: urlAddress, by: 'paste' }
						: { url: urlAddress, by: 'file', accept: SAVED_PAGE_ACCEPT }
					: undefined}
				{suggestions}
				onnext={() => (readingUrl = undefined)}
				onconnect={() => (connecting = true)}
				onfile={() => (readingUrl = 'readingFile')}
				onpasted={() => (readingUrl = undefined)}
				onclose={() => (readingUrl = undefined)}
			/>
		{/if}
	</section>

	<section>
		<h2>Confirmations</h2>
		<div class="row wrap">
			<Button onclick={() => (confirmingSave = 'load')}>Load over unsaved training</Button>
			<Button onclick={() => (confirmingSave = 'delete')}>Delete a save</Button>
			<Button onclick={() => (confirmingSave = 'deleteMany')}>Delete several</Button>
			<Button onclick={() => (confirmingSave = 'conflict')}>Changed on another device</Button>
		</div>
		{#if confirmingSave === 'load'}
			<ConfirmDialog
				title="Replace the current model?"
				description="It has training that isn’t saved, which loading “Chatbot 101 done” will lose."
				confirm="Load anyway"
				onconfirm={() => (confirmingSave = undefined)}
				onclose={() => (confirmingSave = undefined)}
			/>
		{:else if confirmingSave === 'delete'}
			<ConfirmDialog
				title="Delete “Chatbot 101 done”?"
				confirm="Delete forever"
				onconfirm={() => (confirmingSave = undefined)}
				onclose={() => (confirmingSave = undefined)}
			/>
		{:else if confirmingSave === 'deleteMany'}
			<ConfirmDialog
				title="Delete 3 saves?"
				items={[
					{ key: 'd1', label: 'Story-only experiment', note: 'this device' },
					{ key: 's2', label: 'After monkeys, before Aesop', note: 'server' },
					{ key: 's1', label: 'Chatbot 101 done', note: 'server' }
				]}
				confirm="Delete forever"
				onconfirm={() => (confirmingSave = undefined)}
				onclose={() => (confirmingSave = undefined)}
			/>
		{:else if confirmingSave === 'conflict'}
			<ConfirmDialog
				title="Changed on another device"
				description="“Chatbot 101 done” was saved from another device after you last loaded or saved it. Saving here would replace that version."
				confirm="Save as new"
				alternative={{ label: 'Replace', onclick: () => (confirmingSave = undefined) }}
				onconfirm={() => (confirmingSave = undefined)}
				onclose={() => (confirmingSave = undefined)}
			/>
		{/if}
	</section>

	<section>
		<h2>Text field and choice</h2>
		<TextField label="Name" bind:value={saveName} />
		<Choice label="Save to" options={savePlaces} bind:value={savePlace} />
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
			status="Practicing “Greetings” · step 300 of 800 · about 25 seconds left"
			words={[]}
			pending
			progress={{ done: 300, total: 800 }}
			oncancel={noop}
		/>
		<BabyMessage status="Waiting to read “Thanks”" words={[]} pending waiting oncancel={noop} />
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
		<AppMessage text={noticeText('unreadableFiles', pointerVerb())} />
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

	.wrap {
		flex-wrap: wrap;
	}

	/* Each panel hangs over what's below it when open, so give them room side by side. */
	.panels {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-inline);
		min-block-size: var(--height-panel-max);
	}
</style>
