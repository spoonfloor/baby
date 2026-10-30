import { seededRandom } from '#lib/baby/random.ts';

/**
 * Therapy Bot’s conversations, inspired by ELIZA’s DOCTOR script: you say how
 * you are, and it asks about it in your own words, pointed back at you (“my job” →
 * “your job”). Each shape is one sentence with blanks and exactly one reply, and
 * the blanks vary widely, so the pattern to learn is copying your words back rather
 * than any one reply. Fill-ins are ordinary things people say.
 */

/** A conversation turn pair: what you say, and what Therapy Bot says back. */
export type Exchange = [you: string, baby: string];

const fills = {
	feeling: [
		'terrible',
		'awful',
		'bad',
		'good',
		'fine',
		'okay',
		'great',
		'sick',
		'afraid',
		'depressed',
		'unhappy',
		'exhausted',
		'tired',
		'sad',
		'happy',
		'lonely',
		'anxious',
		'nervous',
		'worried',
		'stressed',
		'bored',
		'angry',
		'upset',
		'scared',
		'confused',
		'excited',
		'hopeful',
		'grumpy',
		'sleepy',
		'calm',
		'proud',
		'guilty',
		'jealous',
		'overwhelmed',
		'frustrated',
		'restless',
		'homesick',
		'embarrassed',
		'grateful',
		'stuck',
		'lost',
		'hurt'
	],
	person: [
		'mother',
		'father',
		'sister',
		'brother',
		'wife',
		'husband',
		'son',
		'daughter',
		'boss',
		'friend',
		'roommate',
		'neighbor',
		'partner',
		'teacher',
		'coworker',
		'best friend',
		'landlord',
		'doctor',
		'grandmother',
		'cousin'
	],
	doing: [
		'ignores me',
		'criticizes me',
		'worries about me',
		'never calls me',
		'yells at me',
		'doesn’t listen to me',
		'understands me',
		'helps me',
		'annoys me',
		'judges me',
		'lies to me',
		'misses me',
		'trusts me',
		'blames me',
		'is always late'
	],
	wanted: [
		'a vacation',
		'a new job',
		'more sleep',
		'a break',
		'some quiet',
		'a friend',
		'a hug',
		'more time',
		'a dog',
		'a raise',
		'coffee',
		'help',
		'a change',
		'some rest',
		'a new apartment',
		'more money',
		'someone to talk to',
		'a day off'
	],
	action: [
		'sleep',
		'focus',
		'relax',
		'stop worrying',
		'find a job',
		'make friends',
		'get up early',
		'say no',
		'finish my work',
		'talk to my boss',
		'eat breakfast',
		'call my mother',
		'pay my bills',
		'study',
		'leave the house'
	],
	topic: [
		'it',
		'my life',
		'people',
		'myself',
		'my friends',
		'the news',
		'my body',
		'my future',
		'my past',
		'my job',
		'coffee',
		'mornings',
		'my apartment',
		'the rain',
		'winter',
		'music',
		'cooking',
		'school',
		'work',
		'mondays',
		'crowds',
		'my phone',
		'the city',
		'my commute',
		'my family',
		'the weekend',
		'my car',
		'money',
		'my health'
	],
	trait: [
		'helpful',
		'strange',
		'smart',
		'boring',
		'kind',
		'annoying',
		'a robot',
		'weird',
		'nice',
		'rude',
		'funny',
		'a good listener'
	],
	/** What they do, said of more than one person. */
	doingThey: [
		'ignore me',
		'don’t respect me',
		'never call me',
		'judge me',
		'don’t listen to me',
		'yell at me',
		'hate me',
		'love me',
		'understand me',
		'laugh at me'
	],
	reason: [
		'I am tired',
		'my boss yells at me',
		'it is too loud',
		'I can’t sleep',
		'nobody listens to me',
		'I feel alone',
		'it is too hard',
		'I said so',
		'they don’t respect me',
		'she hates me',
		'he never calls me',
		'I love it',
		'you are rude',
		'I am afraid',
		'it hurts',
		'I have no time',
		'my family is far away',
		'I want a change'
	],
	quality: [
		'too loud',
		'too hard',
		'too much',
		'not fair',
		'too late',
		'boring',
		'scary',
		'awful',
		'fine',
		'hard to explain',
		'complicated',
		'a long story'
	],
	youDo: [
		'confuse',
		'annoy',
		'scare',
		'understand',
		'help',
		'ignore',
		'judge',
		'like',
		'hate',
		'frustrate'
	]
} satisfies Record<string, string[]>;

