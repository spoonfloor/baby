# Baby — working conventions

Product brief: `README.md`. Solo hobby project: enterprise-quality code, no team process.

## Principles

- Fix problems at the highest appropriate level. No bandaids, no hacks, no tech debt; refactors toward best practice are welcome.
- Sameness: anything that should look or act the same comes from one definition (a token, a component). Never duplicate a value.
- No motion unless the user has approved it. Instant state changes by default.
- Baby stays pure. Baby takes in text and produces its own words; nothing edits, replaces, or injects into its replies. How it learns, what text it sees (including conversation history), how it picks words, and learned mechanisms like copying words from the prompt are all fine. The app speaks only in its own voice.

## Stack

SvelteKit 3 (static adapter, `ssr = false`), Svelte 5 runes, TypeScript strict, Vite, npm.

- SvelteKit config lives in `vite.config.ts` (there is no `svelte.config.js` in Kit 3).
- Import local code via `#lib/...` (package.json `imports`), always with the file extension: `#lib/baby/index.ts`, `./protocol.ts`.

## Layout

```
src/lib/styles/   tokens.css (all raw values) + base.css
src/lib/ui/       presentational components: props in, callbacks out, no app logic
src/lib/chat/     conversation state (Chat class, runes) + app notices (the app's own voice)
src/lib/baby/     the model, behind the Baby protocol
  protocol.ts     the app ↔ model seam: reply/read requests → status/token/done events; pushed state
  client.ts       app side: createBaby(endpoint) → Baby
  vocabulary.ts   word-level tokenizer (punctuation marks are words); vocabulary starts with only the markers [UNK], [EOS], [YOU], [BABY]
  script.ts       conversation format: `[YOU] … [EOS] [BABY] … [EOS]`, parsed from `you: …` lines
  reading.ts      documents (exact tokens Baby trains on) + reading stats, shared by preview and status
  model.ts        untrained model: mute until it reads, then uniform random picks
  worker/         worker entry, its own TS project (WebWorker globals, not DOM)
src/lib/library/  primers (texts we supply) in groups for the sources panel: Chatbot 101, then subjects A–Z
src/routes/       / (chat), /kitchen-sink (every component in every state)
lab/              lesson lab: trains Baby headless on Chatbot 101 and scores replies against probes
```

## Rules enforced by tooling

- **Tokens** (Stylelint): hex/named colors, color functions, and px/rem/em/ms/s units are allowed only in `tokens.css`. `--raw-*` primitives are never used outside it; components use semantic tokens.
- **Motion** (Stylelint): `transition*`, `animation*`, `@keyframes` and `scroll-behavior` are banned except in files on `APPROVED_ANIMATIONS` in `stylelint.config.js`. Add a file there only after the user approves the animation.
- **No inline styles** in Svelte markup (ESLint), since they would bypass the token rules.
- **Curly quotes** (ESLint): user-facing text uses ’ “ ”, never straight quotes. Code that genuinely needs one disables the rule on that line with a reason.

## Voices

Three voices, kept visibly distinct: the user (bubble), Baby (status line + plain reply), and the app (`AppMessage`, `--color-app-voice`). Baby stays honest (an empty reply is empty); the app interprets Baby's state and explains. Copy that depends on the device says Click/Tap via `pointerVerb()`.

Status lines are always a single fragment with no final period (“Looked for words to say but found none”), never two sentences.

## Workflow

- `npm run dev`: dev server. `/kitchen-sink` is the design-review page; add new components and states there.
- `npm run check`: types (app + worker), ESLint, Stylelint, Prettier, Vitest. Must pass before every commit.
- `npm run format`: auto-fix formatting.
- `npm run lab`: trains Baby in Node on Chatbot 101 (several seeds in parallel) and scores each pack against its probes and targets (`lab/probes.ts`). Use it to change a lesson: edit the script, rerun, compare against `lab/rubric.md` (what makes a good chat, and the lesson-writing rules), and record what changed in `lab/log.md`. `--through <pack>` stops early for faster iteration.
- Lessons are Claude’s to develop: scripts, probes, and the lab, judged against `lab/rubric.md`, without asking each round. App UI and copy, the model, and the protocol are proposed first.
- Unit tests only for logic that can break (state, protocol, model code). No coverage targets.
- Commit straight to `main`.
