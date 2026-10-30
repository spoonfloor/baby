import { isMainThread, parentPort, Worker, workerData } from 'node:worker_threads';
import { parseArgs } from 'node:util';
import { Model } from '#lib/baby/model.ts';
import { seededRandom } from '#lib/baby/random.ts';
import { tokenize } from '#lib/baby/vocabulary.ts';
import { firstWord } from '#lib/library/chatbot-101.ts';
import type { Primer } from '#lib/library/primer.ts';
import { heldOutExchanges } from '#lib/library/therapy-bot/script.ts';
import { therapyBot } from '#lib/library/therapy-bot/index.ts';

/**
 * Does Baby copy your words back after reading Therapy Bot, or recite and blend?
 * Each seed reads Hello (as every Baby does), then Therapy Bot, and is asked:
 *
 * - trained:  prompts from the script, scored against their own reply.
 * - held-out: the script’s sentence shapes filled with words it read elsewhere but
 *             never in that shape. Acceptable is the reply the script would give;
 *             echo is the reply copying your words back, pointed at you.
 * - casual:   things a person might say, printed to read, not scored.
 *
 * Every reply also counts as recited (a whole reply from the script, just not the
 * right one) or salad (neither acceptable nor recited), the closest a number gets to
 * “broken”.
 *
 *   node --experimental-strip-types lab/experiments/therapy-bot.ts --seeds 5
 */

interface Probe {
	prompt: string;
	/** Acceptable replies, as tokens joined by spaces. */
	accept: string[];
	/** Words the reply should copy back, as tokens joined by spaces. */
	echo?: string;
}

interface Script {
	primer: Primer;
	trained: Probe[];
	heldOut: Probe[];
}

const words = (text: string) => tokenize(text).join(' ');

/** Each conversation’s turns as text: what you said, and the reply. */
function turns(primer: Primer): [string, string][] {
	return primer.documents.map((document) => {
		const you = document.indexOf('[YOU]');
		const baby = document.indexOf('[BABY]');
		const end = (from: number) => document.indexOf('[EOS]', from);
		return [
			document.slice(you + 1, end(you)).join(' '),
			document.slice(baby + 1, end(baby)).join(' ')
		];
	});
}

/** Every 30th conversation of the script, as asked to and answered by it. */
function trainedProbes(primer: Primer): Probe[] {
	return turns(primer)
		.filter((_, index) => index % 30 === 0)
		.map(([prompt, reply]) => ({ prompt, accept: [reply] }));
}

const SCRIPT: Script = {
	primer: therapyBot,
	trained: trainedProbes(therapyBot),
	heldOut: heldOutExchanges.map(({ exchange: [you, baby], echo }) => ({
		prompt: words(you),
		accept: [words(baby)],
		echo: words(echo)
	}))
};

const CASUAL = [
	'i am sleepy',
	'i feel like the barber judges me',
	'I am sad',
	'I told you I am sad',
	'I am tired today',
	'My mom never calls me',
	'my boss hates me',
	'I hate mondays',
	'I can’t sleep',
	'I want help with my problems',
	'No, I don’t think so',
	'What? What does that mean?',
	'Yes, a bit',
	'You are the worst!',
	'hello',
	'I don’t know'
];

/**
 * The probes Baby can be asked fairly: held-out ones must be new to the script and
 * use only words it read, or they would test reciting, or [UNK].
 */
function fair(script: Script): Script {
	const read = new Set(script.primer.documents.flat());
	const said = new Set(turns(script.primer).map(([you]) => you));
	return {
		...script,
		heldOut: script.heldOut.filter(
			(probe) => !said.has(probe.prompt) && tokenize(probe.prompt).every((word) => read.has(word))
		)
	};
}

interface Request {
	seed: number;
	samples: number;
}

interface Asked {
	prompt: string;
	replies: string[];
}

interface Trial {
	status: string;
	trained: Asked[];
	heldOut: Asked[];
	casual: Asked[];
}

const script = fair(SCRIPT);

