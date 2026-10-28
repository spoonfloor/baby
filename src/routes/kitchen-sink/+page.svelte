<!-- Every UI part in every state, on one page, for design review. -->
<script lang="ts">
	import { describeReading, readingStats } from '#lib/baby/reading.ts';
	import { noticeText } from '#lib/chat/notices.ts';
	import { chatbot101 } from '#lib/library/chatbot-101.ts';
	import AddMenu from '#lib/ui/AddMenu.svelte';
	import AppMessage from '#lib/ui/AppMessage.svelte';
	import BabyMessage from '#lib/ui/BabyMessage.svelte';
	import Composer from '#lib/ui/Composer.svelte';
	import Button from '#lib/ui/Button.svelte';
	import IconButton from '#lib/ui/IconButton.svelte';
	import { icons, type IconName } from '#lib/ui/icons.ts';
	import PackDialog from '#lib/ui/PackDialog.svelte';
	import { pointerVerb } from '#lib/ui/pointer.svelte.ts';
	import ScriptText from '#lib/ui/ScriptText.svelte';
	import Spinner from '#lib/ui/Spinner.svelte';
	import StatusLine from '#lib/ui/StatusLine.svelte';
	import UserMessage from '#lib/ui/UserMessage.svelte';

	const short = 'Hello Baby!';
	const long =
		'Lorem ipsum dolor sit amet, consectetuer adipiscing elit, sed diam nonummy nibh euismod tincidunt ut laoreet dolore magna aliquam erat volutpat. Ut wisi enim ad minim veniam.';
	const multiline = 'First line\nSecond line\nThird line';
	const noop = () => {};
	const iconNames = Object.keys(icons) as IconName[];

	const pack = chatbot101[0];
	if (!pack) throw new Error('Chatbot 101 has no packs');
	// Two packs read, one shelf empty: every menu state at once.
	const shelves = [
		{
			title: 'Chatbot 101',
			ordered: true,
			packs: chatbot101.map(({ id, title }, index) => ({ id, title, read: index < 2 }))
		},
		{ title: 'Subjects', ordered: false, packs: [] }
	];
	const unread = describeReading(readingStats(pack.documents, () => false));
	const reread = describeReading(readingStats(pack.documents, () => true));

	/** Which pack preview is open: never read, or read before. */
	let previewing: 'unread' | 'read' | undefined = $state();
</script>

<main>
	<section>
		<h2>Composer</h2>
		<Composer placeholder="Say hi to Baby" onsend={noop}>
			{#snippet start()}
				<AddMenu {shelves} onopen={() => (previewing = 'unread')} />
			{/snippet}
		</Composer>
		<Composer placeholder="Reply" value={short} onsend={noop} />
		<Composer placeholder="Reply" value={multiline} onsend={noop} />
		<Composer placeholder="Reply" value={long} ready={false} onsend={noop}>
			{#snippet start()}
				<AddMenu disabled {shelves} onopen={noop} />
			{/snippet}
		</Composer>
	</section>

	<section>
		<h2>Pack preview</h2>
		<div class="row">
			<Button onclick={() => (previewing = 'unread')}>Never read</Button>
			<Button onclick={() => (previewing = 'read')}>Read before</Button>
		</div>
		{#if previewing}
			<PackDialog
				title={pack.title}
				summary={previewing === 'read' ? reread : unread}
				documents={pack.documents}
				read={previewing === 'read'}
				onread={() => (previewing = undefined)}
				onclose={() => (previewing = undefined)}
			/>
		{/if}
	</section>

	<section>
		<h2>Script text</h2>
		<ScriptText documents={pack.documents.slice(7, 9)} />
	</section>

	<section>
		<h2>Buttons</h2>
		<div class="row">
			<Button>Cancel</Button>
			<Button primary>Read</Button>
		</div>
	</section>

	<section>
		<h2>User message</h2>
		<UserMessage text={short} />
		<UserMessage text={long} />
		<UserMessage text={multiline} />
	</section>

	<section>
		<h2>Baby message</h2>
		<BabyMessage status="Recognized 0 of 3 words" text="" pending />
		<BabyMessage status="Looked for words to say but found none" text="" pending={false} />
		<BabyMessage
			status="Picked 9 words at random, without knowing how to use them"
			text={long}
			pending={false}
		/>
		<BabyMessage status="Read “Greetings”: 130 words · 28 new" text="" pending={false} />
	</section>

	<section>
		<h2>App message</h2>
		<AppMessage text={noticeText('newborn', pointerVerb())} />
		<AppMessage text={noticeText('failed', pointerVerb())} />
	</section>

	<section>
		<h2>Status line</h2>
		<StatusLine text="Active" active />
		<StatusLine text="Finished" active={false} />
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
		font-size: inherit;
		font-weight: inherit;
	}

	.row {
		display: flex;
		gap: var(--space-inline);
	}
</style>
