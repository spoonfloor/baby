import { tokenize } from '#lib/baby/vocabulary.ts';

/**
 * Weizenbaum’s DOCTOR script for ELIZA (Communications of the ACM, January 1966):
 * the rules, not a model. ELIZA finds the highest-ranked keyword in what you said,
 * cuts your words apart with that keyword’s first matching pattern, and puts them
 * back together with the next of its reply templates (each rule cycles through its
 * own). Keywords also swap words on the way in (I ↔ you, my ↔ your), which is how
 * your words come back pointed at you.
 *
 * A pattern is words separated by spaces: `0` is any run of words (even none),
 * `(a b)` is any one of those words, `@set` is any word in that set, and anything
 * else is itself. A template’s digits are the words matched by that part of the
 * pattern (1-based). `=key` answers with another keyword’s rules instead, and
 * `NEWKEY` gives up on this keyword and tries the next one.
 */

type Rule = [pattern: string, templates: string[]];

interface Keyword {
	/** Higher ranks win; equal ranks go in the order they appear in what you said. */
	rank: number;
	/** What the word becomes before matching. */
	sub?: string;
	/** Answer with another keyword’s rules. */
	link?: string;
	rules?: Rule[];
}

const NEWKEY = 'NEWKEY';

const SETS: Record<string, string[]> = {
	family: ['mother', 'father', 'sister', 'brother', 'wife', 'children'],
	belief: ['feel', 'think', 'believe', 'wish'],
	sad: ['sad', 'unhappy', 'depressed', 'sick'],
	happy: ['happy', 'elated', 'glad', 'better']
};

/** Said when no keyword answers. */
const NONE = [
	'I am not sure I understand you fully.',
	'Please go on.',
	'What does that suggest to you?',
	'Do you feel strongly about discussing such things?'
];

