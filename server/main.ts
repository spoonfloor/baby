import { createSaveServer } from './save-server.ts';

/** Starts a save server configured from the environment (see server/README.md). */

const token = process.env.BABY_TOKEN;
if (!token) {
	console.error('Set BABY_TOKEN to a long random secret, e.g. `openssl rand -hex 32`.');
	process.exit(1);
}
const port = Number(process.env.PORT ?? 8787);
const folder = process.env.BABY_SAVES ?? 'saves';
const origins = (process.env.BABY_ORIGINS ?? '*').split(',').map((origin) => origin.trim());

createSaveServer({ folder, token, origins }).listen(port, () => {
	console.log(`Save server on port ${port}, keeping saves in ${folder}`);
});
