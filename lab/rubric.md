# What makes a good chat

The standard every lesson change is judged against. `log.md` records what changed and why; this file is the current rules. When a decision changes them, log it there and update this file to match.

## Qualities

Baby is small and knows few words, so the bar is a chat that’s fun to poke at, not one that’s smart.

| quality            | means                                                        | judged by                                         |
| ------------------ | ------------------------------------------------------------ | ------------------------------------------------- |
| Responsive         | the reply fits what you said                                 | lab: trained, near, held-out                      |
| Quirky, not broken | complete thoughts, even random ones                          | lab: clean stop, role leak; reading for fragments |
| Personality        | sounds like one consistent character                         | reading                                           |
| Engaging           | asks things back, brings up topics, asks what you meant      | reading                                           |
| Varied             | doesn’t fall into a rut                                      | reading                                           |
| Honest             | owns its limits, in character; doesn’t pretend it understood | reading                                           |

**Quirky vs broken** matters most. Quirky is a whole sentence that commits to a thought, even off topic:

```
baby: Do you like horses?
baby: I don’t like funky smells. Do you like funky smells?
```

Broken is a fragment, or the same reply whatever you say:

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
- **Length is a judgment call.** Each addition is justified in the log. Reading time is what the user feels, so the lab reports it, and each lesson should read in about 40 seconds or less.
- **Baby stays pure** (see `CLAUDE.md`): lessons shape Baby only through what it reads.

## Each round

1. Run `npm run lab` and read the replies, not just the scores.
2. Name the cause of the worst failure, edit the script for that cause, rerun.
3. Keep it if it helps without breaking another quality; undo it otherwise.
4. Log it. Stop when two rounds in a row don’t help.

## Beyond scripts

Some qualities need more than lessons. Each is a product decision, not a script change:

- **Memory.** Baby sees only the latest message, though the README specifies the whole labeled history. Needed for reacting to repetition and for using what you told it.
- **Unknown words.** Baby never trains on `[UNK]`, so it can’t learn what to do with a word it doesn’t know. Hiding some words during training would let lessons teach “what is ‘X’?”. Copying words from the prompt (“hi there !”) is allowed as a learned mechanism.
- **The app noticing a rut.** When Baby’s replies repeat or its confidence stays low, the app (in its own voice) could suggest more reading: “Baby seems a bit stuck. Try giving it more to read.”
