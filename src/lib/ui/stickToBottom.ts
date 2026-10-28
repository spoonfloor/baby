import type { Attachment } from 'svelte/attachments';

/**
 * Keeps the page scrolled to the bottom as the attached element grows (e.g.
 * while Baby streams a reply), unless the user has scrolled up to read.
 * `pin()` follows the bottom again, e.g. when the user sends.
 */
export function stickToBottom(): { attachment: Attachment<HTMLElement>; pin: () => void } {
	const page = document.scrollingElement ?? document.documentElement;
	let pinned = true;

	const toBottom = () => {
		page.scrollTop = page.scrollHeight;
	};

	const attachment: Attachment<HTMLElement> = (element) => {
		let lastTop = page.scrollTop;

		// Only the user moving up lets go. Our own scrolls only go down, and content
		// growing doesn’t move scrollTop, so neither can unpin while a reply streams.
		const onScroll = () => {
			const atBottom = page.scrollHeight - page.scrollTop - page.clientHeight < 1;
			pinned = atBottom || (pinned && page.scrollTop >= lastTop);
			lastTop = page.scrollTop;
		};
		const observer = new ResizeObserver(() => {
			if (pinned) toBottom();
		});

		window.addEventListener('scroll', onScroll, { passive: true });
		observer.observe(element);

		return () => {
			window.removeEventListener('scroll', onScroll);
			observer.disconnect();
		};
	};

	return {
		attachment,
		pin() {
			pinned = true;
			toBottom();
		}
	};
}
