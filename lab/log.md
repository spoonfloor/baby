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

A/B on Greetings + Thanks, 3 seeds, one casual 13-message chat each (`experiments/replies-per-prompt.ts`):

- **One reply per prompt** (today): reliable and repetitive, “hi !” every time.
- **Two replies per prompt** (common prompts repeated with a second reply, Greetings +37% words): a little more variety, many more broken blends: “hi” → “thank you !”, “hi there” → “hello there you’re welcome afternoon !” and “?”. Reading time about the same, since practice stops at a plateau.
- **A different reply per framing:** worse, the framing decides the reply again (“how are you?” → “you’re welcome !”).

Kept one reply per prompt. Length is a judgment call, with reading time reported and each lesson under about 40 seconds.

Found along the way: bare “how are you?” is broken on every seed (“i am good afternoon !”); Greetings never asks it without a greeting or “Baby” attached.

## 2026-10-28 · Experiment: learning from chat

Does reading the user’s own messages help? Baby read Greetings + Thanks, then the user’s 17 messages from two real chats as plain text (one document per message, no turn markers), 3 seeds (`experiments/learning-from-chat.ts`).

- **Words:** every unknown word became known (68 words, 20 new, ~10s of practice).
- **Lessons:** no forgetting; trained + near 93–97% → 96–99%.
- **Replies:** no better. Baby still answers with lesson replies (“thank you !”, “you’re welcome !”) because those are the only replies it has read. The chat’s words leak in as blends: “you’re little welcome !”, “thank you for talking with me that ?”.

Knowing a word isn’t understanding it, and plain text can’t teach what to say back. It also hides the “didn’t recognize” notice for messages Baby still can’t follow. Recommendation: don’t build it as planned.

## 2026-10-28 · Experiment: teaching replies from chat

Can the user teach Baby a reply? Baby read Greetings + Thanks, then 5 corrections as a script (a message from a real chat, and the reply Baby should have given, e.g. “IDK” → “Me too!”), read 1, 3 or 10 times, 3 seeds × 10 samples (`experiments/corrections.ts`).

| corrections read | exact message | near variant (“idk, Baby”, “this is repetitive”) | lesson probes |
| ---------------- | ------------- | ------------------------------------------------ | ------------- |
| none             | 0%            | 6%                                               | 93–96%        |
| ×1               | 97%           | 14%                                              | 97–99%        |
| ×3               | 97%           | 6%                                               | 88–96%        |
| ×10              | 99%           | 8%                                               | 89–97%        |

- **One correction is enough** for the exact message, and costs only the minimum 200 steps of practice.
- **It doesn’t generalize:** one framing per correction is the Baseline problem again. Teaching a few phrasings would, as it did for the lessons.
- **Repeating it doesn’t help** and starts to cost the lessons (one seed fell to 88%).
- Correction phrases leak into other replies as blends (“you’re song no . i only know a few words .”), on character if not on topic.

## 2026-10-29 · Rubric: the goal is enjoyable

The goal of a chat was stated four ways: the README’s “supposed to be bad”, the rubric’s “fun to poke at”, `CLAUDE.md`’s “how chatting feels”, and a private note’s “enjoyable”. Now the rubric is the one definition and the others point to it. A good chat is **enjoyable**: the six qualities, and never boring, confusing, frustrating (several replies in a row ignore you) or broken (no sentence to find). Word salad is judged by quality, not amount. Primitive comes free and is never a goal.

## 2026-10-29 · Experiment: born knowing Hello

Every new Baby now reads a first lesson, Hello (`you: Hello` / `baby: Hello`, twice), before anything else, so it answers from the first message (`experiments/first-word.ts`, 8 seeds × 20 samples).

