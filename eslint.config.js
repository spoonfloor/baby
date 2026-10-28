import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import { defineConfig } from 'eslint/config';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
import ts from 'typescript-eslint';

export default defineConfig(
	{ ignores: ['build/', '.svelte-kit/'] },
	js.configs.recommended,
	ts.configs.strict,
	svelte.configs.recommended,
	prettier,
	svelte.configs.prettier,
	{ languageOptions: { globals: { ...globals.browser, ...globals.node } } },
	{
		files: ['**/*.svelte', '**/*.svelte.ts'],
		languageOptions: { parserOptions: { parser: ts.parser } }
	},
	{
		rules: {
			// Inline styles would bypass the token rules enforced by Stylelint.
			'svelte/no-inline-styles': 'error'
		}
	},
	{
		// User-facing copy uses curly quotes and apostrophes (’ “ ”), never straight ones.
		files: ['src/**'],
		rules: {
			'no-restricted-syntax': [
				'error',
				...[
					'Literal[value=/[\'"]/]',
					'TemplateElement[value.raw=/[\'"]/]',
					'SvelteText[value=/[\'"]/]:not(SvelteStyleElement > SvelteText)',
					'SvelteLiteral[value=/[\'"]/]'
				].map((selector) => ({
					selector,
					message: 'Use curly quotes (’ “ ”) in text, not straight ones.'
				}))
			]
		}
	}
);
