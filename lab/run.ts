import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { Worker } from 'node:worker_threads';
import { chatbot101 } from '#lib/library/chatbot-101.ts';
import { curriculumProbes, TARGETS, type Probe, type Tier } from './probes.ts';
import { probeKey, type Sample, type Stage, type TrialRequest } from './trial.ts';

/**
 * The lesson lab: trains Baby headless on Chatbot 101 with several seeds at once,
 * scores its replies against the probes, and prints how each pack does against
 * its targets, with the change since the previous run.
 *
 *   npm run lab                          all packs, 5 seeds, 20 samples per probe
 *   npm run lab -- --through greetings   stop after a pack (fast iteration)
 *   npm run lab -- --seeds 3 --samples 10 --detail thanks
 */

const { values: options } = parseArgs({
	options: {
		seeds: { type: 'string', default: '5' },
		samples: { type: 'string', default: '20' },
		through: { type: 'string' },
		/** Pack ids whose probes get printed reply by reply; defaults to every pack read. */
		detail: { type: 'string', multiple: true }
	}
});

const REPORTS = new URL('./reports/', import.meta.url);
const LATEST = new URL('latest.json', REPORTS);

const seeds = Number(options.seeds);
const samples = Number(options.samples);
const packs = options.through
	? chatbot101.findIndex((pack) => pack.id === options.through) + 1
	: chatbot101.length;
if (packs === 0) throw new Error(`No pack “${options.through}” in Chatbot 101`);
const read = chatbot101.slice(0, packs);
// Checked against every lesson, read or not, so no probe is ever taught.
const probes = curriculumProbes(chatbot101).filter((probe) =>
	read.some((pack) => pack.id === probe.pack)
);

function runTrial(request: TrialRequest): Promise<Stage[]> {
	return new Promise((resolve, reject) => {
		const worker = new Worker(new URL('./trial.ts', import.meta.url), { workerData: request });
		worker.once('message', resolve);
		worker.once('error', reject);
	});
}

// --- Scoring ---

/** How a reply’s ending shows in the readout; a clean [EOS] shows nothing. */
const ENDINGS: Record<Sample['stop'], string> = { eos: '', turn: ' [new turn]', limit: ' …' };

const isAcceptable = (probe: Probe, sample: Sample) =>
	sample.stop === 'eos' && probe.accept.includes(sample.reply);
const rate = (samples: Sample[], test: (sample: Sample) => boolean) =>
	samples.length === 0 ? NaN : samples.filter(test).length / samples.length;

/** Every seed’s samples for each probe at one stage, pooled. */
function pooled(trials: Stage[][], stage: number): Map<string, Sample[]> {
	const pool = new Map<string, Sample[]>();
	for (const trial of trials) {
		for (const [key, list] of Object.entries(trial[stage]?.samples ?? {})) {
			pool.set(key, [...(pool.get(key) ?? []), ...list]);
		}
	}
	return pool;
}

interface PackScore {
	trained: number;
	near: number;
	heldOut: number;
	cleanStop: number;
	roleLeak: number;
	/** Trained + near acceptable, the number forgetting is measured on. */
	core: number;
}

function scorePack(pack: string, pool: Map<string, Sample[]>): PackScore {
	const own = probes.filter((probe) => probe.pack === pack);
	const acceptable = (tiers: Tier[]) => {
		const rates = own
			.filter((probe) => tiers.includes(probe.tier))
			.map((probe) =>
				rate(pool.get(probeKey(pack, probe.prompt)) ?? [], (s) => isAcceptable(probe, s))
			);
		return rates.reduce((sum, r) => sum + r, 0) / rates.length;
	};
	const all = own.flatMap((probe) => pool.get(probeKey(pack, probe.prompt)) ?? []);
	return {
		trained: acceptable(['trained']),
		near: acceptable(['near']),
		heldOut: acceptable(['held-out']),
		cleanStop: rate(all, (s) => s.stop === 'eos'),
		roleLeak: rate(all, (s) => s.stop === 'turn'),
		core: acceptable(['trained', 'near'])
	};
}

// --- Report ---

interface Report {
	date: string;
	options: { seeds: number; samples: number; packs: string[] };
	/** Each pack’s score right after it was read, and after the last pack. */
	packs: Record<string, { own: PackScore; final: PackScore; forgetting: number }>;
	probes: Record<string, { tier: Tier; acceptable: number; replies: [string, number][] }>;
	readings: string[];
}