- **One exchange vs two:** with one, a seed said nothing to “Hello!” / “Hello?” / “Hello.” 25–50% of the time. With two, every seed shows “Hello” to everything (~8% end on a turn marker instead of [EOS], which doesn’t show). Kept two.
- **Practice stops when learned:** practice now also stops once a block averages under 0.05 loss. Hello takes 100 steps instead of the minimum 200 (about 4s in Node, down from 9s). Lessons never get that low, so nothing else changes.

The cost to the lessons after it, 10 seeds each (trained / near):

| pack       | without Hello | Hello, 200 steps (5 seeds) | Hello, stops when learned |
| ---------- | ------------- | -------------------------- | ------------------------- |
| greetings  | 97% / 91%     | 92% / 79%                  | 94% / 87%                 |
| thanks     | 98% / 93%     | 92% / 79%                  | 98% / 86%                 |
| goodbyes   | 94% / 91%     | 90% / 82%                  | 93% / 84%                 |
| about-baby | 92% / 80%     | 79% / 39%                  | 85% / 56%                 |

Stopping early recovers about half the loss. Greetings’ first loss is still higher after Hello (2.17 vs 1.24): a Baby certain of one word unlearns that certainty slowly. About Baby misses its trained target.

## 2026-10-30 · Diagnosis: does learning Hello first cost the lessons?

Same 10 seeds, three curricula, scored after all of Chatbot 101 (`experiments/hello-first.ts`, 20 samples, trained / near):

| pack       | no Hello  | Hello first (now) | Hello folded into Greetings |
| ---------- | --------- | ----------------- | --------------------------- |
| greetings  | 97% / 86% | 97% / 87%         | 94% / 83%                   |
| thanks     | 99% / 91% | 98% / 92%         | 97% / 92%                   |
| goodbyes   | 97% / 94% | 96% / 87%         | 96% / 91%                   |
| about-baby | 88% / 77% | 87% / 72%         | 85% / 73%                   |

- **Hello first costs little:** within a few points everywhere but Goodbyes near (−7) and About Baby near (−5).
- **Folding Hello in is no better**, so over-certainty from reading Hello alone isn’t the cause. Label smoothing isn’t indicated.
- **The earlier 56% was mostly noise:** the same comparison in `npm run lab` (which also asks probes between readings) gave About Baby near 80% → 56%. Near scores swing widely from seed to seed, so a single 10-seed lab run can’t separate a cost this small from luck.

Kept Hello first. No model change.

## 2026-10-30 · Therapy Bot: copy your words back

ELIZA (1966) became Therapy Bot: inspired by DOCTOR, tuned for an enjoyable chat rather than faithful to it. The old script (600 exchanges, ~50 frames with absurd fill-ins, 4–6 rotating replies per rule) taught Baby DOCTOR’s openers but not its trick, reflecting your words: “i feel tired .” got “do you enjoy feeling silly ?”. The new script is 12 sentence shapes, each with exactly one reply that copies your words back pointed at you (“I hate my commute.” → “What do you hate about your commute?”), ordinary fill-ins, and small talk said several ways.

`experiments/therapy-bot.ts`, 5 seeds × 10 samples, Hello read first. Held-out probes fill a shape with words read elsewhere in the script but never in that shape; echo is the reply containing your words.

| script                                                   | words | trained | held-out | echo | salad |
| -------------------------------------------------------- | ----- | ------- | -------- | ---- | ----- |
| ELIZA (DOCTOR, before)                                   | 8715  | 18%     | 16%      | 4%   | 68%   |
| 12 shapes × 50                                           | 3301  | 77%     | 43%      | 82%  | 53%   |
| + endings (`.`, none, `!`), small talk said several ways | 3656  | 83%     | 35%      | 77%  | 57%   |
| 12 shapes × 100 (kept)                                   | 4942  | 73%     | 56%      | 83%  | 37%   |
| 12 shapes × 150                                          | 6224  | 70%     | 52%      | 81%  | 41%   |

