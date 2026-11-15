import { layOut, toGraph, type Point } from '../guessMap.ts';
import type { GraphRequest, GraphResponse } from '../graphProtocol.ts';

/**
 * Lays out the Graph of each reply asked for, off the page’s thread: its balls
 * first, then where they rest at each step, one step per message, in order. One
 * step at a time across every reply asked for, the one asked for latest first, so
 * opening a reply’s Graph overtakes laying out another.
 */

const post = (response: GraphResponse) => self.postMessage(response);

interface Job {
	id: number;
	steps: Generator<Map<string, Point>>;
}

const jobs: Job[] = [];
let working = false;

self.addEventListener('message', ({ data }: MessageEvent<GraphRequest>) => {
	const graph = toGraph(data.steps, data.sizes);
	post({ type: 'balls', id: data.id, graph });
	jobs.push({ id: data.id, steps: layOut(graph, data.sizes.gap) });
	if (!working) void work();
});

async function work() {
	working = true;
	for (let job = jobs.at(-1); job; job = jobs.at(-1)) {
		const next = job.steps.next();
		if (next.done) jobs.pop();
		else post({ type: 'places', id: job.id, places: next.value });
		// A macrotask between steps, so a newer request gets in.
		await new Promise((resolve) => setTimeout(resolve));
	}
	working = false;
}