const KEYWORDS: Record<string, Keyword> = {
	sorry: {
		rank: 0,
		rules: [
			[
				'0',
				[
					'Please don’t apologize.',
					'Apologies are not necessary.',
					'What feelings do you have when you apologize?',
					'I’ve told you that apologies are not required.'
				]
			]
		]
	},
	remember: {
		rank: 5,
		rules: [
			[
				'0 you remember 0',
				[
					'Do you often think of 4?',
					'Does thinking of 4 bring anything else to mind?',
					'What else do you remember?',
					'Why do you remember 4 just now?',
					'What in the present situation reminds you of 4?',
					'What is the connection between me and 4?'
				]
			],
			[
				'0 do i remember 0',
				[
					'Did you think I would forget 5?',
					'Why do you think I should recall 5 now?',
					'What about 5?',
					'=what',
					'You mentioned 5.'
				]
			],
			['0', [NEWKEY]]
		]
	},
	if: {
		rank: 3,
		rules: [
			[
				'0 if 0',
				[
					'Do you think it’s likely that 3?',
					'Do you wish that 3?',
					'What do you think about 3?',
					'Really, 2 3?'
				]
			]
		]
	},
	dreamt: {
		rank: 4,
		rules: [
			[
				'0 you dreamt 0',
				[
					'Really, 4?',
					'Have you ever fantasied 4 while you were awake?',
					'Have you dreamt 4 before?',
					'=dream'
				]
			]
		]
	},
	dreamed: { rank: 4, sub: 'dreamt', link: 'dreamt' },
	dream: {
		rank: 3,
		rules: [
			[
				'0',
				[
					'What does that dream suggest to you?',
					'Do you dream often?',
					'What persons appear in your dreams?',
					'Don’t you believe that dream has something to do with your problem?'
				]
			]
		]
	},
	dreams: { rank: 3, sub: 'dream', link: 'dream' },
	perhaps: {
		rank: 0,
		rules: [
			[
				'0',
				[
					'You don’t seem quite certain.',
					'Why the uncertain tone?',
					'Can’t you be more positive?',
					'You aren’t sure.',
					'Don’t you know?'
				]
			]
		]
	},
	maybe: { rank: 0, sub: 'perhaps', link: 'perhaps' },
	name: {
		rank: 15,
		rules: [
			[
				'0',
				[
					'I am not interested in names.',
					'I’ve told you before, I don’t care about names. Please continue.'
				]
			]
		]
	},
	computer: {
		rank: 50,
		rules: [
			[
				'0',
				[
					'Do computers worry you?',
					'Why do you mention computers?',
					'What do you think machines have to do with your problem?',
					'Don’t you think computers can help people?',
					'What about machines worries you?',
					'What do you think about machines?'
				]
			]
		]
	},
	computers: { rank: 50, sub: 'computer', link: 'computer' },
	machine: { rank: 50, sub: 'computer', link: 'computer' },
	machines: { rank: 50, sub: 'computer', link: 'computer' },
	am: {
		rank: 0,
		sub: 'are',
		rules: [
			[
				'0 are you 0',
				[
					'Do you believe you are 4?',
					'Would you want to be 4?',
					'You wish I would tell you you are 4.',
					'What would it mean if you were 4?',
					'=what'
				]
			],
			['0', ['Why do you say “am”?', 'I don’t understand that.']]
		]
	},
	are: {
		rank: 0,
		rules: [
			[
				'0 are i 0',
				[
					'Why are you interested in whether I am 4 or not?',
					'Would you prefer if I weren’t 4?',
					'Perhaps I am 4 in your fantasies.',
					'Do you sometimes think I am 4?',
					'=what'
				]
			],
			[
				'0 are 0',
				[
					'Did you think they might not be 3?',
					'Would you like it if they were not 3?',
					'What if they were not 3?',
					'Possibly they are 3.'
				]
			]
		]
	},
	your: {
		rank: 0,
		sub: 'my',
		rules: [
			[
				'0 my 0',
				[
					'Why are you concerned over my 3?',
					'What about your own 3?',
					'Are you worried about someone else’s 3?',
					'Really, my 3?'
				]
			]
		]
	},
	was: {
		rank: 2,
		rules: [
			[
				'0 was you 0',
				[
					'What if you were 4?',
					'Do you think you were 4?',
					'Were you 4?',
					'What would it mean if you were 4?',
					'What does “4” suggest to you?',
					'=what'
				]
			],
			[
				'0 you was 0',
				[
					'Were you really?',
					'Why do you tell me you were 4 now?',
					'Perhaps I already knew you were 4.'
				]
			],
			[
				'0 was i 0',
				[
					'Would you like to believe I was 4?',
					'What suggests that I was 4?',
					'What do you think?',
					'Perhaps I was 4.',
					'What if I had been 4?'
				]
			],
			['0', [NEWKEY]]
		]
	},
	were: { rank: 2, sub: 'was', link: 'was' },
	me: { rank: 0, sub: 'you' },
	myself: { rank: 0, sub: 'yourself' },
	yourself: { rank: 0, sub: 'myself' },
	i: {
		rank: 0,
		sub: 'you',
		rules: [
			[
				'0 you (want need) 0',
				[
					'What would it mean to you if you got 4?',
					'Why do you want 4?',
					'Suppose you got 4 soon.',
					'What if you never got 4?',
					'What would getting 4 mean to you?',
					'What does wanting 4 have to do with this discussion?'
				]
			],
			[
				'0 you are 0 @sad 0',
				[
					'I am sorry to hear you are 5.',
					'Do you think coming here will help you not to be 5?',
					'I’m sure it’s not pleasant to be 5.',
					'Can you explain what made you 5?'
				]
			],
			[
				'0 you are 0 @happy 0',
				[
					'How have I helped you to be 5?',
					'Has your treatment made you 5?',
					'What makes you 5 just now?',
					'Can you explain why you are suddenly 5?'
				]
			],
			['0 you was 0', ['=was']],
			[
				'0 you @belief you 0',
				['Do you really think so?', 'But you are not sure you 5.', 'Do you really doubt you 5?']
			],
			['0 you 0 @belief 0 i 0', ['=you']],
			[
				'0 you are 0',
				[
					'Is it because you are 4 that you came to me?',
					'How long have you been 4?',
					'Do you believe it is normal to be 4?',
					'Do you enjoy being 4?'
				]
			],
			[
				'0 you (can’t cannot) 0',
				[
					'How do you know you can’t 4?',
					'Have you tried?',
					'Perhaps you could 4 now.',
					'Do you really want to be able to 4?'
				]
			],
			[
				'0 you don’t 0',
				[
					'Don’t you really 4?',
					'Why don’t you 4?',
					'Do you wish to be able to 4?',
					'Does that trouble you?'
				]
			],
			[
				'0 you feel 0',
				[
					'Tell me more about such feelings.',
					'Do you often feel 4?',
					'Do you enjoy feeling 4?',
					'Of what does feeling 4 remind you?'
				]
			],
			[
				'0 you 0 i 0',
				[
					'Perhaps in your fantasy we 3 each other.',
					'Do you wish to 3 me?',
					'You seem to need to 3 me.',
					'Do you 3 anyone else?'
				]
			],
			[
				'0',
				[
					'You say 1.',
					'Can you elaborate on that?',
					'Do you say 1 for some special reason?',
					'That’s quite interesting.'
				]
			]
		]
	},
	you: {
		rank: 0,
		sub: 'i',
		rules: [
			['0 i remind you of 0', ['=dit']],
			[
				'0 i are 0',
				[
					'What makes you think I am 4?',
					'Does it please you to believe I am 4?',
					'Do you sometimes wish you were 4?',
					'Perhaps you would like to be 4.'
				]
			],
			[
				'0 i 0 you',
				[
					'Why do you think I 3 you?',
					'You like to think I 3 you, don’t you?',
					'What makes you think I 3 you?',
					'Really, I 3 you?',
					'Do you wish to believe I 3 you?',
					'Suppose I did 3 you. What would that mean?',
					'Does someone else believe I 3 you?'
				]
			],
			[
				'0 i 0',
				[
					'We were discussing you, not me.',
					'Oh, I 3?',
					'You’re not really talking about me, are you?',
					'What are your feelings now?'
				]
			]
		]
	},
	yes: {
		rank: 0,
		rules: [['0', ['You seem quite positive.', 'You are sure.', 'I see.', 'I understand.']]]
	},
	certainly: { rank: 0, sub: 'yes', link: 'yes' },
	no: {
		rank: 0,
		rules: [
			[
				'0',
				[
					'Are you saying “no” just to be negative?',
					'You are being a bit negative.',
					'Why not?',
					'Why “no”?'
				]
			]
		]
	},
	my: {
		rank: 2,
		sub: 'your',
		rules: [
			[
				'0 your 0 @family 0',
				[
					'Tell me more about your family.',
					'Who else in your family 5?',
					'Your 4.',
					'What else comes to mind when you think of your 4?'
				]
			],
			[
				'0 your 0',
				[
					'Your 3.',
					'Why do you say your 3?',
					'Does that suggest anything else which belongs to you?',
					'Is it important to you that 2 3?'
				]
			]
		]
	},
	can: {
		rank: 0,
		rules: [
			[
				'0 can i 0',
				[
					'You believe I can 4, don’t you?',
					'=what',
					'You want me to be able to 4.',
					'Perhaps you would like to be able to 4 yourself.'
				]
			],
			[
				'0 can you 0',
				[
					'Whether or not you can 4 depends on you more than on me.',
					'Do you want to be able to 4?',
					'Perhaps you don’t want to 4.',
					'=what'
				]
			]
		]
	},
	what: {
		rank: 0,
		rules: [
			[
				'0',
				[
					'Why do you ask?',
					'Does that question interest you?',
					'What is it you really want to know?',
					'Are such questions much on your mind?',
					'What answer would please you most?',
					'What do you think?',
					'What comes to your mind when you ask that?',
					'Have you asked such questions before?',
					'Have you asked anyone else?'
				]
			]
		]
	},
	how: { rank: 0, sub: 'what', link: 'what' },
	when: { rank: 0, sub: 'what', link: 'what' },
	because: {
		rank: 0,
		rules: [
			[
				'0',
				[
					'Is that the real reason?',
					'Don’t any other reasons come to mind?',
					'Does that reason seem to explain anything else?',
					'What other reasons might there be?'
				]
			]
		]
	},
	why: {
		rank: 0,
		rules: [
			[
				'0 why don’t i 0',
				[
					'Do you believe I don’t 5?',
					'Perhaps I will 5 in good time.',
					'Should you 5 yourself?',
					'You want me to 5?',
					'=what'
				]
			],
			[
				'0 why can’t you 0',
				[
					'Do you think you should be able to 5?',
					'Do you want to be able to 5?',
					'Do you believe this will help you to 5?',
					'Have you any idea why you can’t 5?',
					'=what'
				]
			],
			['0', ['=what']]
		]
	},
	everyone: {
		rank: 2,
		rules: [
			[
				'0 (everyone everybody nobody noone) 0',
				[
					'Really, 2?',
					'Surely not 2.',
					'Can you think of anyone in particular?',
					'Who, for example?',
					'You are thinking of a very special person.',
					'Who, may I ask?',
					'Someone special perhaps.',
					'You have a particular person in mind, don’t you?',
					'Who do you think you’re talking about?'
				]
			]
		]
	},
	everybody: { rank: 2, link: 'everyone' },
	nobody: { rank: 2, link: 'everyone' },
	noone: { rank: 2, link: 'everyone' },
	always: {
		rank: 1,
		rules: [
			[
				'0',
				[
					'Can you think of a specific example?',
					'When?',
					'What incident are you thinking of?',
					'Really, always?'
				]
			]
		]
	},
	like: {
		rank: 10,
		rules: [
			['0 (am is are was) 0 like 0', ['=dit']],
			['0', [NEWKEY]]
		]
	},
	dit: {
		rank: 10,
		rules: [
			[
				'0',
				[
					'In what way?',
					'What resemblance do you see?',
					'What does that similarity suggest to you?',
					'What other connections do you see?',
					'What do you suppose that resemblance is?',
					'What is the connection?',
					'Could there really be some connection?',
					'How?'
				]
			]
		]
	},
	alike: { rank: 10, link: 'dit' },
	same: { rank: 10, sub: 'alike', link: 'dit' },
	hello: { rank: 0, rules: [['0', ['How do you do. Please state your problem.']]] }
};

