import type { Attachment } from 'svelte/attachments';

/**
 * Keeps the page scrolled to the bottom as `element` grows (e.g. while Baby
 * streams a reply), unless the user has scrolled up to read.
 */
export const stickToBottom: Attachment<HTMLElement> = (element) => {
	const page = document.scrollingElement ?? document.documentElement;
	let pinned = true;

	const onScroll = () => {
		pinned = page.scrollHeight - page.scrollTop - page.clientHeight < 1;
	};
	const observer = new ResizeObserver(() => {
		if (pinned) page.scrollTop = page.scrollHeight;
	});

	window.addEventListener('scroll', onScroll, { passive: true });
	observer.observe(element);

	return () => {
		window.removeEventListener('scroll', onScroll);
		observer.disconnect();
	};
};
