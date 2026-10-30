/** Icon shapes as SVG paths on a 24×24 grid, all drawn with the same stroke by Icon.svelte. */
export const icons = {
	plus: 'M12 5v14M5 12h14',
	expand: 'M6 9l6 6 6-6',
	collapse: 'M6 15l6-6 6 6',
	check: 'M5 12l5 5 9-10',
	close: 'M6 6l12 12M18 6L6 18',
	return: 'M20 5v7a3 3 0 0 1-3 3H5M9 11l-4 4 4 4',
	// Lucide’s “user-pen” (ISC license).
	personEdit:
		'M11.5 15H7a4 4 0 0 0-4 4v2M21.378 16.626a1 1 0 0 0-3.004-3.004l-4.01 4.012a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506zM14 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
	// Lucide’s “settings” gear (ISC license).
	gear: 'M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2zM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0'
};

export type IconName = keyof typeof icons;
