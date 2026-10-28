/**
 * Mundane things to tell a 1966 psychotherapist, built from sentence frames with
 * blanks. Every frame aims at one of DOCTOR’s rules, and the blanks vary, so the
 * pattern to learn is copying your words back rather than any one reply.
 */

const thing = [
	'toaster',
	'cat',
	'landlord',
	'neighbor',
	'houseplant',
	'car',
	'boss',
	'roommate',
	'dentist',
	'laptop',
	'sourdough starter',
	'bike',
	'dog',
	'phone',
	'couch',
	'printer',
	'goldfish',
	'coworker',
	'fridge',
	'umbrella',
	'parrot',
	'microwave',
	'kettle',
	'alarm clock',
	'mailman',
	'barber',
	'hamster',
	'blender',
	'vacuum',
	'cactus',
	'ceiling fan',
	'garden gnome',
	'bus driver',
	'neighbor’s dog'
];
const family = ['mother', 'father', 'sister', 'brother', 'wife'];
const does = [
	'ignores me',
	'judges me',
	'hates me',
	'is plotting against me',
	'is louder than me',
	'eats my snacks',
	'sings at night',
	'keeps beeping',
	'never listens to me',
	'looks at me funny',
	'is smarter than me',
	'takes my parking spot',
	'wakes me up at five',
	'steals my socks',
	'makes a strange noise',
	'does not respect me',
	'knows my secrets',
	'is better at cooking than me',
	'hums all day',
	'wants more attention',
	'is too quiet',
	'smells like soup'
];
const feeling = [
	'tired',
	'hungry',
	'bored',
	'nervous',
	'sleepy',
	'confused',
	'cold',
	'busy',
	'grumpy',
	'lonely',
	'anxious',
	'cranky',
	'restless',
	'worried',
	'stressed',
	'jealous',
	'silly',
	'brave'
];
const sad = ['sad', 'unhappy', 'depressed', 'sick'];
const happy = ['happy', 'elated', 'glad', 'better'];
const wanted = [
	'a nap',
	'a sandwich',
	'a new toaster',
	'more snacks',
	'a vacation',
	'a bigger couch',
	'a quiet neighbor',
	'a better printer',
	'a hug',
	'a pet goat',
	'more sleep',
	'a cup of tea',
	'a raise',
	'a new umbrella',
	'a day off',
	'pancakes',
	'a nicer landlord',
	'some peace and quiet'
];
const action = [
	'find my keys',
	'fold a fitted sheet',
	'parallel park',
	'open this jar',
	'fall asleep',
	'whistle',
	'cook rice',
	'fix the printer',
	'stop eating cookies',
	'remember names',
	'wake up early',
	'keep a plant alive',
	'find a matching sock',
	'say no to my boss',
	'finish my soup',
	'ride a bike'
];
const dislike = [
	'like my boss',
	'trust the toaster',
	'understand my cat',
	'enjoy mornings',
	'want to go to work',
	'eat vegetables',
	'like the new couch',
	'trust my landlord',
	'enjoy parties',
	'like the rain',
	'want to do the dishes',
	'understand the printer'
];
const place = ['work', 'the office', 'the gym', 'the store', 'the party', 'school', 'the dentist'];
const youAre = [
	'a good listener',
	'very quiet',
	'not very helpful',
	'too nosy',
	'smarter than my cat',
	'a little strange',
	'very patient',
	'kind of boring',
	'nicer than my landlord',
	'a robot'
];
const areYou = [
	'a robot',
	'listening',
	'judging me',
	'awake',
	'hungry',
	'my friend',
	'real',
	'busy',
	'bored'
];
const youDo = [
	'never listen to',
	'don’t understand',
	'always interrupt',
	'annoy',
	'confuse',
	'judge',
	'ignore',
	'like'
];
const was = [
	'late again',
	'rude to the mailman',
	'tired all day',
	'at the store',
	'asleep on the couch',
	'very hungry',
	'wrong about the toaster',
	'nervous at the party'
];
const remembered = [
	'my first bike',
	'the old toaster',
	'my first car',
	'my grandmother’s kitchen',
	'the big snow',
	'my old roommate',
	'the summer at the lake',
	'my first goldfish'
];
const dreamt = [
	'my cat was the mayor',
	'the toaster could talk',
	'I was a pancake',
	'my boss was a goose',
	'the fridge was full of bees',
	'I forgot my shoes',
	'my dentist could fly',
	'the bus never came'
];
const ifThen = [
	'the printer breaks again I will scream',
	'my cat ignores me again I will cry',
	'the bus is late again I will walk',
	'it rains tomorrow I will stay home',
	'my landlord calls again I will hide',
	'the toaster burns my bread I will buy a new one'
];
const why = [
	'Why don’t you ever smile?',
	'Why don’t you like soup?',
	'Why don’t you answer me?',
	'Why don’t you help me?',
	'Why can’t I sleep?',
	'Why can’t I find my keys?',
	'Why can’t I wake up early?',
	'Why can’t I cook rice?'
];
const questions = [
	'What time is it?',
	'How do I fold a fitted sheet?',
	'When does the bus come?',
	'What should I eat for lunch?',
	'How do I fix a printer?',
	'What is the meaning of soup?',
	'When will it stop raining?',
	'How do I talk to my cat?',
	'What day is it?',
	'How tall is a giraffe?'
];
const remarks = [
	'The weather is nice today.',
	'There is a pigeon on the balcony.',
	'It is raining again.',
	'The kettle is boiling.',
	'Pancakes are delicious.',
	'Mondays are long.',
	'The bus is full today.',
	'It is very windy.',
	'Soup is a meal.',
	'Socks are confusing.',
	'The office smells like toast.',
	'Traffic was terrible.',
	'Lunch was fine.',
	'The milk went bad.'
];

