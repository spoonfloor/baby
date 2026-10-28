# Lesson lab log

What changed in each lesson, why, and what the lab measured. Every number is after all of Chatbot 101 is read, with 5 seeds × 20 samples per probe (`npm run lab`). Targets are in `probes.ts`.

## 2026-10-27 · Baseline

| pack       | trained | near | held-out | clean stop | role leak | forgetting |
| ---------- | ------- | ---- | -------- | ---------- | --------- | ---------- |
| greetings  | 96%     | 45%  | 14%      | 100%       | 0%        | 5%         |
| thanks     | 88%     | 37%  | 2%       | 100%       | 1%        | 11%        |
| goodbyes   | 97%     | 17%  | 49%      | 100%       | 2%        | 1%         |
| about-baby | 93%     | 18%  | 0%       | 100%       | 1%        | 0%         |

Baby recites what it read but doesn’t generalize. In Greetings, each greeting appeared in exactly one framing, so Baby learned “this exact opening → this reply”, not “say the greeting back”: “good morning !” (never seen bare) got “good afternoon !”, the only bare greeting it knew.

## Greetings 1 · every greeting in several framings

Each greeting now appears three ways (bare, with “Baby”, with `!` / `.` / `,`), always with the same reply (“Good morning!”), so the framing stops predicting the reply and the greeting word is all that’s left to copy. Added more “how are you” openings. No probe is used verbatim (the lab refuses to run if one is).

greetings: near 45% → 77%, trained 98%, leak 1%, forgetting 0%. Every target met.

## Greetings 2 · more “how are you” openings

Added “Hello! How are you?”, “How are you doing?”, “Baby, how are you?”.

greetings: near 77% → 81%. Other packs mostly up or flat.

### Left open, outside Greetings

- **“how are you ?” → 0%.** Baby answers “i am baby .” / “i am a tiny language model .”, About Baby’s replies to “who are you ?” and “what are you ?”: same ending, and About Baby is read last. The fix belongs in About Baby (or the curriculum order), not Greetings.
- **“good afternoon , baby .” → 51%,** pulled toward Goodbyes’ “good night , baby .”, the same framing.
- **Thanks, Goodbyes, About Baby miss the near target** (44%, 37%, 12%), the same one-framing-per-turn pattern Greetings had.

## Lab · fairer scoring

- “Thank you.” now counts as thanks (it was rejected for its period).
- The leak guard checks every lesson, not just the probe’s own: a Greetings probe taught in About Baby would have slipped through.

## Thanks, Goodbyes, About Baby 1 · same fix as Greetings

Every prompt in two or three framings (bare, “…, Baby”, “Baby, …”, `!` / `.`), one reply each. Replies unified (“Thanks, Baby.” used to get “You’re welcome.” with a period, “Thank you!” got it with `!`).

| pack       | trained | near      | held-out  | role leak |
| ---------- | ------- | --------- | --------- | --------- |
| greetings  | 98%     | 81% → 88% | 19%       | 0%        |
| thanks     | 95%     | 44% → 88% | 19% → 40% | 0%        |
| goodbyes   | 96%     | 37% → 66% | 75% → 61% | 0%        |
| about-baby | 94%     | 12% → 64% | 0% → 6%   | 2%        |

Every near target met. The script steered some replies: “See you soon, Baby.” made “see you later , baby .” answer “see you soon !”, because the framing still predicted the reply.

## Goodbyes, About Baby 2 · more framings where one still decided the reply

Added “See you later, Baby!”, “See you soon!”, “Talk to you later, Baby.”, “I need to go.”, “What’s your name, Baby?”, “Who are you, Baby” (no `?`), “Baby, who are you?”.

| pack       | trained | near | held-out | clean stop | role leak | forgetting |
| ---------- | ------- | ---- | -------- | ---------- | --------- | ---------- |
| greetings  | 95%     | 91%  | 20%      | 100%       | 0.4%      | 0%         |
| thanks     | 97%     | 85%  | 17%      | 100%       | 1.5% ✗    | 1%         |
| goodbyes   | 95%     | 88%  | 33%      | 100%       | 1.4% ✗    | 0%         |
| about-baby | 91%     | 69%  | 5%       | 100%       | 1.4% ✗    | 0%         |

Held-out moves around by ±20 points between runs; with 2–3 probes per pack it’s noise, not signal.

Greetings’ open items resolved themselves once About Baby and Goodbyes varied their framings too: “how are you ?” 0% → 86%, “good afternoon , baby .” 51% → 69%.

### Left open: role leak is the format, not the scripts

Every leak follows a reply word that is also a speaker label: “thank you : …”, “see you : …”, “i am baby : …”. The script format uses `you` and `baby` as both ordinary words and the labels that start every turn (`you :`, `baby :`), so after “thank you” Baby often guesses a new turn begins. Scripts can only dilute this, and “thank you” can’t leave the Thanks lesson. The fix is labels that are never ordinary words. That changes the README’s “labels are ordinary words Baby learns”, so it’s a design call, not a script change.

## 2026-10-28 · Format: turn markers instead of speaker words

Turns now start with `[YOU]` / `[BABY]`, markers like `[EOS]` that no text can produce, instead of the words `you :` / `baby :`. If Baby picks a turn marker mid-reply, the reply ends there (`stop: 'turn'`), and the lab counts that as a role leak. No script changed.

| pack       | trained | near      | held-out | clean stop | role leak   | forgetting |
| ---------- | ------- | --------- | -------- | ---------- | ----------- | ---------- |
| greetings  | 97%     | 91% → 93% | 16%      | 100%       | 0.4% → 0.2% | 1%         |
| thanks     | 98%     | 85% → 94% | 21%      | 100%       | 1.5% → 0%   | 0%         |
| goodbyes   | 96%     | 88% → 95% | 33%      | 100%       | 1.4% → 0%   | 1%         |
| about-baby | 91%     | 69% → 82% | 4%       | 100%       | 1.4% → 0.4% | 0%         |

Every target met in every pack. The 20 remaining turn stops (of ~5,700 replies) are Baby losing the thread mid-reply (“i eat i eat”), not a collision with a word it said. Near scores rose too: Baby no longer has to tell the label `you` from the word `you`.

## 2026-10-28 · Rubric, and one reply per prompt

Scores alone missed what chatting with Baby feels like, so lessons are now judged against `rubric.md` too: six qualities, most judged by reading replies.

A/B on Greetings + Thanks, 3 seeds, one casual 13-message chat each:

- **One reply per prompt** (today): reliable and repetitive, “hi !” every time.
- **Two replies per prompt** (common prompts repeated with a second reply, Greetings +37% words): a little more variety, many more broken blends: “hi” → “thank you !”, “hi there” → “hello there you’re welcome afternoon !” and “?”. Reading time about the same, since practice stops at a plateau.
- **A different reply per framing:** worse, the framing decides the reply again (“how are you?” → “you’re welcome !”).

Kept one reply per prompt. Length is a judgment call, with reading time reported and each lesson under about 40 seconds.

Found along the way: bare “how are you?” is broken on every seed (“i am good afternoon !”); Greetings never asks it without a greeting or “Baby” attached.
