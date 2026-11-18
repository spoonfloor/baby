# Save server

Keeps saved models on your own machine, so they open on every device you connect to it. It’s one small Node program with no dependencies. It stores each save as two files in a folder and serves them to anyone who has its token. The app’s **Save or load model → Connect server** asks for its address and that token.

It also fetches pages and feeds for **Read from URL**, since browsers won’t let the app fetch other sites itself. It only fetches public addresses (never your VPS’s own network), only text (pages, RSS, Atom, plain text), up to 5 MB and 15 seconds. The app turns what comes back into text; the server never looks inside.

## Run it

Needs Node 22.6 or newer and a copy of this repository.

```bash
BABY_TOKEN=$(openssl rand -hex 32) npm run save-server
```

| Variable       | Default | What it does                                                                                                                |
| -------------- | ------- | --------------------------------------------------------------------------------------------------------------------------- |
| `BABY_TOKEN`   | —       | Required, 16+ characters. Every request must carry it. Keep it secret.                                                      |
| `BABY_SAVES`   | `saves` | The folder saves are kept in.                                                                                               |
| `PORT`         | `8787`  | The port it listens on.                                                                                                     |
| `BABY_ORIGINS` | `*`     | Comma-separated origins of pages allowed to call it, e.g. `https://spoonfloor.github.io`. The token protects it either way. |

## Put it on a VPS

Browsers only let the app (served over HTTPS) call a server over HTTPS, so the save server goes behind a reverse proxy that handles certificates.

**With Docker and a proxy already in Docker** (this is how baby.erichenry.com runs, beside a self-hosted Supabase whose Caddy holds ports 80 and 443):

1. Clone this repository on the VPS, and in `server/` create `.env` (it’s git-ignored):

   ```bash
   BABY_TOKEN=paste-a-long-random-secret
   BABY_ORIGINS=https://spoonfloor.github.io
   PROXY_NETWORK=supabase_default
   ```

2. Start it: `docker compose -f server/compose.yml up -d`. Saves land in `server/data/`; back that folder up.
3. Point the proxy at it. For Caddy, add a site block and restart the Caddy container:

   ```
   baby.erichenry.com {
   	reverse_proxy baby-saves:8787
   }
   ```

4. Add a DNS A record for the name, pointing at the VPS.

To update: `git pull` and `docker compose -f server/compose.yml restart`.

**Without Docker:** run `npm run save-server` under systemd (or any process manager) with the variables above, behind any HTTPS reverse proxy, e.g. Caddy with `reverse_proxy localhost:8787`.

## How it talks

The protocol is in `src/lib/saves/serverProtocol.ts`, shared with the app. Saves are versioned: a write says which version it expects to replace. If the server finds a different one, it refuses with 412, and the app asks whether to replace that save or save as a new one. `GET /fetch?url=…` answers with the page as the site sent it, and where it ended up after redirects in `Baby-Url`.