type Pick = (list: readonly string[]) => string;

/** Each frame fills its blanks to make one line. */
const frames: ((pick: Pick) => string)[] = [
	(p) => `My ${p(thing)} ${p(does)}.`,
	(p) => `I think my ${p(thing)} ${p(does)}.`,
	(p) => `My ${p(family)} ${p(does)}.`,
	(p) => `I feel ${p(feeling)}.`,
	(p) => `I feel ${p(feeling)} about ${p(place)}.`,
	(p) => `I feel like the ${p(thing)} ${p(does)}.`,
	(p) => `I am ${p(feeling)}.`,
	(p) => `I am ${p(feeling)} today.`,
	(p) => `I am ${p(sad)}.`,
	(p) => `I am ${p(sad)} about the ${p(thing)}.`,
	(p) => `I am ${p(happy)} today.`,
	(p) => `I am ${p(happy)} about the ${p(thing)}.`,
	(p) => `I want ${p(wanted)}.`,
	(p) => `I need ${p(wanted)}.`,
	(p) => `I can’t ${p(action)}.`,
	(p) => `I don’t ${p(dislike)}.`,
	(p) => `I think I am ${p(feeling)}.`,
	(p) => `I was ${p(was)}.`,
	(p) => `Was I ${p(was)}?`,
	(p) => `I remember ${p(remembered)}.`,
	(p) => `Do you remember ${p(remembered)}?`,
	(p) => `I dreamt ${p(dreamt)}.`,
	(p) => `I had a dream about the ${p(thing)}.`,
	(p) => `If ${p(ifThen)}.`,
	(p) => `You are ${p(youAre)}.`,
	(p) => `You are just like my ${p(thing)}.`,
	(p) => `You remind me of my ${p(thing)}.`,
	(p) => `You ${p(youDo)} me.`,
	(p) => `Are you ${p(areYou)}?`,
	(p) => `Am I ${p(feeling)}?`,
	(p) => `Can you ${p(action.filter((a) => !a.includes('my')))}?`,
	(p) => `Can I have ${p(wanted)}?`,
	(p) => `Were you ever a ${p(thing)}?`,
	(p) => p(why),
	(p) => p(questions),
	(p) => `Nobody likes the ${p(thing)}.`,
	(p) => `Everyone at ${p(place)} is ${p(feeling)}.`,
	(p) => `The ${p(thing)} is always ${p(feeling)}.`,
	(p) => `Because the ${p(thing)} told me.`,
	(p) => `Perhaps the ${p(thing)} is right.`,
	(p) => `Maybe I need ${p(wanted)}.`,
	(p) => `Sorry, the ${p(thing)} ${p(does)}.`,
	(p) => `Computers make me ${p(feeling)}.`,
	(p) => `Is my ${p(thing)} a computer?`,
	(p) => `My ${p(thing)} is like a ${p(thing)}.`,
	(p) => p(['Hello.', 'Hello there.', 'Hello!']),
	(p) => p(['Yes.', 'Yes, I am sure.', 'Certainly.', 'Yes, really.']),
	(p) => p(['No.', 'No, not really.', 'No, never.']),
	(p) => p(['Do you have a name?', 'What is your name?']),
	(p) => p(remarks)
];

/**
 * Up to `count` different lines, taking the frames in turn. A frame with few
 * possible lines simply runs out, leaving the rest to the frames with many.
 */
export function patientLines(count: number, random: () => number): string[] {
	const pick: Pick = (list) => list[Math.floor(random() * list.length)] ?? '';
	const lines = new Set<string>();
	for (let attempt = 0; lines.size < count && attempt < count * 50; attempt++) {
		lines.add(frames[attempt % frames.length]?.(pick) ?? '');
	}
	return [...lines];
}