type Slot = keyof typeof fills;
type Values = Partial<Record<Slot, string>>;

/** A sentence with blanks (`{slot}`), its one reply, and its reply when the first blank is a word Baby never read. */
interface Shape {
	you: string;
	baby: string;
	unknown: string;
}

/**
 * Sentences with blanks and the one reply to each. The reply’s blanks get your words
 * pointed back at you (`reflect`). When the first blank is a word Baby never read,
 * it can’t copy it, so it asks about it without it.
 */
const shapes: Shape[] = [
	{
		you: 'I am {feeling}.',
		baby: 'How long have you been {feeling}?',
		unknown: 'How long have you felt that way?'
	},
	{
		you: 'I feel {feeling}.',
		baby: 'Why do you feel {feeling}?',
		unknown: 'Why do you feel that way?'
	},
	{
		you: 'My {person} is {feeling}.',
		baby: 'Why is your {person} {feeling}?',
		unknown: 'Tell me more about them.'
	},
	{
		you: 'My {person} {doing}.',
		baby: 'Why do you think your {person} {doing}?',
		unknown: 'Tell me more about them.'
	},
	{
		you: 'I miss my {person}.',
		baby: 'Tell me more about your {person}.',
		unknown: 'Tell me more about them.'
	},
	{ you: '{feeling}.', baby: 'Why do you feel {feeling}?', unknown: 'What do you mean?' },
	{
		you: 'I have been {feeling}.',
		baby: 'How long have you been {feeling}?',
		unknown: 'How long have you felt that way?'
	},
	{
		you: 'I want to {action}.',
		baby: 'Why do you want to {action}?',
		unknown: 'Why do you want to do that?'
	},
	{ you: 'I don’t {action}.', baby: 'Why don’t you {action}?', unknown: 'Why not?' },
	{
		you: 'I want to talk about my {person}.',
		baby: 'Tell me about your {person}.',
		unknown: 'Tell me about them.'
	},
	{ you: 'I want {wanted}.', baby: 'Why do you want {wanted}?', unknown: 'Why do you want that?' },
	{
		you: 'I need {wanted}.',
		baby: 'What would {wanted} do for you?',
		unknown: 'What would that do for you?'
	},
	{
		you: 'I can’t {action}.',
		baby: 'What makes it hard to {action}?',
		unknown: 'What makes that hard?'
	},
	{
		you: 'I like {topic}.',
		baby: 'What do you like about {topic}?',
		unknown: 'What do you like about it?'
	},
	{
		you: 'I love {topic}.',
		baby: 'What do you love about {topic}?',
		unknown: 'What do you love about it?'
	},
	{
		you: 'I hate {topic}.',
		baby: 'What do you hate about {topic}?',
		unknown: 'What do you hate about it?'
	},
	{
		you: 'I am worried about {topic}.',
		baby: 'What worries you about {topic}?',
		unknown: 'What worries you about it?'
	},
	{
		you: 'You are {trait}.',
		baby: 'Why do you think I am {trait}?',
		unknown: 'Why do you think I am like that?'
	},
	{
		you: 'You {youDo} me.',
		baby: 'What makes you think I {youDo} you?',
		unknown: 'What makes you think that?'
	},
	{ you: 'She {doing}.', baby: 'Tell me more about her.', unknown: 'Tell me more about her.' },
	{ you: 'He {doing}.', baby: 'Tell me more about him.', unknown: 'Tell me more about him.' },
	{
		you: 'They {doingThey}.',
		baby: 'Tell me more about them.',
		unknown: 'Tell me more about them.'
	},
	{
		you: 'Because {reason}.',
		baby: 'Is that the real reason?',
		unknown: 'Is that the real reason?'
	},
	{ you: 'It’s {quality}.', baby: 'Why is it {quality}?', unknown: 'Why do you say that?' }
];

