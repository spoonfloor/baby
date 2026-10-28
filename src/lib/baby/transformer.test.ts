import { describe, expect, it } from 'vitest';
import { seededRandom } from './random.ts';
import { Transformer, type TransformerConfig } from './transformer.ts';

const TINY: TransformerConfig = { dim: 8, layers: 2, heads: 2, hidden: 16, context: 8 };

/** A tiny transformer with weights large enough that every path carries signal. */
function tinyTransformer(vocabularySize = 6) {
	const random = seededRandom(7);
	const transformer = new Transformer(TINY, vocabularySize, random);
	for (const param of transformer.params) {
		for (let i = 0; i < param.data.length; i++) param.data[i] = random() - 0.5;
	}
	return transformer;
}

describe('Transformer', () => {
	it('computes gradients that match nudging each number and measuring the loss', () => {
		const transformer = tinyTransformer();
		const inputs = [2, 3, 4, 2, 5];
		const targets = [3, 4, 2, 5, 1];

		for (const param of transformer.params) param.grad.fill(0);
		transformer.lossAndGradients([{ inputs, targets }]);
		const lossAt = () => {
			const saved = transformer.params.map((param) => param.grad.slice());
			const loss = transformer.lossAndGradients([{ inputs, targets }]);
			transformer.params.forEach((param, i) => param.grad.set(saved[i] ?? []));
			return loss;
		};

		// Float32 math: a small nudge, and a tolerance for rounding. Where the nudge
		// crosses a ReLU’s corner the loss has no single slope (the slopes on either
		// side disagree), so those numbers are skipped.
		const nudge = 1e-3;
		const tolerance = 1e-3;
		const base = lossAt();
		let checked = 0;
		for (const param of transformer.params) {
			for (let i = 0; i < param.data.length; i++) {
				const original = param.data[i] ?? 0;
				param.data[i] = original + nudge;
				const above = lossAt();
				param.data[i] = original - nudge;
				const below = lossAt();
				param.data[i] = original;

				const rightSlope = (above - base) / nudge;
				const leftSlope = (base - below) / nudge;
				if (Math.abs(rightSlope - leftSlope) > 2 * tolerance) continue;
				expect(Math.abs((param.grad[i] ?? 0) - (above - below) / (2 * nudge))).toBeLessThan(
					tolerance
				);
				checked++;
			}
		}
		const total = transformer.params.reduce((sum, param) => sum + param.data.length, 0);
		expect(checked).toBeGreaterThan(total * 0.9);
	});

	it('predicts a probability for every word, summing to 1', () => {
		const probabilities = tinyTransformer().predict([2, 3]);

		expect(probabilities).toHaveLength(6);
		expect(probabilities.reduce((sum, p) => sum + p, 0)).toBeCloseTo(1, 5);
	});

	it('learns to recite a short sequence', () => {
		const transformer = new Transformer(TINY, 6, seededRandom(3));
		const sequence = [2, 3, 4, 5, 1];
		const inputs = sequence.slice(0, -1);
		const targets = sequence.slice(1);

		const first = transformer.train([{ inputs, targets }]);
		let loss = first;
		for (let step = 0; step < 300; step++) loss = transformer.train([{ inputs, targets }]);

		expect(loss).toBeLessThan(first / 10);
		const next = transformer.predict([2, 3]);
		expect(next.indexOf(Math.max(...next))).toBe(4);
	});

	it('keeps what it learned when new words are added', () => {
		const transformer = new Transformer(TINY, 6, seededRandom(3));
		for (let step = 0; step < 300; step++)
			transformer.train([{ inputs: [2, 3, 4], targets: [3, 4, 5] }]);
		const before = transformer.predict([2, 3]);

		transformer.growVocabulary(9);
		const after = transformer.predict([2, 3]);

		expect(after).toHaveLength(9);
		expect(after.indexOf(Math.max(...after))).toBe(before.indexOf(Math.max(...before)));
	});
});
