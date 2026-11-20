import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import type { Document, Reading } from '#lib/baby/index.ts';
import { Model } from '#lib/baby/model.ts';
import { seededRandom } from '#lib/baby/random.ts';
import { proseDocuments } from '#lib/baby/reading.ts';
import { parseScripts } from '#lib/baby/script.ts';
import { BABY_CONFIG } from '#lib/baby/transformer.ts';
import { isSpecial, tokenize } from '#lib/baby/vocabulary.ts';
import { chatbot101 } from '#lib/library/chatbot-101.ts';
import { readableSentences } from '#lib/web/sentences.ts';
import { probesFor } from '../probes.ts';
import type { Article } from './web/capture.ts';

/**
 * What reading real web articles does to Baby. A Baby reads all of Chatbot 101, then
 * four news articles as Read from URL would give them (`web/articles.json`, captured
 * with the app’s own extraction by `web/capture.ts`), one at a time. It reports:
 *
 * - each reading: words, words new to Baby, words seen only once in all it has read,
 *   paragraphs longer than Baby’s context window, and reading time;
 * - Chatbot 101’s trained + near score before and after the articles (forgetting);
 * - replies to casual messages and to questions about the articles, with how many
 *   recite an article (five words in a row from one), how many of their words come
 *   only from the articles or were seen only once, and how they end.
 *
 *   node --experimental-strip-types lab/experiments/reading-the-web.ts --seed 1 --shape sentences
 *
 * `--shape` is how an article becomes documents:
 *
 * - paragraphs: a document per paragraph, as Read from URL did before sentences;
 * - sentences: a document per readable sentence (`readableSentences`), as it does now;
 * - chat: those sentences, plus each sentence that names something the article keeps
 *   coming back to as Baby’s answer to being asked about it: “Tell me about Anthropic.”
 */

/** What a person might say after giving Baby some news: small talk, then the news itself. */
const PROMPTS = {
	casual: [
		'Hi!',
		'How are you?',
		'What is your name?',
		'Thank you!',
		'What did you read today?',
		'Tell me something.'
	],
	news: [
		'Who is Brittany Boltinhouse?',
		'What happened to the boat?',
		'Tell me about Ukraine.',
		'What is Anthropic?'
	]
};

/** Words in a row an article and a reply must share for the reply to count as recited. */
const RECITED_RUN = 5;

function articleDocuments(paragraphs: string[]): Document[] {
	if (shape === 'paragraphs') return proseDocuments(paragraphs);
	const sentences = readableSentences(paragraphs);
	if (shape === 'sentences') return proseDocuments(sentences);
	return [...proseDocuments(sentences), ...topicExchanges(sentences)];
}

/** How many times a name must come up for the article to be about it. */
const TOPIC_MENTIONS = 2;

/** Ways to ask about a topic, taken in turn. */
const TOPIC_ASKS = ['Tell me about {t}.', 'What about {t}?', 'What do you know about {t}?'];

/**
 * The article’s topics, names it keeps coming back to (runs of capitalized words, not
 * counting a sentence’s first word), each sentence naming one as the answer to being
 * asked about it.
 */