const percent = (n: number) => (Number.isNaN(n) ? '  –' : `${Math.round(n * 100)}%`.padStart(4));
const delta = (now: number, before: number | undefined) => {
	if (before === undefined || Number.isNaN(now) || Number.isNaN(before)) return '';
	const change = Math.round((now - before) * 100);
	return change === 0 ? '' : ` (${change > 0 ? '+' : ''}${change})`;
};
const mark = (pass: boolean) => (pass ? '✓' : '✗');

function printReport(report: Report, previous: Report | undefined) {
	console.log(`\nReadings (seed 1):`);
	for (const line of report.readings) console.log(`  ${line}`);

	for (const [pack, { final, forgetting }] of Object.entries(report.packs)) {
		const before = previous?.packs[pack];
		const row = (label: string, now: number, then: number | undefined, pass?: boolean) =>
			`  ${pass === undefined ? ' ' : mark(pass)} ${label.padEnd(11)} ${percent(now)}${delta(now, then)}`;
		console.log(`\n${pack}`);
		console.log(
			row('trained', final.trained, before?.final.trained, final.trained >= TARGETS.trained)
		);
		console.log(row('near', final.near, before?.final.near, final.near >= TARGETS.near));
		console.log(row('held-out', final.heldOut, before?.final.heldOut));
		console.log(
			row(
				'clean stop',
				final.cleanStop,
				before?.final.cleanStop,
				final.cleanStop >= TARGETS.cleanStop
			)
		);
		console.log(
			row('role leak', final.roleLeak, before?.final.roleLeak, final.roleLeak <= TARGETS.roleLeak)
		);
		console.log(
			row('forgetting', forgetting, before?.forgetting, forgetting <= TARGETS.forgetting)
		);
	}

	const detailed = options.detail ?? read.map((pack) => pack.id);
	for (const probe of probes.filter((p) => detailed.includes(p.pack))) {
		const result = report.probes[probeKey(probe.pack, probe.prompt)];
		if (!result) continue;
		const top = result.replies
			.slice(0, 3)
			.map(([reply, n]) => `${reply || '(nothing)'} ×${n}`)
			.join('  |  ');
		console.log(
			`\n${percent(result.acceptable)}  ${probe.pack} · ${probe.tier.padEnd(8)}  ${probe.prompt}\n      ${top}`
		);
	}
}

function buildReport(trials: Stage[][]): Report {
	const final = pooled(trials, packs - 1);
	const report: Report = {
		date: new Date().toISOString(),
		options: { seeds, samples, packs: read.map((pack) => pack.id) },
		packs: {},
		probes: {},
		readings: trials[0]?.map((stage) => `${stage.status} · ${stage.seconds.toFixed(0)}s`) ?? []
	};
	read.forEach((pack, index) => {
		const own = scorePack(pack.id, pooled(trials, index));
		const last = scorePack(pack.id, final);
		report.packs[pack.id] = { own, final: last, forgetting: Math.max(0, own.core - last.core) };
	});
	for (const probe of probes) {
		const list = final.get(probeKey(probe.pack, probe.prompt)) ?? [];
		const counts = new Map<string, number>();
		for (const sample of list) {
			const shown = `${sample.reply}${ENDINGS[sample.stop]}`;
			counts.set(shown, (counts.get(shown) ?? 0) + 1);
		}
		report.probes[probeKey(probe.pack, probe.prompt)] = {
			tier: probe.tier,
			acceptable: rate(list, (s) => isAcceptable(probe, s)),
			replies: [...counts].sort((a, b) => b[1] - a[1])
		};
	}
	return report;
}

async function readPrevious(): Promise<Report | undefined> {
	try {
		return JSON.parse(await readFile(LATEST, 'utf8')) as Report;
	} catch {
		return undefined;
	}
}

const started = performance.now();
console.log(
	`Training ${seeds} Babies on ${read.map((pack) => pack.id).join(', ')} · ${samples} samples per probe…`
);
const trials = await Promise.all(
	Array.from({ length: seeds }, (_, i) => runTrial({ seed: i + 1, packs, samples }))
);
const report = buildReport(trials);
const previous = await readPrevious();
printReport(report, previous);

await mkdir(REPORTS, { recursive: true });
const json = JSON.stringify(report, null, '\t');
await writeFile(new URL(`${report.date.replaceAll(':', '-')}.json`, REPORTS), json);
await writeFile(LATEST, json);
console.log(
	`\nDone in ${((performance.now() - started) / 1000).toFixed(0)}s · report in lab/reports/`
);