- **Copying works once the data forces it.** With many fill-ins per shape and one reply, Baby echoes your words 4 times in 5. Most remaining salad is a near miss: the right shape with a neighbor’s word (“why is your sister worries ?”, from “What worries you about”).
- **Endings matter more than the numbers show.** Before them, a prompt typed without a period (“i am sleepy”) got “.”; after, it gets “how long have you been sleepy ?” about 2 times in 3. The held-out probes all end in a period, so their score doesn’t see it.
- **150 per shape is no better than 100** and reads longer.
- Still weak: two-blank shapes with an unread verb (“my boss hates me” → “why do you think your boss ?”), and anything in no shape (“You are the worst!”). Unknown words stay [UNK], as expected.

## 2026-10-30 · Therapy Bot 2: common words, more shapes, unknown words

A first chat with Therapy Bot went mostly outside it: nearly every message had a word it had never read (“Terrible.”, “They don’t respect me”, “Because she’s a bitch”), and those got salad. Three changes:

- **Lessons can write `[UNK]`** in your turn (`script.ts`), read as the same marker an unread word becomes in chat. Before, Baby never trained on [UNK], so it had no idea what to do with one.
- **Unknown-word replies.** Each shape has a reply for when its blank is a word Baby never read (“I hate [UNK].” → “What do you hate about it?”), and sentences made mostly of unread words get “I’m not sure I follow. What do you mean?”.
- **Wider coverage.** Common feelings (terrible, fine, okay, bad…), more topics (it, my life, people…), and 7 more shapes: I love…, You … me, She/He/They …, Because …, It’s ….

5 seeds × 10 samples. Unknown probes fill each shape with a word no script has (“glitching”).

| script                               | words | trained | held-out | echo | unknown | salad (held-out) |
| ------------------------------------ | ----- | ------- | -------- | ---- | ------- | ---------------- |
| Therapy Bot 1 (12 shapes × 100)      | 4942  | 73%     | 56%      | 83%  | –       | 37%              |
| 19 shapes × 70, 12 unknown per shape | 6297  | 77%     | 42%      | 71%  | 24%     | 51%              |
| 19 × 100, 20 unknown, “it” a topic   | 7249  | 73%     | 46%      | 72%  | 21%     | 48%              |
| 19 × 70, 12 unknown, “it” (kept)     | 6327  | 72%     | 40%      | 74%  | 18%     | 54%              |

- **Your chat is what improved.** Of the 21 casual prompts (mostly from that chat), the most common reply is now a whole, fitting sentence for about 16; in the chat itself, about 4 of 27 replies fit: “They don’t respect me” → “tell me more about them .” 49 of 50; “I drive nails into boards” → “i’m not sure i follow . what do you mean ?”; “I love it” → “what do you love about it ?”.
- **The scores fell on the narrow tests**, since each shape gets fewer lines and more shapes compete: copying 83% → 74%. A fair trade for covering what people actually say.
- **Shape-specific unknown replies mostly lose to the general one.** “You are glitching” gets “i’m not sure i follow” more than “why do you think i am like that ?”; the unknown score counts that as a miss. Honest, but it could become a rut.
- **100 per shape was no better than 70** and reads 15% longer. Runs swing several points from one to the next, so differences that small aren’t real.
- Still open: Baby sees only your latest message, so “I told you I am sad” can’t connect to anything.

## 2026-10-30 · Therapy Bot 3: fallbacks that fit, bare answers

A second chat: “I’m not sure I follow. What do you mean?” answered 9 of 32 messages, a rut; and sentences of known words in no shape (“bad”, “I don’t”, “I want to talk about my mother”) got salad, now worse off than unknown words.

- **The fallback fits how you started:** a bare unknown word → “What do you mean?”; “I [UNK]…” or “My [UNK]…” → “Tell me more about that.”; “You [UNK]…” → “We were talking about you, not me.”; “That [UNK]…” → “Why do you say that?”; anything else keeps “I’m not sure I follow.”
- **Bare answers and common shapes:** a feeling on its own (“bad” → “Why do you feel bad?”), I have been…, I want to…, I don’t…, I want to talk about my…, plus “I don’t.” → “Why not?” and “Lol.” → “What’s funny?”.

