import { getContext, setContext } from 'svelte';

const key = Symbol('surface');

/** Called by `Surface`: lets what's inside it (a menu) find the surface's edge. */
export function provideSurface(element: () => HTMLElement): void {
	setContext(key, element);
}

/** The surface this component sits on, if any. */
export function enclosingSurface(): (() => HTMLElement) | undefined {
	return getContext(key);
}
