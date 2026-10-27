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
	}
);
