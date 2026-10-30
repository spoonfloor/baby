import { parseArgs } from 'node:util';
import { Model } from '#lib/baby/model.ts';
import { seededRandom } from '#lib/baby/random.ts';
import { firstWord } from '#lib/library/chatbot-101.ts';
import { scriptPrimer, type Primer } from '#lib/library/primer.ts';

/**
 * Does a Baby that has read only its first word (Hello) say it back to anything?
 * Each seed reads Hello, then is asked messages from a zero-state chat, mostly made
 * of words it has never read.
 *
 *   node --experimental-strip-types lab/experiments/first-word.ts --seeds 8 --variant one
 */

const { values: options } = parseArgs({
	options: {
		seeds: { type: 'string', default: '5' },
		samples: { type: 'string', default: '20' },
		variant: { type: 'string', default: 'two' }
	}
});

/** Ways to write the lesson, all with Hello as the only word: one, two or three exchanges. */
const variants: Record<string, Primer> = {
	one: scriptPrimer('hello', 'Hello', 'you: Hello\nbaby: Hello'),
	two: firstWord,
	three: scriptPrimer(
		'hello',
		'Hello',
		'you: Hello\nbaby: Hello\nyou: Hello\nbaby: Hello\nyou: Hello\nbaby: Hello'
	)
};
const lesson = variants[options.variant];
if (!lesson) throw new Error(`No variant “${options.variant}”`);

const prompts = [
	'Hi!',
	'Hello?',
	'Hello.',
	'How are you?',
	'But I don’t want to do training.',
	'Hello!',
	'hello',
	'What’s your name?',
	'asdf'
];

const failures: string[] = [];
const replies = new Map<string, Map<string, number>>(prompts.map((prompt) => [prompt, new Map()]));
for (let seed = 1; seed <= Number(options.seeds); seed++) {
	const model = new Model({ random: seededRandom(seed), idle: async () => {} });
	const started = performance.now();
	let status = '';
	for await (const event of model.read({
		source: lesson.id,
		title: lesson.title,
		documents: lesson.documents
	})) {
		if (event.type === 'status') status = event.text;
	}
	console.log(`seed ${seed}: ${status} (${((performance.now() - started) / 1000).toFixed(1)}s)`);

	for (const prompt of prompts) {
		for (let i = 0; i < Number(options.samples); i++) {
			const words: string[] = [];
			let stop = '';
			for await (const event of model.reply(prompt)) {
				if (event.type === 'token') words.push(event.text.trim());
				if (event.type === 'trace') stop = event.trace.stop;
			}
			const reply = `${words.join(' ')}${stop === 'eos' ? '' : ` [${stop}]`}`;
			const counts = replies.get(prompt);
			counts?.set(reply, (counts.get(reply) ?? 0) + 1);
			if (reply !== 'hello') failures.push(`seed ${seed}: ${prompt} → ${reply || '(nothing)'}`);
		}
	}
}

for (const [prompt, counts] of replies) {
	const total = [...counts.values()].reduce((sum, n) => sum + n, 0);
	const shown = [...counts]
		.sort((a, b) => b[1] - a[1])
		.map(([reply, n]) => `${reply || '(nothing)'} ${Math.round((n / total) * 100)}%`);
	console.log(`${prompt} → ${shown.join(', ')}`);
}

const failed = Map.groupBy(failures, (failure) => failure);
for (const [failure, times] of failed) console.log(`  ${failure} ×${times.length}`);
