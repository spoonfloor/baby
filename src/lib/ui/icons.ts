/** Icon shapes as SVG paths on a 24×24 grid, all drawn with the same stroke by Icon.svelte. */
export const icons = {
	plus: 'M12 5v14M5 12h14',
	return: 'M20 5v7a3 3 0 0 1-3 3H5M9 11l-4 4 4 4'
};

export type IconName = keyof typeof icons;
