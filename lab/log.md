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
