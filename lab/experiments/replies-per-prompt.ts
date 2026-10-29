import { parseArgs } from 'node:util';
import { Model } from '#lib/baby/model.ts';
import { seededRandom } from '#lib/baby/random.ts';
import { chatbot101 } from '#lib/library/chatbot-101.ts';
import { scriptPack, type Pack } from '#lib/library/pack.ts';

/**
 * The 2026-10-28 A/B on replies per prompt (see log.md): a newborn Baby reads a
 * Greetings variant and then Thanks, and answers one casual chat.
 *
 *   node --experimental-strip-types lab/experiments/replies-per-prompt.ts --variant repeated --seed 1
 *
 * - single: Greetings as it is, one reply per prompt.
 * - framed: same prompts, a different reply per framing.
 * - repeated: Greetings plus common prompts again with a second reply.
 */

// Same prompts and same number of conversations as Greetings; only the replies vary.
const framed = scriptPack(
	'greetings',
	'Greetings',
	`
	you: Hi Baby!
	baby: Hi!

	you: Hi!
	baby: Hello!

	you: Hi, Baby.
	baby: Hi! How are you?

	you: Hello!
	baby: Hello!

	you: Hello, Baby!
	baby: Hi!

	you: Hello Baby.
	baby: Hello! How are you?

	you: Hey Baby.
	baby: Hey!

	you: Hey, Baby!
	baby: Hi there!

	you: Hey.
	baby: Hey! How are you?

	you: Hi there.
	baby: Hi there!

	you: Hi there, Baby!
	baby: Hello there!

	you: Hello there.
	baby: Hello there!

	you: Hello there, Baby!
	baby: Hi there!

	you: Good morning, Baby!
	baby: Good morning!

	you: Good morning.
	baby: Good morning! How are you?

	you: Good morning Baby.
	baby: Good morning!

	you: Good afternoon!
	baby: Good afternoon!

	you: Good afternoon.
	baby: Good afternoon! How are you?

	you: Good afternoon Baby!
	baby: Good afternoon!

	you: Good evening, Baby.
	baby: Good evening!

	you: Good evening.
	baby: Good evening! How are you?

	you: Good evening Baby!
	baby: Good evening!

	you: Hi! How are you?
	baby: I am good. How are you?
	you: I am good too.
	baby: Yay!

	you: Hi Baby. How are you?
	baby: I am happy today!

	you: Hello! How are you?
	baby: I am good. How are you?

	you: How are you, Baby?
	baby: I am good!

	you: How are you doing?
	baby: It’s going well!

	you: Baby, how are you?
	baby: I am happy today!

	you: How are you today?
	baby: I am good. How are you?

	you: Hello Baby. How are you today?
	baby: I am happy today!

	you: Hey, how’s it going?
	baby: It’s going well!

	you: How’s it going, Baby?
	baby: I am good!
	`
);

// The same prompts again with a second reply, so the prompt alone predicts a few replies.
const extra = scriptPack(
	'greetings',
	'Greetings',
	`
	you: Hi Baby!
	baby: Hello! How are you?

	you: Hi!
	baby: Hello!

	you: Hi, Baby.
	baby: Hello! How are you?

	you: Hello!
	baby: Hi!

	you: Hello, Baby!
	baby: Hi! How are you?

	you: Hello Baby.
	baby: Hi!

	you: Hey Baby.
	baby: Hi! How are you?

	you: Hey, Baby!
	baby: Hello!

	you: Hey.
	baby: Hi!

	you: How are you, Baby?
	baby: I am happy today!

	you: How are you doing?
	baby: I am happy today!

	you: Baby, how are you?
	baby: I am good. How are you?
	`
);
function lesson(id: string): Pack {
	const pack = chatbot101.find((pack) => pack.id === id);
	if (!pack) throw new Error(`No pack “${id}” in Chatbot 101`);
	return pack;
}

const single = lesson('greetings');
const repeated = { ...single, documents: [...single.documents, ...extra.documents] };

const conversation = [
	'hi baby',
	'hi',
	'how are you?',
	'how are you?',
	'how are you?',
	'hello!',
	'good morning to you',
	'hey',
	'hey',
	'hi there',
	'thank you!',
	'thanks baby',
	'this is getting a little repetitive'
];

async function ask(model: Model, prompt: string): Promise<string> {
	const words: string[] = [];
	for await (const event of model.reply(prompt))
		if (event.type === 'token') words.push(event.text.trim());
	return words.join(' ') || '(nothing)';
}

const { values: options } = parseArgs({
	options: {
		variant: { type: 'string', default: 'single' },
		seed: { type: 'string', default: '1' }
	}
});
const variants = { single, framed, repeated };
const variant = options.variant as keyof typeof variants;
const greetings = variants[variant];
if (!greetings) throw new Error(`No variant “${options.variant}”`);
const seed = Number(options.seed);

const model = new Model({ random: seededRandom(seed), idle: async () => {} });
const started = performance.now();
for (const pack of [greetings, lesson('thanks')]) {
	for await (const event of model.read({
		source: pack.id,
		title: pack.title,
		documents: pack.documents
	}))
		if (event.type === 'done') break;
}
const seconds = ((performance.now() - started) / 1000).toFixed(0);
const words = greetings.documents.flat().length;
const lines = [`## ${variant} · seed ${seed} · Greetings ${words} tokens · read in ${seconds}s`];
for (const prompt of conversation) lines.push(`you: ${prompt}\nbaby: ${await ask(model, prompt)}`);
console.log(lines.join('\n') + '\n');
