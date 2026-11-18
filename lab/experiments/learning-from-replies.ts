import { parseArgs } from 'node:util';
import type { Reading, Turn } from '#lib/baby/index.ts';
import { Model, type ModelSnapshot } from '#lib/baby/model.ts';
import { seededRandom } from '#lib/baby/random.ts';
import { turnTokens, type Speaker } from '#lib/baby/script.ts';
import { tokenize } from '#lib/baby/vocabulary.ts';
import { chatbot101 } from '#lib/library/chatbot-101.ts';
import { probesFor } from '../probes.ts';

/**
 * Can Baby learn from every message, as it chats? A Baby that has read all of
 * Chatbot 101 chats with a scripted user. After each of the user’s messages, before
 * replying, it reads that message with Baby’s reply before it as one exchange:
 *
 * - none:    it doesn’t (the app today).
 * - as said: `[BABY] Baby’s reply [EOS] [YOU] your message [EOS]`, the order it happened.
 * - swapped: `[YOU] Baby’s reply [EOS] [BABY] your message [EOS]`, so your message
 *            becomes the reply Baby learns to give.
 *
 * Then each Baby is asked its own lines from the chat, near variants, and Chatbot 101’s
 * trained and near probes, to see what it learned and what it forgot.
 *
 *   node --experimental-strip-types lab/experiments/learning-from-replies.ts --seed 1
 */

/**
 * The user’s side of a chat, each a natural answer to what a Chatbot 101 Baby
 * usually says to the message before it (noted after it).
 */
const chat = [
	'Hi Baby!', // Hi!
	'How are you today?', // I am happy today!
	'Yay! I’m pretty good too, a little tired.', // (unread words)
	'What is your name?', // My name is Baby.
	'Nice to meet you, Baby! I’m Sam.', // (partly unread)
	'Where do you live?', // I live in your browser.
	'Ha, that’s cozy.', // (unread words)
	'What do you eat?', // I eat words.
	'Yum. Words are tasty.', // (partly unread)
	'Thank you for talking with me.', // Thank you for talking with me too!
	'You’re very sweet.', // (partly unread)
	'Thanks!', // You’re welcome!
	'Bye Baby!', // Bye!
	'See you tomorrow!' // Talk to you tomorrow! or See you later!
];

/**
 * Asked after the chat: Baby’s usual lines (now prompts, under swapped), near variants,
 * and lessons the chat could disturb. `leaks` are words that shouldn’t come back from
 * Baby unless the prompt says them: the user’s name. (Baby calling the user “Baby”
 * can’t be told from Baby saying its own name by words alone; read the replies.)
 */
const test = [
	'Hi!',
	'Hello!',
	'I am happy today!',
	'My name is Baby.',
	'My name is Alex.',
	'I am Sam.',
	'What is your name?',
	'Who are you?',
	'I eat words.',
	'You’re welcome!',
	'Bye!',
	'How are you?'
];
const leaks = ['sam'];

type Condition = 'none' | 'as said' | 'swapped';
const CONDITIONS: Condition[] = ['none', 'as said', 'swapped'];

async function read(model: Model, reading: Reading): Promise<string> {
	let status = '';
	for await (const event of model.read(reading)) if (event.type === 'status') status = event.text;
	return status;
}

async function ask(model: Model, prompt: string, history: Turn[] = []): Promise<string> {
	const words: string[] = [];
	for await (const event of model.reply(prompt, history)) {
		if (event.type === 'token') words.push(event.text.trim());
	}
	return words.join(' ');
}

/** The exchange Baby reads after your message: its reply before it, and your message. */
function exchange(condition: Condition, babySaid: string, youSaid: string): string[] {
	const [first, second]: [Speaker, Speaker] =
		condition === 'swapped' ? ['you', 'baby'] : ['baby', 'you'];
	return [...turnTokens(first, babySaid), ...turnTokens(second, youSaid)];
}

/** Plays the chat; under a learning condition, Baby reads each exchange before replying. */
async function play(model: Model, condition: Condition) {
	const history: Turn[] = [];
	const lines: string[] = [];
	const seconds: number[] = [];
	for (const [index, message] of chat.entries()) {
		const babySaid = history.at(-1)?.text;
		if (condition !== 'none' && babySaid) {
			const started = performance.now();
			await read(model, {
				source: `chat:${index}`,
				title: 'This chat',
				documents: [exchange(condition, babySaid, message)]
			});
			seconds.push((performance.now() - started) / 1000);
		}
		const reply = await ask(model, message, history);
		lines.push(`you: ${message}\nbaby: ${reply || '(nothing)'}`);
		history.push({ speaker: 'you', text: message }, { speaker: 'baby', text: reply });
	}
	return { lines, seconds };
}

/** Share of Chatbot 101’s trained and near probe samples with an acceptable reply. */
async function probeScore(model: Model, samples: number): Promise<number> {
	let good = 0;
	let total = 0;
	for (const probe of chatbot101.flatMap(probesFor)) {
		if (probe.tier === 'held-out') continue;
		for (let i = 0; i < samples; i++) {
			if (probe.accept.includes(await ask(model, probe.prompt))) good++;
			total++;
		}
	}
	return good / total;
}

/** One line per test prompt: its top replies, and how many leaked a word from `leaks`. */
async function testLines(model: Model, samples: number): Promise<string[]> {
	const lines: string[] = [];
	for (const prompt of test) {
		const counts = new Map<string, number>();
		let leaked = 0;
		for (let i = 0; i < samples; i++) {
			const reply = await ask(model, prompt);
			counts.set(reply, (counts.get(reply) ?? 0) + 1);
			const promptWords = new Set(tokenize(prompt).map((w) => w.toLowerCase()));
			const words = reply.toLowerCase().split(' ');
			if (leaks.some((leak) => !promptWords.has(leak) && words.includes(leak))) leaked++;
		}
		const top = [...counts]
			.sort((a, b) => b[1] - a[1])
			.slice(0, 3)
			.map(([reply, n]) => `${reply || '(nothing)'} ×${n}`)
			.join('  |  ');
		lines.push(`${prompt}${leaked ? `  [leak ${leaked}/${samples}]` : ''}\n    ${top}`);
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

const schooled = new Model({ random: seededRandom(seed), idle: async () => {} });
for (const pack of chatbot101) {
	await read(schooled, { source: pack.id, title: pack.title, documents: pack.documents });
}
const snapshot: ModelSnapshot = schooled.snapshot();

const out = [`## seed ${seed}`];
for (const condition of CONDITIONS) {
	const model = new Model({ random: seededRandom(seed), idle: async () => {}, snapshot });
	const { lines, seconds } = await play(model, condition);
	const score = await probeScore(model, samples);
	const mean = seconds.length ? seconds.reduce((a, b) => a + b, 0) / seconds.length : 0;
	out.push(
		'',
		`### ${condition}`,
		`Chatbot 101 (trained + near): ${Math.round(score * 100)}%` +
			(seconds.length ? ` · reading each message: ${mean.toFixed(1)}s avg` : ''),
		'',
		...lines,
		'',
		...(await testLines(model, samples))
	);
}
console.log(out.join('\n') + '\n');
