import { parentPort, workerData } from 'node:worker_threads';
import { Model } from '#lib/baby/model.ts';
import { seededRandom } from '#lib/baby/random.ts';
import { chatbot101 } from '#lib/library/chatbot-101.ts';
import { probesFor } from './probes.ts';

/**
 * One trial, in its own thread: a newborn Baby with one seed reads the packs in
 * curriculum order through the app’s own `Model`, and after each pack every probe
 * so far is asked `samples` times.
 */

export interface TrialRequest {
	seed: number;
	/** How many packs of Chatbot 101 to read, from the start. */
	packs: number;
	samples: number;
}

/** A reply as Baby gave it, and whether it stopped on [EOS] or hit the length limit. */
export interface Sample {
	reply: string;
	stop: 'eos' | 'limit';
}

export interface Stage {
	/** The pack just read. */
	pack: string;
	/** The model’s own summary of the reading, as the app shows it. */
	status: string;
	seconds: number;
	/** Samples per probe, keyed by `pack|prompt`. */
	samples: Record<string, Sample[]>;
}

export const probeKey = (pack: string, prompt: string) => `${pack}|${prompt}`;

async function ask(model: Model, prompt: string): Promise<Sample> {
	const words: string[] = [];
	let stop: Sample['stop'] = 'eos';
	for await (const event of model.reply(prompt)) {
		if (event.type === 'token') words.push(event.text.trim());
		if (event.type === 'trace') stop = event.trace.stop;
	}
	return { reply: words.join(' '), stop };
}

async function trial({ seed, packs, samples }: TrialRequest): Promise<Stage[]> {
	const model = new Model({ random: seededRandom(seed), idle: async () => {} });
	const read = chatbot101.slice(0, packs);
	const stages: Stage[] = [];
	for (const pack of read) {
		const started = performance.now();
		let status = '';
		for await (const event of model.read({
			source: pack.id,
			title: pack.title,
			documents: pack.documents
		})) {
			if (event.type === 'status') status = event.text;
		}
		const seconds = (performance.now() - started) / 1000;

		const asked: Stage['samples'] = {};
		for (const probe of read.slice(0, stages.length + 1).flatMap(probesFor)) {
			const replies: Sample[] = [];
			for (let i = 0; i < samples; i++) replies.push(await ask(model, probe.prompt));
			asked[probeKey(probe.pack, probe.prompt)] = replies;
		}
		stages.push({ pack: pack.id, status, seconds, samples: asked });
	}
	return stages;
}

parentPort?.postMessage(await trial(workerData as TrialRequest));
