<!-- Every UI part in every state, on one page, for design review. -->
<script lang="ts">
	import BabyMessage from '#lib/ui/BabyMessage.svelte';
	import Composer from '#lib/ui/Composer.svelte';
	import Spinner from '#lib/ui/Spinner.svelte';
	import StatusLine from '#lib/ui/StatusLine.svelte';
	import UserMessage from '#lib/ui/UserMessage.svelte';

	const short = 'Hello Baby!';
	const long =
		'Lorem ipsum dolor sit amet, consectetuer adipiscing elit, sed diam nonummy nibh euismod tincidunt ut laoreet dolore magna aliquam erat volutpat. Ut wisi enim ad minim veniam.';
	const multiline = 'First line\nSecond line\nThird line';
	const noop = () => {};
</script>

<main>
	<section>
		<h2>Composer</h2>
		<Composer placeholder="Talk to Baby" onsend={noop} />
		<Composer placeholder="Reply" value={short} onsend={noop} />
		<Composer placeholder="Reply" value={multiline} onsend={noop} />
		<Composer placeholder="Reply" value={long} ready={false} onsend={noop} />
	</section>

	<section>
		<h2>User message</h2>
		<UserMessage text={short} />
		<UserMessage text={long} />
		<UserMessage text={multiline} />
	</section>

	<section>
		<h2>Baby message</h2>
		<BabyMessage status="Picking random words…" text="" pending />
		<BabyMessage status="Picking random words…" text="moon the over" pending />
		<BabyMessage
			status="Picked 9 random words. Baby hasn't read anything yet."
			text={long}
			pending={false}
		/>
	</section>

	<section>
		<h2>Status line</h2>
		<StatusLine text="Active" active />
		<StatusLine text="Finished" active={false} />
	</section>

	<section>
		<h2>Spinner</h2>
		<Spinner spinning />
		<Spinner spinning={false} />
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
</style>
