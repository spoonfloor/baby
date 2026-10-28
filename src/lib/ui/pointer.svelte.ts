import { MediaQuery } from 'svelte/reactivity';

const coarse = new MediaQuery('pointer: coarse');

/** “Tap” where the main pointer is a finger, “Click” otherwise. Reactive. */
export function pointerVerb(): 'Click' | 'Tap' {
	return coarse.current ? 'Tap' : 'Click';
}
