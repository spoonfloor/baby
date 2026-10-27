/**
 * Stylelint enforces two project rules mechanically:
 *
 * 1. Sameness: raw values (hex colors, px, ms…) live only in tokens.css, and
 *    primitives (`--raw-*`) are never used outside it. Everything else
 *    references semantic tokens.
 * 2. No motion unless agreed: transitions and animations are banned except in
 *    files on APPROVED_ANIMATIONS.
 */

/** Files allowed to animate. Add one only after the animation has been agreed on. */
const APPROVED_ANIMATIONS = ['src/lib/ui/Spinner.svelte'];

const rawValueRules = {
	'color-no-hex': true,
	'color-named': 'never',
	'function-disallowed-list': [
		'rgb',
		'rgba',
		'hsl',
		'hsla',
		'hwb',
		'lab',
		'lch',
		'oklab',
		'oklch',
		'color'
	],
	'unit-disallowed-list': ['px', 'rem', 'em', 'pt', 'ms', 's'],
	'declaration-property-value-disallowed-list': { '/.*/': ['/--raw-/'] }
};

const motionRules = {
	'property-disallowed-list': ['/^transition/', '/^animation/', 'scroll-behavior'],
	'at-rule-disallowed-list': ['keyframes']
};

/** @param {Record<string, unknown>} rules */
const off = (rules) => Object.fromEntries(Object.keys(rules).map((name) => [name, null]));

export default {
	extends: ['stylelint-config-standard', 'stylelint-config-html/svelte'],
	rules: {
		...rawValueRules,
		...motionRules,
		'selector-pseudo-class-no-unknown': [true, { ignorePseudoClasses: ['global'] }]
	},
	overrides: [
		{ files: ['src/lib/styles/tokens.css'], rules: off(rawValueRules) },
		{ files: APPROVED_ANIMATIONS, rules: off(motionRules) }
	]
};