/** One word, read the way Baby reads it (lowercase, straight apostrophes). */
function word(text: string): string {
	return tokenize(text).join('');
}

/** Words have a letter or digit; every other token is punctuation, which ends a clause. */
const isWord = (token: string) => /[\p{L}\p{N}]/u.test(token);

function keyword(token: string): Keyword | undefined {
	return Object.hasOwn(KEYWORDS, token) ? KEYWORDS[token] : undefined;
}

function rulesOf(key: string): Rule[] {
	const found = keyword(key);
	if (!found) throw new RangeError(`No DOCTOR keyword “${key}”`);
	return found.rules ?? rulesOf(found.link ?? '');
}

/** Whether a keyword can answer (some, like “me,” only swap words). */
function answers(token: string): boolean {
	const found = keyword(token);
	return Boolean(found?.rules ?? found?.link);
}

/**
 * ELIZA reads one clause: the first that has a keyword, or else the last. Returns
 * its words after substitution, and its keywords, best first.
 */
function scan(text: string): { input: string[]; keys: string[] } {
	const clauses: string[][] = [[]];
	for (const token of tokenize(text)) {
		if (isWord(token)) clauses.at(-1)?.push(token);
		else clauses.push([]);
	}
	const spoken = clauses.filter((clause) => clause.length > 0);
	const clause = spoken.find((words) => words.some(answers)) ?? spoken.at(-1) ?? [];
	const keys = [...new Set(clause.filter(answers))];
	// A stable sort keeps equal ranks in the order they were said.
	keys.sort((a, b) => (keyword(b)?.rank ?? 0) - (keyword(a)?.rank ?? 0));
	return { input: clause.map((token) => keyword(token)?.sub ?? token), keys };
}

