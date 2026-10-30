import { isMainThread, parentPort, Worker, workerData } from 'node:worker_threads';
import { parseArgs } from 'node:util';
import { Model } from '#lib/baby/model.ts';
import { seededRandom } from '#lib/baby/random.ts';
import { chatbot101, firstWord } from '#lib/library/chatbot-101.ts';
import type { Primer } from '#lib/library/primer.ts';
import { curriculumProbes, type Probe } from '../probes.ts';

/**
 * Why does learning Hello first cost the lessons after it? Three curricula, each
 * through the end of Chatbot 101, scored on the lessons’ trained and near probes:
 *
 * - none:   the lessons alone, as before Hello.
 * - first:  Hello read on its own first, as every Baby does now.
 * - folded: Hello’s conversations read inside Greetings, never on their own.
 *
 * If only `first` regresses, the cause is what reading Hello alone does to Baby
 * (practicing on one word until it is certain of it), not Hello’s text.
 *
 *   node --experimental-strip-types lab/experiments/hello-first.ts --seeds 10
 */

const CURRICULA = ['none', 'first', 'folded'] as const;
type Curriculum = (typeof CURRICULA)[number];

interface Request {
	curriculum: Curriculum;
	seed: number;
	samples: number;
}

const lessons = chatbot101.filter((pack) => pack.id !== firstWord.id);

function readings(curriculum: Curriculum): Primer[] {
	if (curriculum === 'none') return lessons;
	if (curriculum === 'first') return [firstWord, ...lessons];
	const [greetings, ...rest] = lessons;
	if (!greetings) throw new Error('Chatbot 101 has no lessons');
	return [{ ...greetings, documents: [...firstWord.documents, ...greetings.documents] }, ...rest];
}

const probes: Probe[] = curriculumProbes(lessons).filter((probe) => probe.tier !== 'held-out');

/** Acceptable replies per probe, `pack|tier|prompt` → [acceptable, asked]. */
async function trial({ curriculum, seed, samples }: Request): Promise<Record<string, number[]>> {
	const model = new Model({ random: seededRandom(seed), idle: async () => {} });
	for (const { id: source, title, documents } of readings(curriculum)) {
		for await (const event of model.read({ source, title, documents })) void event;
	}
	const scores: Record<string, number[]> = {};
	for (const probe of probes) {
		let acceptable = 0;
		for (let i = 0; i < samples; i++) {
			const words: string[] = [];
			let stop = '';
			for await (const event of model.reply(probe.prompt)) {
				if (event.type === 'token') words.push(event.text.trim());
				if (event.type === 'trace') stop = event.trace.stop;
			}
			if (stop === 'eos' && probe.accept.includes(words.join(' '))) acceptable++;
		}
		scores[`${probe.pack}|${probe.tier}|${probe.prompt}`] = [acceptable, samples];
	}
	return scores;
}

if (!isMainThread) {
	parentPort?.postMessage(await trial(workerData as Request));
} else {
	const { values: options } = parseArgs({
		options: {
			seeds: { type: 'string', default: '10' },
			samples: { type: 'string', default: '20' }
		}
	});
	const run = (request: Request) =>
		new Promise<Record<string, number[]>>((resolve, reject) => {
			const worker = new Worker(new URL(import.meta.url), { workerData: request });
			worker.once('message', resolve);
			worker.once('error', reject);
		});

	const seeds = Array.from({ length: Number(options.seeds) }, (_, i) => i + 1);
	const results = await Promise.all(
		CURRICULA.map(async (curriculum) => ({
			curriculum,
			trials: await Promise.all(
				seeds.map((seed) => run({ curriculum, seed, samples: Number(options.samples) }))
			)
		}))
	);

	console.log(`${seeds.length} seeds, trained / near, after all of Chatbot 101\n`);
	console.log(['pack'.padEnd(12), ...CURRICULA.map((c) => c.padEnd(12))].join(''));
	for (const pack of lessons) {
		const cells = results.map(({ trials }) => {
			const rate = (tier: Probe['tier']) => {
				const rates = probes
					.filter((probe) => probe.pack === pack.id && probe.tier === tier)
					.map((probe) => {
						const key = `${probe.pack}|${probe.tier}|${probe.prompt}`;
						const [acceptable, asked] = trials.reduce(
							([a, n], scores) => [a + (scores[key]?.[0] ?? 0), n + (scores[key]?.[1] ?? 0)],
							[0, 0]
						);
						return acceptable / asked;
					});
				return Math.round((rates.reduce((sum, r) => sum + r, 0) / rates.length) * 100);
			};
			return `${rate('trained')}% / ${rate('near')}%`.padEnd(12);
		});
		console.log([pack.id.padEnd(12), ...cells].join(''));
	}
}
