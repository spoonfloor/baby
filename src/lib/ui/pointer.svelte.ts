import { MediaQuery } from 'svelte/reactivity';

const coarse = new MediaQuery('pointer: coarse');

/** The main pointer is a finger: a phone or tablet, likely with an on-screen keyboard. Reactive. */
export function pointerIsFinger(): boolean {
	return coarse.current;
}

/** “Tap” where the main pointer is a finger, “Click” otherwise. Reactive. */
export function pointerVerb(): 'Click' | 'Tap' {
	return pointerIsFinger() ? 'Tap' : 'Click';
}