function topicExchanges(sentences: readonly string[]): Document[] {
	const named = sentences.map((sentence) => {
		const words = sentence.split(/\s+/).slice(1).join(' ');
		const runs = words.match(/\p{Lu}[\p{L}'’-]*(?: \p{Lu}[\p{L}'’-]*)*/gu) ?? [];
		return runs.map((run) => run.replace(/['’]s$/, ''));
	});
	const mentions = new Map<string, number>();
	for (const names of named)
		for (const name of new Set(names)) mentions.set(name, (mentions.get(name) ?? 0) + 1);
	const script: string[] = [];
	sentences.forEach((sentence, i) => {
		const topic = named[i]?.find((name) => (mentions.get(name) ?? 0) >= TOPIC_MENTIONS);
		if (topic === undefined) return;
		const ask = (TOPIC_ASKS[script.length % TOPIC_ASKS.length] ?? '').replace('{t}', topic);
		script.push(`you: ${ask}\nbaby: ${sentence}`);
	});
	return parseScripts(script.join('\n\n'));
}

async function read(model: Model, reading: Reading): Promise<string> {
	let status = '';
	for await (const event of model.read(reading)) if (event.type === 'status') status = event.text;
	return status;
}

async function ask(model: Model, prompt: string) {
	const words: string[] = [];
	let stop = 'eos';
	for await (const event of model.reply(prompt)) {
		if (event.type === 'token') words.push(event.text.trim());
		if (event.type === 'trace') stop = event.trace.stop;
	}
	return { words: words.filter((word) => word !== ''), stop };
}

/** Share of Chatbot 101’s trained and near probe samples with an acceptable reply. */
async function chatbotScore(model: Model, samples: number): Promise<number> {
	let good = 0;
	let total = 0;
	for (const probe of chatbot101.flatMap(probesFor)) {
		if (probe.tier === 'held-out') continue;
		for (let i = 0; i < samples; i++) {
			const { words, stop } = await ask(model, probe.prompt);
			if (stop === 'eos' && probe.accept.includes(words.join(' '))) good++;
			total++;
		}
	}
	return good / total;
}

const words = (documents: readonly Document[]) => documents.flat().filter((t) => !isSpecial(t));
const percent = (n: number) => `${Math.round(n * 100)}%`;

const { values: options } = parseArgs({
	options: {
		seed: { type: 'string', default: '1' },
		samples: { type: 'string', default: '10' },
		shape: { type: 'string', default: 'sentences' }
	}
});
const shape = options.shape as 'paragraphs' | 'sentences' | 'chat';
const seed = Number(options.seed);
const samples = Number(options.samples);

const articles = JSON.parse(
	await readFile(new URL('./web/articles.json', import.meta.url), 'utf8')
) as Article[];
const readings = articles.map(({ url, title, paragraphs }) => ({
	source: `web:${url}`,
	title,
	documents: articleDocuments(paragraphs)
}));

const model = new Model({ random: seededRandom(seed), idle: async () => {} });
for (const pack of chatbot101) {
	await read(model, { source: pack.id, title: pack.title, documents: pack.documents });
}
const before = await chatbotScore(model, samples);

/** How often each word has been read so far, across everything. */
const seen = new Map<string, number>();
const count = (documents: readonly Document[]) => {
	for (const word of words(documents)) seen.set(word, (seen.get(word) ?? 0) + 1);
};
for (const pack of chatbot101) count(pack.documents);
const chatbotWords = new Set(seen.keys());

const out = [
	`## seed ${seed} · ${shape}`,
	'',
	'reading | words | new | seen once | over context | time'
];
for (const reading of readings) {
	const known = new Set(seen.keys());
	const readWords = words(reading.documents);
	const started = performance.now();
	await read(model, reading);
	const seconds = (performance.now() - started) / 1000;
	count(reading.documents);
	const fresh = new Set(readWords.filter((word) => !known.has(word)));
	const once = [...fresh].filter((word) => seen.get(word) === 1).length;
	const long = reading.documents.filter((d) => d.length > BABY_CONFIG.context).length;
	out.push(
		`${reading.title.slice(0, 40)} | ${readWords.length} | ${fresh.size} | ${once} | ` +
			`${long}/${reading.documents.length} | ${seconds.toFixed(0)}s`
	);
}
const after = await chatbotScore(model, samples);
const onceAll = [...seen.values()].filter((n) => n === 1).length;
out.push(
	'',
	`vocabulary: ${seen.size} words, ${onceAll} seen once (${percent(onceAll / seen.size)})`,
	`Chatbot 101 trained + near: ${percent(before)} before the articles → ${percent(after)} after`
);

/** Every run of RECITED_RUN words in the articles, to spot a reply reciting one. */
const runs = new Set<string>();
for (const reading of readings) {
	for (const document of reading.documents) {
		const plain = document.filter((t) => !isSpecial(t));
		for (let i = 0; i + RECITED_RUN <= plain.length; i++) {
			runs.add(plain.slice(i, i + RECITED_RUN).join(' '));
		}
	}
}

for (const [group, prompts] of Object.entries(PROMPTS)) {
	let recited = 0;
	let clean = 0;
	let total = 0;
	let replyWords = 0;
	let webWords = 0;
	let onceWords = 0;
	const lines: string[] = [];
	for (const prompt of prompts) {
		const counts = new Map<string, number>();
		for (let i = 0; i < samples; i++) {
			const { words: reply, stop } = await ask(model, prompt);
			total++;
			if (stop === 'eos') clean++;
			const promptWords = new Set(tokenize(prompt));
			for (const word of reply) {
				if (isSpecial(word) || promptWords.has(word)) continue;
				replyWords++;
				if (!chatbotWords.has(word)) webWords++;
				if (seen.get(word) === 1) onceWords++;
			}
			const recites = reply.some((_, j) => runs.has(reply.slice(j, j + RECITED_RUN).join(' ')));
			if (recites) recited++;
			const shown = `${reply.join(' ') || '(nothing)'}${stop === 'eos' ? '' : ` [${stop}]`}`;
			counts.set(shown, (counts.get(shown) ?? 0) + 1);
		}
		const top = [...counts]
			.sort((a, b) => b[1] - a[1])
			.slice(0, 3)
			.map(([reply, n]) => `${reply} ×${n}`)
			.join('  |  ');
		lines.push(`${prompt}\n    ${top}`);
	}
	out.push(
		'',
		`### ${group}: recited ${percent(recited / total)} · clean stop ${percent(clean / total)} · ` +
			`reply words only from the articles ${percent(webWords / Math.max(1, replyWords))} · ` +
			`seen once ${percent(onceWords / Math.max(1, replyWords))}`,
		'',
		...lines
	);
}
console.log(out.join('\n') + '\n');
