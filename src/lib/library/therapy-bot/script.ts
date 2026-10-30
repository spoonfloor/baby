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
	]
} satisfies Record<string, string[]>;

type Slot = keyof typeof fills;

/**
 * Sentences with blanks, `{slot}`, and the one reply to each. The reply’s blanks get
 * your words pointed back at you (`reflect`).
 */
const shapes: Exchange[] = [
	['I am {feeling}.', 'How long have you been {feeling}?'],
	['I feel {feeling}.', 'Why do you feel {feeling}?'],
	['My {person} is {feeling}.', 'Why is your {person} {feeling}?'],
	['My {person} {doing}.', 'Why do you think your {person} {doing}?'],
	['I miss my {person}.', 'Tell me more about your {person}.'],
	['I want {wanted}.', 'Why do you want {wanted}?'],
	['I need {wanted}.', 'What would {wanted} do for you?'],
	['I can’t {action}.', 'What makes it hard to {action}?'],
	['I like {topic}.', 'What do you like about {topic}?'],
	['I hate {topic}.', 'What do you hate about {topic}?'],
	['I am worried about {topic}.', 'What worries you about {topic}?'],
	['You are {trait}.', 'Why do you think I am {trait}?']
];

/** Things said without blanks: several ways to say each, with one reply. */
const smallTalk: [said: string[], reply: string][] = [
	[['Hello.', 'Hi.', 'Hey.', 'Good morning.'], 'Hello. How are you feeling today?'],
	[['Yes.', 'Yeah.', 'Yes, a bit.', 'I think so.'], 'I see. Tell me more.'],
	[['No.', 'Not really.', 'No, I don’t think so.', 'Nope.'], 'Why not?'],
	[['I don’t know.', 'I’m not sure.', 'Maybe.'], 'That’s okay. Take your time.'],
	[['What?', 'What do you mean?', 'What does that mean?', 'Why?'], 'Why do you ask?'],
	[['Thank you.', 'Thanks.'], 'You’re welcome.'],
	[['Goodbye.', 'Bye.'], 'Goodbye. Take care.']
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

/** Lines per shape. 50 copied less reliably; 150 did no better and reads longer (lab/log.md). */
const PER_SHAPE = 100;
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

function fill([you, baby]: Exchange, values: Partial<Record<Slot, string>>): Exchange {
	const put = (template: string, turn: (words: string) => string) =>
		template.replace(blank, (_, slot: Slot) => turn(values[slot] ?? ''));
	return [put(you, (words) => words), put(baby, reflect)];
}

/** Every way to fill a shape, as slot values. */
function combinations(slots: Slot[]): Partial<Record<Slot, string>>[] {
	return slots.reduce<Partial<Record<Slot, string>>[]>(
		(sets, slot) => sets.flatMap((set) => fills[slot].map((value) => ({ ...set, [slot]: value }))),
		[{}]
	);
}

/** Whether a shape’s first blank holds a fill-in this shape never trains on. */
function heldOut(shape: number, values: Partial<Record<Slot, string>>): boolean {
	const [slot] = slotsOf(shapes[shape]?.[0] ?? '');
	if (!slot) return false;
	return fills[slot].indexOf(values[slot] ?? '') % HOLD_OUT_EVERY === shape % HOLD_OUT_EVERY;
}

/** An exchange the script never has, and the words its reply should copy back. */
export interface HeldOut {
	exchange: Exchange;
	echo: string;
}

/** Each shape’s fillings, split into what Therapy Bot reads and what it never sees there. */
function fillings(): { read: Exchange[]; unread: HeldOut[] } {
	const random = seededRandom(SEED);
	const read: Exchange[] = [];
	const unread: HeldOut[] = [];
	shapes.forEach((shape, index) => {
		const slots = slotsOf(shape[0]);
		const all = combinations(slots);
		const kept = all.filter((values) => !heldOut(index, values));
		for (const values of all.filter((values) => heldOut(index, values))) {
			const [slot] = slots;
			unread.push({
				exchange: fill(shape, values),
				echo: reflect(slot ? (values[slot] ?? '') : '')
			});
		}
		// A seeded shuffle, so the script is the same on every load.
		for (let i = kept.length - 1; i > 0; i--) {
			const j = Math.floor(random() * (i + 1));
			[kept[i], kept[j]] = [kept[j] ?? {}, kept[i] ?? {}];
		}
		kept.slice(0, PER_SHAPE).forEach((values, i) => read.push(framed(fill(shape, values), i)));
	});
	return { read, unread };
}

const { read, unread } = fillings();

/** Every exchange Therapy Bot’s script has, small talk first, then each shape’s. */
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
	...read
];

/**
 * Exchanges in the same shapes, filled with words read elsewhere in the script but
 * never in that shape: what the lab asks to see whether Baby copies or recites.
 */
export const heldOutExchanges: HeldOut[] = unread;