function matches(part: string, token: string): boolean {
	if (part.startsWith('@')) return (SETS[part.slice(1)] ?? []).includes(token);
	if (part.startsWith('(')) return part.slice(1, -1).split(' ').map(word).includes(token);
	return word(part) === token;
}

/** The words each pattern part matched, or null. A `0` takes as few words as it can. */
function decompose(parts: readonly string[], input: readonly string[]): string[][] | null {
	const [part, ...rest] = parts;
	if (part === undefined) return input.length === 0 ? [] : null;
	if (part === '0') {
		for (let take = 0; take <= input.length; take++) {
			const tail = decompose(rest, input.slice(take));
			if (tail) return [input.slice(0, take), ...tail];
		}
		return null;
	}
	const [first, ...after] = input;
	if (first === undefined || !matches(part, first)) return null;
	const tail = decompose(rest, after);
	return tail && [[first], ...tail];
}

function reassemble(template: string, components: string[][]): string {
	return template.replace(/\d/g, (digit) => components[Number(digit) - 1]?.join(' ') ?? '');
}

/** One ELIZA running the DOCTOR script. Its replies depend on what it has said before. */
export class Doctor {
	/** How far each rule is through its templates. */
	#turns = new Map<string, number>();

	respond(text: string): string {
		const { input, keys } = scan(text);
		for (const key of keys) {
			const reply = this.#answer(key, input);
			if (reply !== undefined) return reply;
		}
		return this.#next('none', NONE);
	}

	#answer(key: string, input: string[]): string | undefined {
		for (const [index, [pattern, templates]] of rulesOf(key).entries()) {
			const components = decompose(pattern.match(/\([^)]*\)|\S+/g) ?? [], input);
			if (!components) continue;
			const template = this.#next(`${key} ${index}`, templates);
			if (template === NEWKEY) return undefined;
			if (template.startsWith('=')) return this.#answer(template.slice(1), input);
			return reassemble(template, components);
		}
		return undefined;
	}

	#next(rule: string, templates: string[]): string {
		const turn = this.#turns.get(rule) ?? 0;
		this.#turns.set(rule, turn + 1);
		return templates[turn % templates.length] ?? '';
	}
}