async function trial({ seed, samples }: Request): Promise<Trial> {
	const model = new Model({ random: seededRandom(seed), idle: async () => {} });
	let status = '';
	for (const { id: source, title, documents } of [firstWord, script.primer]) {
		for await (const event of model.read({ source, title, documents })) {
			if (event.type === 'status') status = event.text;
		}
	}
	const ask = async (prompt: string): Promise<Asked> => {
		const replies: string[] = [];
		for (let i = 0; i < samples; i++) {
			const said: string[] = [];
			let stop = '';
			for await (const event of model.reply(prompt)) {
				if (event.type === 'token') said.push(event.text.trim());
				if (event.type === 'trace') stop = event.trace.stop;
			}
			replies.push(`${said.join(' ')}${stop === 'eos' ? '' : ` [${stop}]`}`);
		}
		return { prompt, replies };
	};
	const askAll = async (prompts: string[]) => {
		const all: Asked[] = [];
		for (const prompt of prompts) all.push(await ask(prompt));
		return all;
	};
	return {
		status,
		trained: await askAll(script.trained.map((probe) => probe.prompt)),
		heldOut: await askAll(script.heldOut.map((probe) => probe.prompt)),
		casual: await askAll(CASUAL)
	};
}

if (!isMainThread) {
	parentPort?.postMessage(await trial(workerData as Request));
} else {
	const { values: options } = parseArgs({
		options: {
			seeds: { type: 'string', default: '5' },
			samples: { type: 'string', default: '10' }
		}
	});
	const run = (request: Request) =>
		new Promise<Trial>((resolve, reject) => {
			const worker = new Worker(new URL(import.meta.url), { workerData: request });
			worker.once('message', resolve);
			worker.once('error', reject);
		});
	const seeds = Array.from({ length: Number(options.seeds) }, (_, i) => i + 1);
	const trials = await Promise.all(
		seeds.map((seed) => run({ seed, samples: Number(options.samples) }))
	);

	const recitable = new Set(turns(script.primer).map(([, reply]) => reply));
	const pct = (n: number, of: number) => `${Math.round((n / of) * 100)}%`.padStart(4);

	function score(label: string, probes: Probe[], pick: (trial: Trial) => Asked[]) {
		let asked = 0;
		let acceptable = 0;
		let echoed = 0;
		let recited = 0;
		let clean = 0;
		probes.forEach((probe, index) => {
			for (const trial of trials) {
				for (const reply of pick(trial)[index]?.replies ?? []) {
					asked++;
					const ok = !reply.includes('[') && probe.accept.includes(reply);
					if (ok) acceptable++;
					if (probe.echo && ` ${reply} `.includes(` ${probe.echo} `)) echoed++;
					if (!ok && recitable.has(reply)) recited++;
					if (!reply.includes('[')) clean++;
				}
			}
		});
		const salad = asked - acceptable - recited;
		console.log(
			`${label.padEnd(9)} ${String(probes.length).padStart(3)} probes  acceptable ${pct(acceptable, asked)}` +
				(probes.some((probe) => probe.echo) ? `  echo ${pct(echoed, asked)}` : '') +
				`  recited ${pct(recited, asked)}  salad ${pct(salad, asked)}  clean stop ${pct(clean, asked)}`
		);
	}

	console.log(`Therapy Bot: ${seeds.length} seeds × ${options.samples} samples`);
	for (const [seed, trial] of trials.entries()) console.log(`  seed ${seed + 1}: ${trial.status}`);
	console.log();
	score('trained', script.trained, (trial) => trial.trained);
	score('held-out', script.heldOut, (trial) => trial.heldOut);

	const shown = (asked: Asked[] | undefined, index: number) => {
		const counts = new Map<string, number>();
		for (const trial of trials) {
			for (const reply of trial[asked === undefined ? 'casual' : 'heldOut'][index]?.replies ?? []) {
				counts.set(reply, (counts.get(reply) ?? 0) + 1);
			}
		}
		return [...counts]
			.sort((a, b) => b[1] - a[1])
			.slice(0, 3)
			.map(([reply, n]) => `${reply || '(nothing)'} ×${n}`)
			.join('  |  ');
	};
	console.log('\nHeld-out, top replies:');
	script.heldOut.forEach((probe, index) => {
		if (index % 3 === 0) console.log(`  ${probe.prompt}\n      ${shown([], index)}`);
	});
	console.log('\nCasual, top replies:');
	CASUAL.forEach((prompt, index) => console.log(`  ${prompt}\n      ${shown(undefined, index)}`));
}
