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
		type FetchProblem
	} from './fetchThroughServer.ts';
	import { readable } from './readable.ts';

	interface Props {
		saves: Saves;
		/** Something was found to read; the flow is done. */
		onfound: (found: Extracted) => void;
		onclose: () => void;
	}

	let { saves, onfound, onclose }: Props = $props();

	let address = $state('');
	let working: string | undefined = $state();
	let problem: string | undefined = $state();
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
		refused: 'That site won’t send its pages to your server.',
		missing: 'That site has no page at that address.',
		slow: 'The site took too long to answer.',
		failed: 'The site wouldn’t send that page.',
		type: 'That address isn’t a page or a feed.',
		large: 'That page is too big to read.',
		error: 'Something went wrong. Try again.'
	};

	async function next() {
		const connection = saves.connection;
		if (!connection) return;
		const url = normalizeUrl(address);
		if (!url) {
			problem = PROBLEMS.address;
			return;
		}
		working = 'Fetching';
		problem = undefined;
		try {
			const found = await readable((address) => fetchThroughServer(connection, address), url);
			if (found.kind === 'page' && found.source.documents.length === 0) {
				problem = 'That page didn’t have any text to read.';
			} else if (found.kind === 'feed' && found.sources.length === 0) {
				problem = 'That feed has no posts to read.';
			} else {
				onfound(found);
			}
		} catch (error) {
			if (!(error instanceof FetchProblemError)) console.error(error);
			problem = PROBLEMS[error instanceof FetchProblemError ? error.problem : 'error'];
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
	onnext={next}
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
