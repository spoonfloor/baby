import type { ReplyStep } from '#lib/baby/index.ts';
import type { Ball, Point, Sizes } from './guessMap.ts';
import type { GraphRequest, GraphResponse } from './graphProtocol.ts';

/** The Graph of one reply, filled in as its worker lays it out. */
export class ReplyLayout {
	/** The balls at every step, once sent (see `toGraph`). */
	graph: Ball[][] | undefined = $state.raw();
	/** Where the balls rest at each step laid out so far, in order. */
	places: Map<string, Point>[] = $state.raw([]);

	/** How many steps, from the first, are ready to show. */
	get ready(): number {
		return this.places.length;
	}
}

/** Each reply’s layout, laid out once however often its Graph opens. */
const layouts = new WeakMap<readonly ReplyStep[], ReplyLayout>();
/** Layouts the worker is still filling in, by request. */
// eslint-disable-next-line svelte/prefer-svelte-reactivity -- bookkeeping; each layout holds its own state
const filling = new Map<number, ReplyLayout>();
let requests = 0;
let worker: Worker | undefined;

/**
 * The Graph of a reply, laid out off the page’s thread: started on the first call
 * for these steps, the same layout on every call after.
 */
export function layOutReply(steps: readonly ReplyStep[]): ReplyLayout {
	const known = layouts.get(steps);
	if (known) return known;
	const layout = new ReplyLayout();
	layouts.set(steps, layout);
	const id = requests++;
	filling.set(id, layout);
	const request: GraphRequest = {
		id,
		steps: $state.snapshot(steps) as ReplyStep[],
		sizes: sizes()
	};
	graphWorker().postMessage(request);
	return layout;
}

function graphWorker(): Worker {
	if (worker) return worker;
	worker = new Worker(new URL('./worker/graph.worker.ts', import.meta.url), { type: 'module' });
	worker.addEventListener('message', ({ data }: MessageEvent<GraphResponse>) => {
		const layout = filling.get(data.id);
		if (!layout) return;
		if (data.type === 'balls') layout.graph = data.graph;
		else layout.places = [...layout.places, data.places];
		if (layout.graph && layout.places.length === layout.graph.length) filling.delete(data.id);
	});
	return worker;
}

/** Ball sizes from the design tokens, as the browser resolved them. */
function sizes(): Sizes {
	const style = getComputedStyle(document.documentElement);
	const length = (name: string) => parseFloat(style.getPropertyValue(name));
	return {
		min: length('--size-guess-min'),
		max: length('--size-guess-max'),
		gap: length('--size-guess-gap')
	};
}
