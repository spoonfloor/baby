# Baby

A PWA that trains a real, tiny language model (“Baby”) in the browser, so you can watch how LLMs work by watching one grow up from nothing.

## The point

Baby is supposed to be bad. The experience is about how bad it is with very little to read, and watching it get less bad, never “good.” Simplification in service of understanding.

## Core model decisions

- **Real, not simulated.** A genuine tiny transformer, trained on-device (WebGPU), running the actual math: embeddings, query/key/value, attention, softmax, residual connection, unembedding, sampling.
- **Token = word.** Word-level tokenizer. Unknown words become `[UNK]`; documents end with `[EOS]`. Possible later “grow up” toggle to word pieces.
- **Tiny by default.** 4 dimensions and 1 layer, so every number is inspectable. A size slider (16, 64, 128…) to show quality improving.
- **Random initialization** with a visible seed. Untrained = pure noise, shown as the baseline.
- **Training and chatting are separate phases**, but training can loop while the app is open, and chat always uses Baby’s current numbers.

## Feeding Baby

1. **Paste or upload text** (fully offline).
2. **Curated reading list:** public-domain texts (nursery rhymes, Aesop, the Constitution preamble, _Alice in Wonderland_), plus a Q&A curriculum.
3. **URLs / RSS / reader view:** via a small Cloudflare Worker proxy on erichenry.com, locked to the PWA’s origin and a domain allowlist. Offer raw page vs. RSS vs. Readability-cleaned text as a comparison of “diet.”
4. **New words** can be added mid-life (vocabulary expansion), seeded with noise or the average embedding — both worth comparing.

## Experiences

- **Birth:** before reading anything, Baby knows no words, so it is mute: the only thing it can pick is `[EOS]`. The Coach explains and points to the + menu. Once Baby has read something but isn’t trained, it babbles noise: real words in random order.
- **Probe prompts:** a fixed set of prompts replayed after each feeding, so you compare younger vs. older Baby.
- **Growth chart:** probability of the right next word over training time (“rock” climbing 44% → 99%).
- **Noise map:** which numbers training has touched vs. leftover randomness.
- **Peek inside:** step through any prompt’s forward pass, stage by stage, with plain-language labels in parentheses (embedding (coordinates), query (question), key (name tag), value (content), weights (dials)…).
- **Coach:** deterministic hints in a voice visibly separate from Baby’s, driven by Baby’s actual state (“Baby knows absolutely nothing. Try giving Baby something to read.” / “Baby has never seen ‘cake.’” / “Baby doesn’t know how to answer questions. Try these FAQs.”).
- **Forgetting:** show earlier lessons sagging when Baby reads only new material, and recovering when old docs are mixed back in.

## Feedback → training

- **“What do you wish Baby had said?”** → corrections become training text (supervised fine-tuning). Mix with earlier reading to avoid forgetting.
- **“How good was that?”** → 👍 answers reinforced, 👎 answers pushed down (a miniature of feedback training / RLHF).

## Rough scale (what’s fun)

| words read                | result                                                     |
| ------------------------- | ---------------------------------------------------------- |
| ~50                       | perfect recitation                                         |
| ~1k–5k (overlapping docs) | funny mashups at shared words                              |
| ~50k–200k                 | a recognizable “voice”                                     |
| millions+                 | facts and real answers — out of reach in a browser; say so |

## Q&A curriculum

1. **Memorized answers:** one FAQ (~2k words). Parroting.
2. **Answer-shaped replies:** 10k–50k words of consistent `Q: … A: …`. Knows it should answer; doesn’t know the answer.
3. **Real answers to new questions:** a generated world of ~100 fictional people with a few attributes each. Statements about everyone, Q&A for ~80%, the rest held out as the test. Each fact written several ways (paraphrase variety matters). Needs ~64–128 dimensions and a few layers. Generator settings become app knobs.

## Open questions

- Framework / build tooling for the PWA.
- Hosting: Cloudflare Pages on erichenry.com (same domain as the Worker) vs. GitHub Pages.
- First-run experience and the order of the reading list.
- How much of the math view ships in v1.
