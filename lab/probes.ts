import { EOS, tokenize } from '#lib/baby/vocabulary.ts';
import type { Pack } from '#lib/library/pack.ts';

/**
 * What the lab asks Baby after each lesson, and what counts as a good answer.
 *
 * - trained: the opening exchange of every conversation in the pack, word for word.
 *   Only openings, because a chat sends Baby one turn, never a mid-conversation one.
 * - near: new combinations of words the lessons teach. Tests the kind of turn, not recall.
 * - held-out: things the lessons don’t cover. Reported, never targeted: Baby should be bad here.
 */

export type Tier = 'trained' | 'near' | 'held-out';

export interface Probe {
	pack: string;
	tier: Tier;
	/** Tokens joined by spaces, as Baby reads it. */
	prompt: string;
	/** Acceptable replies, tokenized the same way. */
	accept: string[];
}

/** Pass marks for each pack, measured after all of Chatbot 101 is read. */
export const TARGETS = {
	trained: 0.9,
	near: 0.6,
	/** Every reply, all tiers, ends with [EOS] rather than the length limit. */
	cleanStop: 0.95,
	/** Most replies, all tiers, where Baby writes a speaker label (plays both sides). */
	roleLeak: 0.01,
	/** Most a pack’s trained + near score may drop from right after it was read to the end. */
	forgetting: 0.1
};

const greetBack = ['Hi!', 'Hello!', 'Hey!', 'Hi there!', 'Hello there!'];
const howAreYou = [
	'I am good. How are you?',
	'I am good.',
	'I am good!',
	'I am happy today!',
	'I am happy!',
	'It’s going well!'
];
const welcome = ['You’re welcome!', 'You’re welcome.', 'You’re very welcome!'];
const thankYou = ['Thank you!', 'Thanks!'];
const bye = ['Bye!', 'Goodbye!', 'Okay. Bye!', 'See you later!'];

/** Hand-written probes, by pack id, in the same casual style as the scripts. */
const written: Record<string, { near: [string, string[]][]; heldOut: [string, string[]][] }> = {
	greetings: {
		near: [
			['Hello Baby!', greetBack],
			['Hey!', greetBack],
			['Hi.', greetBack],
			['Hello there!', greetBack],
			['Good morning!', ['Good morning!']],
			['Good evening!', ['Good evening!']],
			['Good afternoon, Baby.', ['Good afternoon!']],
			['How are you?', howAreYou],
			['Hi Baby! How are you today?', howAreYou],
			['Hey, how are you?', howAreYou]
		],
		heldOut: [
			['Howdy!', greetBack],
			['Good day, Baby!', [...greetBack, 'Good day!']],
			['How is it going today?', howAreYou]
		]
	},
	thanks: {
		near: [
			['Thank you, Baby!', welcome],
			['Thanks!', welcome],
			['Thank you so much, Baby.', welcome],
			['Here is a story.', thankYou],
			['Good job!', thankYou],
			['I like your story.', thankYou],
			['Thanks for talking.', [...welcome, 'Thank you for talking with me too!']]
		],
		heldOut: [
			['Cheers!', welcome],
			['I love you.', thankYou]
		]
	},
	goodbyes: {
		near: [
			['Bye!', bye],
			['Goodbye, Baby!', bye],
			['See you later, Baby.', ['See you later!', 'Bye!']],
			['Good night!', ['Good night!']],
			['I have to go.', bye],
			['Talk to you later!', ['Talk to you later!', ...bye]]
		],
		heldOut: [
			['Farewell!', bye],
			['See you tomorrow!', ['See you tomorrow!', 'Talk to you tomorrow!', ...bye]]
		]
	},
	'about-baby': {
		near: [
			['What’s your name?', ['My name is Baby.']],
			['What is your name, Baby?', ['My name is Baby.']],
			['Who are you', ['I am Baby.']],
			['Where do you live, Baby?', ['I live in your browser.']],
			['What do you eat, Baby?', ['I eat words.']],
			['How old are you, Baby?', ['I am very new.']]
		],
		heldOut: [
			['Are you a robot?', ['I am a tiny language model.', 'Not yet. I am still learning.']],
			['What do you like?', ['I like words.']]
		]
	}
};

const asTokens = (text: string) => tokenize(text).join(' ');

/** A script document’s turns as `[speaker, words]`, splitting at each [EOS]. */
function turns(document: string[]): [string, string[]][] {
	const result: [string, string[]][] = [];
	let start = 0;
	for (let end = document.indexOf(EOS); end >= 0; end = document.indexOf(EOS, start)) {
		const [speaker = '', , ...words] = document.slice(start, end);
		result.push([speaker, words]);
		start = end + 1;
	}
	return result;
}

/** Every probe for a pack: its trained openings plus any written ones. */
export function probesFor(pack: Pack): Probe[] {
	const trained = new Map<string, Set<string>>();
	for (const document of pack.documents) {
		const [[you, prompt] = [], [baby, reply] = []] = turns(document);
		if (you !== 'you' || baby !== 'baby' || !prompt || !reply) continue;
		const key = prompt.join(' ');
		trained.set(key, (trained.get(key) ?? new Set()).add(reply.join(' ')));
	}
	const extra = written[pack.id] ?? { near: [], heldOut: [] };
	const probe =
		(tier: Tier) =>
		([prompt, accept]: [string, string[]]) => ({
			pack: pack.id,
			tier,
			prompt: asTokens(prompt),
			accept: accept.map(asTokens)
		});
	const untrained = [...extra.near.map(probe('near')), ...extra.heldOut.map(probe('held-out'))];
	const leaked = untrained.filter((p) => trained.has(p.prompt));
	if (leaked.length > 0) {
		// A probe in the script tests recall, not generalizing: the score would be a lie.
		throw new Error(
			`“${pack.id}” teaches its own probes: ${leaked.map((p) => p.prompt).join(' | ')}`
		);
	}
	return [
		...[...trained].map(([prompt, replies]) => ({
			pack: pack.id,
			tier: 'trained' as const,
			prompt,
			accept: [...replies]
		})),
		...untrained
	];
}
