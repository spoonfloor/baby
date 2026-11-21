/**
 * Facts about the browser that change what copy should tell a person to do. Read
 * once: neither changes while the page is open.
 */

interface UserAgentData {
	platform: string;
}

function platform(): string {
	const data = (navigator as Navigator & { userAgentData?: UserAgentData }).userAgentData;
	return data?.platform ?? navigator.platform;
}

/** The keys that save a page: ⌘S on Apple devices, Ctrl+S elsewhere. */
export function saveKeys(): '⌘S' | 'Ctrl+S' {
	return /mac|iphone|ipad/i.test(platform()) ? '⌘S' : 'Ctrl+S';
}

/**
 * The browser is Safari, which saves pages as web archives unless told to save
 * Page Source. Other browsers on Apple devices name themselves alongside “Safari”.
 */
export function isSafari(): boolean {
	const agent = navigator.userAgent;
	return /safari/i.test(agent) && !/chrome|chromium|crios|fxios|firefox|edg|opr/i.test(agent);
}