| script                         | words | trained | held-out | echo | unknown |
| ------------------------------ | ----- | ------- | -------- | ---- | ------- |
| Therapy Bot 2 (19 shapes × 70) | 6327  | 72%     | 40%      | 74%  | 18%     |
| 24 shapes × 70 (kept)          | 7682  | 54%     | 28%      | 54%  | 22%     |
| 24 shapes × 100                | 8446  | 55%     | 35%      | 58%  | 21%     |

- **The chat is what improved.** Of 20 prompts from the two chats, about 17 now most often get a fitting reply: “LOL” → “what’s funny ?” 41/50, “I cry a lot” → “tell me more about that .” 41/50, “I want to talk about my mother” → “tell me about your mother .” 36/50, “bad” → “why do you feel bad ?”.
- **Copying fell** (echo 74% → 54%): more shapes now share a model of the same size, and practice still stops around 1,100–1,700 steps. One seed stopped at loss 0.86, well short of the others, which suggests the plateau test stops early on a varied script. That’s a practice change, not a lesson one; noted, not changed.
- Kept 70 per shape: 100 recovered little and reads 10% longer.

## 2026-10-30 · Baby sees the exchange before your message

Chat now sends the conversation so far with each message (`protocol.ts` `Turn`), and Baby reads the latest exchange in front of yours. On its own that made things worse: practice read every conversation alone, from position 0, so a message with anything before it was something Baby had never seen. Therapy Bot’s held-out probes after one earlier exchange: **0% acceptable, 4% echo**, against 28% / 54% with nothing before them.

The fix is in practice, so it holds for every source: a window now reads up to two whole conversations back to back (`CHAINED_DOCUMENTS`), so Baby learns to answer a message that follows an exchange. Patience also went from 3 to 6 blocks: chained practice is noisier, and at 3 it stopped while replies were still improving.

| practice                    | Therapy Bot trained | held-out | echo | after an exchange | echo after | Chatbot 101 readings  |
| --------------------------- | ------------------- | -------- | ---- | ----------------- | ---------- | --------------------- |
| alone, patience 3 (before)  | 54%                 | 28%      | 54%  | 0%                | 4%         | 33s / 19s / 24s / 30s |
| fill the window, patience 3 | 16%                 | 3%       | 28%  | 4%                | 26%        | –                     |
| fill the window, patience 6 | 70%                 | 44%      | 78%  | 37%               | 75%        | 73s / 57s / 57s / 78s |
| two at a time, patience 3   | 61%                 | 37%      | 66%  | 28%               | 61%        | 40s / 29s / 26s / 32s |
| two at a time, patience 6 ✓ | 77%                 | 50%      | 82%  | 43%               | 79%        | 40s / 31s / 31s / 43s |

- **Filling the window was too costly:** steps took about twice as long, and Chatbot 101 lessons learned worse within their budget (Goodbyes trained 95% → 74%).
- **Two at a time keeps Chatbot 101 where it was:** Greetings 97% / 93% near, Thanks 99% / 90%, Goodbyes 95% / 93%, About Baby 90% / 83%, within a few points of before.
- **Patience 6 costs time:** Chatbot 101 lessons now run to their budget, up to 13 seconds longer (About Baby 43s), at the edge of the 40-second rule. Kept for Therapy Bot’s gain: echo after an exchange 79% against 61%.
- **A taught reply stays quick:** the fewest steps budgeted is no longer tied to patience, so it’s still 200.
- Therapy Bot’s conversations are still one exchange each, so nothing yet teaches Baby to _use_ the earlier exchange (“I told you I am sad”). That needs lessons whose conversations refer back.
