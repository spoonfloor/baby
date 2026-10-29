import { parseArgs } from 'node:util';
import { Model, type ModelSnapshot } from '#lib/baby/model.ts';
import { seededRandom } from '#lib/baby/random.ts';
import type { Reading } from '#lib/baby/index.ts';
import { tokenize } from '#lib/baby/vocabulary.ts';
import { parseScripts } from '#lib/baby/script.ts';
import { chatbot101 } from '#lib/library/chatbot-101.ts';
import type { Pack } from '#lib/library/pack.ts';
import { probesFor } from '../probes.ts';

/**
 * Can the user teach Baby a reply from chat? A newborn Baby reads Greetings and
 * Thanks; then copies of it each read the same corrections (a message from a real
 * chat, and the reply Baby should have given) as a script, repeated `weight` times,
 * and are asked the corrected messages and near variants of them.
 *
 *   node --experimental-strip-types lab/experiments/corrections.ts --seed 1
 */

/** Messages from real chats (2026-10-28), each with a reply in Baby’s character. */
const corrections: [string, string][] = [
	['you’re the best', 'Thank you!'],
	['this is getting a little repetitive', 'Oh no. I only know a few words.'],
	['Why do you keep telling me that?', 'I don’t know yet.'],
	['I think we’re getting into a rut', 'Oh no. Teach me more?'],
	['IDK', 'Me too!']
];

/** Each corrected message and a near variant, with the replies that count. */
const test: [string, string[]][] = [
	['you’re the best', ['Thank you!']],
	['you are the best, Baby!', ['Thank you!']],
	['this is getting a little repetitive', ['Oh no. I only know a few words.']],
	['this is repetitive', ['Oh no. I only know a few words.']],
	['Why do you keep telling me that?', ['I don’t know yet.']],
	['why do you keep saying that?', ['I don’t know yet.']],
	['I think we’re getting into a rut', ['Oh no. Teach me more?']],
	['we are in a rut', ['Oh no. Teach me more?']],
	['IDK', ['Me too!']],
	['idk, Baby', ['Me too!']]
];

const WEIGHTS = [1, 3, 10];

function lesson(id: string): Pack {
	const pack = chatbot101.find((pack) => pack.id === id);
	if (!pack) throw new Error(`No pack “${id}” in Chatbot 101`);
	return pack;
}

async function read(model: Model, reading: Reading): Promise<string> {
	let status = '';
	for await (const event of model.read(reading)) if (event.type === 'status') status = event.text;
	return status;
}

async function ask(model: Model, prompt: string): Promise<string> {
	const words: string[] = [];
	for await (const event of model.reply(prompt)) {
		if (event.type === 'token') words.push(event.text.trim());
	}
	return words.join(' ') || '(nothing)';
}

const tokens = (text: string) => tokenize(text).join(' ');

/** Share of samples, over the lessons’ trained and near probes, with an acceptable reply. */
async function probeScore(model: Model, packs: Pack[], samples: number): Promise<number> {
	let good = 0;
	let total = 0;
	for (const probe of packs.flatMap(probesFor)) {
		if (probe.tier === 'held-out') continue;
		for (let i = 0; i < samples; i++) {
			if (probe.accept.includes(await ask(model, probe.prompt))) good++;
			total++;
		}
	}
	return good / total;
}

/** One line per test message: how often the taught reply came back, and a few replies. */
async function testLines(model: Model, samples: number): Promise<string[]> {
	const lines: string[] = [];
	for (const [prompt, accept] of test) {
		const replies: string[] = [];
		for (let i = 0; i < samples; i++) replies.push(await ask(model, prompt));
		const good = replies.filter((reply) => accept.map(tokens).includes(reply)).length;
		const examples = [...new Set(replies)].slice(0, 3).join(' | ');
		lines.push(`${String(good).padStart(2)}/${samples}  ${prompt}  →  ${examples}`);
	}
	return lines;
}

const { values: options } = parseArgs({
	options: {
		seed: { type: 'string', default: '1' },
		samples: { type: 'string', default: '10' }
	}
});
const seed = Number(options.seed);
const samples = Number(options.samples);

const lessons = [lesson('greetings'), lesson('thanks')];
const newborn = new Model({ random: seededRandom(seed), idle: async () => {} });
for (const pack of lessons) {
	await read(newborn, { source: pack.id, title: pack.title, documents: pack.documents });
}
const taught: ModelSnapshot = newborn.snapshot();
const script = corrections.map(([you, baby]) => `you: ${you}\nbaby: ${baby}`).join('\n\n');

const out = [`## seed ${seed}`, '', '### lessons only', ...(await testLines(newborn, samples))];
const base = await probeScore(newborn, lessons, samples);
for (const weight of WEIGHTS) {
	const model = new Model({ random: seededRandom(seed), idle: async () => {}, snapshot: taught });
	const status = await read(model, {
		source: 'corrections',
		title: 'Corrections',
		documents: Array.from({ length: weight }, () => parseScripts(script)).flat()
	});
	const score = await probeScore(model, lessons, samples);
	out.push(
		'',
		`### corrections ×${weight}`,
		status,
		`lesson probes (trained + near): ${Math.round(base * 100)}% → ${Math.round(score * 100)}%`,
		...(await testLines(model, samples))
	);
}
console.log(out.join('\n') + '\n');
