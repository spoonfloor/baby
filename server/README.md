# Save server

Keeps saved models on your own machine, so they open on every device you connect to it. It’s one small Node program with no dependencies. It stores each save as two files in a folder and serves them to anyone who has its token. The app’s **Save or load model → Connect server** asks for its address and that token.

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

Browsers only let the app (served over HTTPS) call a server over HTTPS, so put the save server behind a reverse proxy that handles certificates. With [Caddy](https://caddyserver.com), the whole config is:

```
baby.example.com {
	reverse_proxy localhost:8787
}
```

To keep it running, a systemd unit (`/etc/systemd/system/baby-saves.service`):

```ini
[Unit]
Description=Baby save server
After=network.target

[Service]
WorkingDirectory=/opt/baby
Environment=BABY_TOKEN=paste-your-token-here
Environment=BABY_SAVES=/var/lib/baby-saves
Environment=BABY_ORIGINS=https://spoonfloor.github.io
ExecStart=/usr/bin/npm run save-server
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

Then `systemctl enable --now baby-saves`. Back up `BABY_SAVES` like any other data.

## How it talks

The protocol is in `src/lib/saves/serverProtocol.ts`, shared with the app. Saves are versioned: a write says which version it expects to replace. If the server finds a different one, it refuses with 412, and the app asks whether to replace that save or save as a new one.