/** Things said without blanks: several ways to say each, with one reply. */
const smallTalk: [said: string[], reply: string][] = [
	[['Hello.', 'Hi.', 'Hey.', 'Good morning.'], 'Hello. How are you feeling today?'],
	[['Yes.', 'Yeah.', 'Yes, a bit.', 'I think so.'], 'I see. Tell me more.'],
	[['No.', 'Not really.', 'No, I don’t think so.', 'Nope.', 'I don’t.'], 'Why not?'],
	[['Haha.', 'Lol.', 'Ha.'], 'What’s funny?'],
	[['I don’t know.', 'I’m not sure.', 'Maybe.'], 'That’s okay. Take your time.'],
	[['What?', 'What do you mean?', 'What does that mean?', 'Why?'], 'Why do you ask?'],
	[['Thank you.', 'Thanks.'], 'You’re welcome.'],
	[['Goodbye.', 'Bye.'], 'Goodbye. Take care.']
];

/**
 * Sentences made mostly of words Baby never read: it can’t follow them, so it says
 * so, in a way that fits how the sentence starts, rather than guessing at a reply.
 */
const unclear: [said: string[], reply: string][] = [
	[['[UNK].', '[UNK] [UNK].', '[UNK] [UNK] [UNK].'], 'What do you mean?'],
	[
		['I [UNK] it.', 'I [UNK] [UNK].', 'I [UNK] [UNK] [UNK].', 'I [UNK] a [UNK].'],
		'Tell me more about that.'
	],
	[['My [UNK] [UNK].', 'My [UNK] is [UNK].', 'My [UNK] [UNK] me.'], 'Tell me more about that.'],
	[
		['You [UNK] [UNK].', 'You are [UNK] [UNK].', '[UNK] you [UNK].', 'You [UNK] [UNK] [UNK].'],
		'We were talking about you, not me.'
	],
	[
		[
			'It [UNK] me.',
			'It [UNK] [UNK].',
			'The [UNK] is [UNK].',
			'[UNK] is [UNK].',
			'[UNK] [UNK] a [UNK].',
			'[UNK] the [UNK].'
		],
		'I’m not sure I follow. What do you mean?'
	],
	[['That [UNK] me.', 'That’s [UNK].', 'That [UNK] [UNK].'], 'Why do you say that?']
];

/**
 * How a sentence can end when you type it. Every line is read in turn with each, so
 * the reply never depends on whether you typed a period (lab/rubric.md).
 */
const ENDINGS = ['.', '', '!'];

/** `you` ending in each of `ENDINGS` in turn, by `index`; a question keeps its mark. */
function framed([you, baby]: Exchange, index: number): Exchange {
	if (!you.endsWith('.')) return [you, baby];
	return [`${you.slice(0, -1)}${ENDINGS[index % ENDINGS.length] ?? '.'}`, baby];
}

/** Lines per shape: with 19 shapes, 100 did no better than 70 and read longer (lab/log.md). */
const PER_SHAPE = 70;
/** Lines per shape whose first blank is a word Baby never read. */
const UNKNOWN_PER_SHAPE = 12;
/** One fill-in in this many is held out of each shape (still read elsewhere), for the lab. */
const HOLD_OUT_EVERY = 5;
const SEED = 1966;

const REFLECTIONS: Record<string, string> = {
	i: 'you',
	me: 'you',
	my: 'your',
	am: 'are',
	myself: 'yourself',
	'i’m': 'you’re'
};

/** Your words pointed back at you: “finish my work” → “finish your work”. */
export function reflect(words: string): string {
	return words
		.split(' ')
		.map((word) => REFLECTIONS[word.toLowerCase()] ?? word)
		.join(' ');
}

const blank = /\{(\w+)\}/g;
const slotsOf = (template: string) =>
	[...template.matchAll(blank)].map((match) => match[1] as Slot);

