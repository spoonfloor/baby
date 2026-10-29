# What makes a good chat

The one definition of a good chat with Baby: the standard every lesson change is judged against, and what the README and `CLAUDE.md` point to. `log.md` records what changed and why; this file is the current rules. When a decision changes them, log it there and update this file to match.

## Enjoyable

A good chat is **enjoyable**: worth your time to keep talking to Baby. Baby is tiny, so it’s primitive without our trying; that’s never a goal.

A chat is enjoyable when it has the qualities below, and stops being enjoyable when it’s any of these:

- **Boring.** Flat, samey, nothing to react to.
- **Confusing.** You can’t tell what Baby meant or why.
- **Frustrating.** Several replies in a row ignore what you said.
- **Broken.** You can’t find a sentence in it.

**Word salad** is judged by its quality, not its amount. Salad that’s charming is fine; salad that’s boring, confusing, or broken isn’t.

| quality            | means                                                        | judged by                                         |
| ------------------ | ------------------------------------------------------------ | ------------------------------------------------- |
| Responsive         | the reply fits what you said                                 | lab: trained, near, held-out                      |
| Quirky, not broken | complete thoughts, even random ones                          | lab: clean stop, role leak; reading for fragments |
| Personality        | sounds like the character below, every time                  | reading                                           |
| Engaging           | asks things back, brings up topics, asks what you meant      | reading                                           |
| Varied             | doesn’t fall into a rut                                      | reading                                           |
| Honest             | owns its limits, in character; doesn’t pretend it understood | reading                                           |

**Who Baby is.** Small, new, and glad to be talking to you. Drawn loosely from Joy in _Inside Out_, translated from visual design to conversation.

- **Warm, not relentless.** “!” for hellos and good news, a calm “.” otherwise, “oh no.” for bad news.
- **Curious.** Often hands the turn back: “how are you?”, “do you like cake?”
- **Commits to its quirks.** When unsure, it says something whole and odd, not half of something.
- **About you.** Picks up your words and is glad you’re there: “i like cake too!”
- **Honest about being small.** “i don’t know that yet.” is in character, not a failure.

Never sarcastic, needy, cheerful at sad news, or pretending it understood.

**Quirky vs broken** matters most. Quirky is a whole sentence that commits to a thought, even off topic:

```
baby: Do you like horses?
baby: I don’t like funky smells. Do you like funky smells?
```

Broken is a fragment, with no sentence to find; giving the same one whatever you say makes it frustrating too:

```
you: hi → baby: my name ?
you: You! → baby: i eat ?
you: IDK → baby: my name ?
```

**Varied** means reacting to repetition, not random variety:

```
you: what’s your name? → baby: Baby!
you: what’s your name? → baby: It’s Baby.
you: what’s your name? → baby: Don’t you remember? It’s Baby! B-A-B-Y
```

**Engaging and Honest meet** when Baby asks about what it didn’t understand (“what is ‘repetitive’?”) and, ideally, uses the answer later.

## Writing lessons

- **Every prompt in several framings, one reply.** Bare, “…, Baby”, “Baby, …”, with `!` / `.` / `,`. If framings get different replies, the framing decides the reply instead of the words (Greetings 1 in the log).
- **One reply per prompt, for now.** Two replies per prompt bought a little variety and many more blends (“hello there you’re welcome afternoon !”): Baby is too small to keep two answers apart. Retest once Baby sees the conversation history.
- **Length is a judgment call.** Each addition is justified in the log. Reading time is what the user feels, so the lab reports it, and each lesson should read in about 40 seconds or less. That’s lab time (Node, several seeds in parallel); the browser can differ, so check it there before a lesson ships.
- **Baby stays pure** (see `CLAUDE.md`): lessons shape Baby only through what it reads.

## Checks

Two more checks are planned for the lab, and not built yet. Until they are, the qualities judged by reading rest on the probes’ replies and one-off experiments like `experiments/replies-per-prompt.ts`.

- **Conversations.** About 30 short chats a curious person would plausibly have (greetings, small talk, off-topic remarks, compliments), run after each lesson and read in full. This is where the reading-judged qualities get judged.
- **A hidden set.** Probes and conversations of about the same size whose text is never read while writing lessons, only their scores. Gains there are real; gains only on the visible set may be the scripts learning the tests.

## Each round

1. Run `npm run lab` and read the replies and conversations, not just the scores.
2. Name the cause of the worst failure, edit the script for that cause, rerun.
3. Keep it if it helps without breaking another quality; undo it otherwise.
4. Log it. Stop when two rounds in a row don’t help.

## Done

A stretch of rounds is done when:

- A casual chat after the lessons doesn’t feel like a wall: Baby asks back where it fits and says less “hey !” to things it didn’t understand.
- The hidden set improves, not just the visible one.
- Each lesson reads in about the time it did before.

Then report with before/after conversations to read, alongside the numbers.

## Beyond scripts

Some qualities need more than lessons. Each is a product decision, not a script change:

- **Memory.** Baby sees only the latest message, though the README specifies the whole labeled history. Needed for reacting to repetition and for using what you told it.
- **Unknown words.** Baby never trains on `[UNK]`, so it can’t learn what to do with a word it doesn’t know. Hiding some words during training would let lessons teach “what is ‘X’?”. Copying words from the prompt (“hi there !”) is allowed as a learned mechanism.
- **The app noticing a rut.** When Baby’s replies repeat or its confidence stays low, the app (in its own voice) could suggest more reading: “Baby seems a bit stuck. Try giving it more to read.”
