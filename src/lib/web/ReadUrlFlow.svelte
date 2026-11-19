<!--
	Read from URL, start to finish: asks for an address (connecting a save server
	first if there isn’t one), fetches it through the server (or the feed a front
	page offers, see readable.ts), and hands back what it found to read. Nothing is read here: a page goes on to its preview, a feed to the
	sources panel.
-->
<script lang="ts">
	import type { Saves } from '#lib/saves/saves.svelte.ts';
	import { problemText } from '#lib/saves/describe.ts';
	import ConnectDialog from '#lib/ui/ConnectDialog.svelte';
	import ReadUrlDialog from '#lib/ui/ReadUrlDialog.svelte';
	import type { Extracted } from './extract.ts';
	import {
		fetchThroughServer,
		FetchProblemError,
		normalizeUrl,
		type FetchedText,
		type FetchProblem
	} from './fetchThroughServer.ts';
	import { readable, readableFrom } from './readable.ts';
	import {
		pastedPage,
		SAVED_PAGE_ACCEPT,
		savedPage,
		SavedPageError,
		type Pasted,
		type SavedPageProblem
	} from './savedPage.ts';
	import { pointerIsFinger } from '#lib/ui/pointer.svelte.ts';
	import { siteOf } from './brought.ts';
	import { named, SUGGESTED_FEEDS } from './suggestedFeeds.ts';

	interface Props {
		saves: Saves;
		/** Something was found to read; the flow is done. */
		onfound: (found: Extracted) => void;
		onclose: () => void;
	}

	let { saves, onfound, onclose }: Props = $props();

	/**
	 * Refusals a person in a browser can likely get past: the site turns away the
	 * server’s address or its automated requests, or wants a login the person has.
	 * Not a missing page, which is missing for everyone.
	 */
	const SAVABLE: ReadonlySet<FetchProblem> = new Set([
		'blocked',
		'login',
		'limited',
		'legal',
		'slow',
		'failed'
	]);

	let address = $state('');
	let working: string | undefined = $state();
	let problem: string | undefined = $state();
	/** The address a site refused the server, to read a saved copy of instead. */
	let refused: string | undefined = $state();
	/**
	 * Offered only while the address is still the one refused: as a saved file, or as
	 * pasted text where the pointer is a finger, since phones make saving pages awkward.
	 */
	const saved = $derived.by(() => {
		if (refused === undefined || normalizeUrl(address) !== refused) return undefined;
		return pointerIsFinger()
			? { url: refused, by: 'paste' as const }
			: { url: refused, by: 'file' as const, accept: SAVED_PAGE_ACCEPT };
	});
	/** The Connect server dialog, over this one. */
	let connecting: { address: string; token: string } | undefined = $state();
	let connectWorking: string | undefined = $state();
	let connectProblem: string | undefined = $state();

	const PROBLEMS: Record<FetchProblem, string> = {
		address: 'Enter a web address, like example.com/post.',
		private: 'That address is on a private network, so your server won’t fetch it.',
		unreachable: 'Couldn’t reach your server. Check your connection.',
		unauthorized: 'Your server didn’t accept its token. Connect it again.',
		outdated: 'Your server can’t fetch pages yet. Update it to the latest version.',
		blocked: 'That site blocks automated readers, like your server.',
		login: 'That page needs a login, so your server can’t read it.',
		limited: 'That site is limiting how often your server can read it. Try again later.',
		legal: 'That page isn’t available where your server is, for legal reasons.',
		missing: 'That site has no page at that address.',
		slow: 'The site took too long to answer.',
		failed: 'The site wouldn’t send that page.',
		type: 'That address isn’t a page or a feed.',
		large: 'That page is too big to read.',
		error: 'Something went wrong. Try again.'
	};

	const SAVED_PAGE_PROBLEMS: Record<SavedPageProblem, string> = {
		webarchive:
			'Safari saved that as a web archive. Save it again as Page Source, then choose that.',
		type: 'That file isn’t a saved page or text.'
	};

	async function next() {
		const connection = saves.connection;
		if (!connection) return;
		const url = normalizeUrl(address);
		if (!url) {
			problem = PROBLEMS.address;
			return;
		}
		await find('Fetching', async (fetchText) => named(await readable(fetchText, url), url), url);
	}

	const suggestions = SUGGESTED_FEEDS.map(({ name, url }) => ({ name, site: siteOf(url), url }));

	async function readSaved(file: File) {
		const url = saved?.url;
		if (url === undefined) return;
		await find('Reading the saved page', async (fetchText) =>
			readableFrom(fetchText, await savedPage(file, url))
		);
	}

	async function readPasted(pasted: Pasted) {
		const url = saved?.url;
		if (url === undefined) return;
		await find('Reading the page’s text', (fetchText) =>
			readableFrom(fetchText, pastedPage(pasted, url))
		);
	}

	/**
	 * Runs `look` with the server as its way to fetch pages, then hands on what it found,
	 * or says why there’s nothing. A site refusing `url` offers its saved copy instead.
	 */
	async function find(
		doing: string,
		look: (fetchText: (url: string) => Promise<FetchedText>) => Promise<Extracted>,
		url?: string
	) {
		const connection = saves.connection;
		if (!connection) return;
		working = doing;
		problem = undefined;
		try {
			const found = await look((address) => fetchThroughServer(connection, address));
			if (found.kind === 'page' && found.source.documents.length === 0) {
				problem = 'That page didn’t have any text to read.';
			} else if (found.kind === 'feed' && found.sources.length === 0) {
				problem = 'That feed has no posts to read.';
			} else {
				onfound(found);
			}
		} catch (error) {
			if (error instanceof SavedPageError) {
				problem = SAVED_PAGE_PROBLEMS[error.problem];
			} else {
				if (!(error instanceof FetchProblemError)) console.error(error);
				const why = error instanceof FetchProblemError ? error.problem : 'error';
				problem = PROBLEMS[why];
				if (url !== undefined) refused = SAVABLE.has(why) ? url : undefined;
			}
		} finally {
			working = undefined;
		}
	}

	async function connect() {
		if (!connecting) return;
		connectWorking = 'Connecting';
		connectProblem = undefined;
		try {
			await saves.connect(connecting.address, connecting.token);
			connecting = undefined;
		} catch (error) {
			connectProblem = problemText(error);
		} finally {
			connectWorking = undefined;
		}
	}
</script>

<ReadUrlDialog
	bind:address
	connected={saves.connection !== undefined}
	{working}
	{problem}
	{saved}
	{suggestions}
	onnext={next}
	onfile={readSaved}
	onpasted={readPasted}
	onconnect={() => (connecting = { address: '', token: '' })}
	{onclose}
/>

{#if connecting}
	<ConnectDialog
		bind:address={connecting.address}
		bind:token={connecting.token}
		working={connectWorking}
		problem={connectProblem}
		onconnect={connect}
		onclose={() => {
			connecting = undefined;
			connectProblem = undefined;
		}}
	/>
{/if}