function fill({ you, baby }: Shape, values: Values): Exchange {
	const put = (template: string, turn: (words: string) => string) =>
		template.replace(blank, (_, slot: Slot) => turn(values[slot] ?? ''));
	return [put(you, (words) => words), put(baby, reflect)];
}

/** Every way to fill a shape, as slot values. */
function combinations(slots: Slot[]): Values[] {
	return slots.reduce<Values[]>(
		(sets, slot) => sets.flatMap((set) => fills[slot].map((value) => ({ ...set, [slot]: value }))),
		[{}]
	);
}

/** Whether a shape’s first blank holds a fill-in this shape never trains on. */
function heldOut(shape: number, values: Values): boolean {
	const [slot] = slotsOf(shapes[shape]?.you ?? '');
	if (!slot) return false;
	return fills[slot].indexOf(values[slot] ?? '') % HOLD_OUT_EVERY === shape % HOLD_OUT_EVERY;
}

/** A shape’s line with `words` in its first blank, and the reply for a word Baby never read. */
function withUnknown(shape: Shape, words: string, values: Values): Exchange {
	const [first] = slotsOf(shape.you);
	const [you] = fill(shape, first ? { ...values, [first]: words } : values);
	return [you, shape.unknown];
}

/** An exchange the script never has, and the words its reply should copy back, if any. */
export interface HeldOut {
	exchange: Exchange;
	echo?: string;
}

/** Each shape’s fillings, split into what Therapy Bot reads and what it never sees there. */
function fillings(): { read: Exchange[]; unread: HeldOut[] } {
	const random = seededRandom(SEED);
	const read: Exchange[] = [];
	const unread: HeldOut[] = [];
	shapes.forEach((shape, index) => {
		const slots = slotsOf(shape.you);
		const all = combinations(slots);
		const kept = all.filter((values) => !heldOut(index, values));
		for (const values of all.filter((values) => heldOut(index, values))) {
			const [slot] = slots;
			const copied = slot && shape.baby.includes(`{${slot}}`);
			unread.push({
				exchange: fill(shape, values),
				...(copied && { echo: reflect(values[slot] ?? '') })
			});
		}
		// A seeded shuffle, so the script is the same on every load.
		for (let i = kept.length - 1; i > 0; i--) {
			const j = Math.floor(random() * (i + 1));
			[kept[i], kept[j]] = [kept[j] ?? {}, kept[i] ?? {}];
		}
		kept.slice(0, PER_SHAPE).forEach((values, i) => read.push(framed(fill(shape, values), i)));
		// An unread word is one [UNK] or a run of them, as an unread phrase would be.
		kept.slice(PER_SHAPE, PER_SHAPE + UNKNOWN_PER_SHAPE).forEach((values, i) => {
			const words = i % 3 === 2 ? '[UNK] [UNK]' : '[UNK]';
			read.push(framed(withUnknown(shape, words, values), i));
		});
	});
	return { read, unread };
}

const { read, unread } = fillings();

/** Every exchange Therapy Bot’s script has: small talk, each shape’s, then unclear ones. */
export const exchanges: Exchange[] = [
	// A question has one framing, so it’s said once rather than three times the same.
	...smallTalk.flatMap(([said, reply]) =>
		said.flatMap((you) =>
			[...new Set(ENDINGS.map((_, i) => framed([you, reply], i)[0]))].map((framing): Exchange => [
				framing,
				reply
			])
		)
	),
	...read,
	...unclear.flatMap(([said, reply]) =>
		said.flatMap((you) => ENDINGS.map((_, i) => framed([you, reply], i)))
	)
];

/**
 * Exchanges in the same shapes, filled with words read elsewhere in the script but
 * never in that shape: what the lab asks to see whether Baby copies or recites.
 */
export const heldOutExchanges: HeldOut[] = unread;

/**
 * Each shape with `words` in its first blank, and the reply it should get if Baby
 * never read them: what the lab asks to see what Baby does with an unknown word.
 */
export function unknownExchanges(words: string): Exchange[] {
	return shapes.map((shape) =>
		withUnknown(shape, words, combinations(slotsOf(shape.you))[0] ?? {})
	);
}
