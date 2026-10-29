import { parseArgs } from 'node:util';
import { Model } from '#lib/baby/model.ts';
import { seededRandom } from '#lib/baby/random.ts';
import type { Reading } from '#lib/baby/index.ts';
import { EOS, tokenize } from '#lib/baby/vocabulary.ts';
import { chatbot101 } from '#lib/library/chatbot-101.ts';
import type { Pack } from '#lib/library/pack.ts';
import { probesFor } from '../probes.ts';

/**
 * Does reading the user’s own chat messages help? A newborn Baby reads Greetings and
 * Thanks, answers a test chat and the lessons’ probes, then reads the user’s messages
 * from a real chat as plain text (one document per message, no turn markers) and
 * answers them all again.
 *
 *   node --experimental-strip-types lab/experiments/learning-from-chat.ts --seed 1
 */

/** The user’s side of two real chats with Baby (2026-10-28). */
const chat = [
	'hi',
	'how are you?',
	'you are??',
	'good morning to you',
	'hi there',
	'this is getting a little repetitive',
	'you’re the best',
	'thank you!',
	'a welcome??',
	'you are too!',
	'Baby, I think.',
	'Confirmed. Your name is Baby.',
	'Why do you keep telling me that?',
	'You ARE good',
	'Words!',
	'IDK',
	'I think we’re getting into a rut'
];

/** Some of the chat again, then new messages that reuse its words. */
const test = [
	'hi baby',
	'how are you?',
	'this is getting a little repetitive',
	'you’re the best',
	'thank you!',
	'Why do you keep telling me that?',
	'I think we’re getting into a rut',
	'you are the best, baby',
	'that is repetitive',
	'I think you are good',
	'why?',
	'good morning, I think'
];

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

async function ask(model: Model, prompt: string): Promise<{ reply: string; unknown: number }> {
	const words: string[] = [];
	let unknown = 0;
	for await (const event of model.reply(prompt)) {
		if (event.type === 'token') words.push(event.text.trim());
		if (event.type === 'trace') unknown = event.trace.unknown.length;
	}
	return { reply: words.join(' ') || '(nothing)', unknown };
}

/** Share of probe samples, over every lesson read, that got an acceptable reply. */
async function probeScore(model: Model, packs: Pack[], samples: number): Promise<number> {
	let good = 0;
	let total = 0;
	for (const probe of packs.flatMap(probesFor)) {
		if (probe.tier === 'held-out') continue;
		for (let i = 0; i < samples; i++) {
			if (probe.accept.includes((await ask(model, probe.prompt)).reply)) good++;
			total++;
		}
	}
	return good / total;
}

async function transcript(model: Model): Promise<string[]> {
	const lines: string[] = [];
	for (const prompt of test) {
		const { reply, unknown } = await ask(model, prompt);
		lines.push(`you: ${prompt}${unknown ? `  (${unknown} unknown)` : ''}\nbaby: ${reply}`);
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

const model = new Model({ random: seededRandom(seed), idle: async () => {} });
const lessons = [lesson('greetings'), lesson('thanks')];
for (const pack of lessons) {
	await read(model, { source: pack.id, title: pack.title, documents: pack.documents });
}
const before = { score: await probeScore(model, lessons, samples), lines: await transcript(model) };

const status = await read(model, {
	source: 'chat',
	title: 'This conversation',
	documents: chat.map((message) => [...tokenize(message), EOS])
});
const after = { score: await probeScore(model, lessons, samples), lines: await transcript(model) };

const percent = (n: number) => `${Math.round(n * 100)}%`;
console.log(
	[
		`## seed ${seed}`,
		status,
		`lesson probes (trained + near): ${percent(before.score)} → ${percent(after.score)}`,
		'',
		'### before',
		...before.lines,
		'',
		'### after',
		...after.lines,
		''
	].join('\n')
);
