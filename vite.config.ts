import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [sveltekit({ adapter: adapter(), paths: { base: base(process.env.BASE_PATH) } })],
	test: {
		include: ['src/**/*.test.ts']
	}
});

/**
 * Where the site is served from: GitHub Pages serves it under `/baby` (see
 * .github/workflows/pages.yml); the dev server and local builds, at the root.
 */
function base(path = ''): '' | `/${string}` {
	if (path === '' || (path.startsWith('/') && !path.endsWith('/')))
		return path as '' | `/${string}`;
	throw new Error(`BASE_PATH must be empty or start with / and not end with one, not “${path}”`);
}
