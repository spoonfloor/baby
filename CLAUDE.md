# Baby — working conventions

Product brief: `README.md`. Solo hobby project: enterprise-quality code, no team process.

## Principles

- Fix problems at the highest appropriate level. No bandaids, no hacks, no tech debt; refactors toward best practice are welcome.
- Sameness: anything that should look or act the same comes from one definition (a token, a component). Never duplicate a value.
- No motion unless the user has approved it. Instant state changes by default.

## Stack

SvelteKit 3 (static adapter, `ssr = false`), Svelte 5 runes, TypeScript strict, Vite, npm.

- SvelteKit config lives in `vite.config.ts` (there is no `svelte.config.js` in Kit 3).
- Import local code via `#lib/...` (package.json `imports`), always with the file extension: `#lib/baby/index.ts`, `./protocol.ts`.

## Layout

```
src/lib/styles/   tokens.css (all raw values) + base.css
src/lib/ui/       presentational components: props in, callbacks out, no app logic
src/lib/chat/     conversation state (Chat class, runes)
src/lib/baby/     the model, behind the Baby protocol
  protocol.ts     the app ↔ model seam: status/token/done events
  client.ts       app side: createBaby(endpoint) → Baby
  babble.ts       stub model (random words); the real model replaces it
  worker/         worker entry, its own TS project (WebWorker globals, not DOM)
src/routes/       / (chat), /kitchen-sink (every component in every state)
```

## Rules enforced by tooling

- **Tokens** (Stylelint): hex/named colors, color functions, and px/rem/em/ms/s units are allowed only in `tokens.css`. `--raw-*` primitives are never used outside it; components use semantic tokens.
- **Motion** (Stylelint): `transition*`, `animation*`, `@keyframes` and `scroll-behavior` are banned except in files on `APPROVED_ANIMATIONS` in `stylelint.config.js`. Add a file there only after the user approves the animation.
- **No inline styles** in Svelte markup (ESLint), since they would bypass the token rules.

## Workflow

- `npm run dev`: dev server. `/kitchen-sink` is the design-review page; add new components and states there.
- `npm run check`: types (app + worker), ESLint, Stylelint, Prettier, Vitest. Must pass before every commit.
- `npm run format`: auto-fix formatting.
- Unit tests only for logic that can break (state, protocol, model code). No coverage targets.
- Commit straight to `main`.
