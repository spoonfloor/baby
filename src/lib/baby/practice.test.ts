import { describe, expect, it } from 'vitest';
import { Plateau, sampleBatch } from './practice.ts';
import { seededRandom } from './random.ts';

describe('sampleBatch', () => {
	it('reads short documents whole, from their first word, never across two', () => {
		const documents = [
			[10, 11, 12],
			[20, 21, 22, 23]
		];
		const windows = sampleBatch(documents, 16, seededRandom(1));

		expect(windows.reduce((sum, { targets }) => sum + targets.length, 0)).toBeGreaterThanOrEqual(
			16
		);
		for (const window of windows) {
			expect([
				{ inputs: [10, 11], targets: [11, 12] },
				{ inputs: [20, 21, 22], targets: [21, 22, 23] }
			]).toContainEqual(window);
		}
	});

	it('takes a context-long stretch of a longer document', () => {
		const document = Array.from({ length: 50 }, (_, i) => i);
		const [window] = sampleBatch([document], 8, seededRandom(2));

		expect(window?.inputs).toHaveLength(8);
		expect(window?.targets).toEqual(window?.inputs.map((id) => id + 1));
	});

	it('refuses when there is nothing to practice on', () => {
		expect(() => sampleBatch([[1]], 8, seededRandom(1))).toThrow();
	});
});

describe('Plateau', () => {
	const run = (lossAt: (step: number) => number) => {
		const plateau = new Plateau();
		while (!plateau.reached) plateau.add(lossAt(plateau.steps));
		return plateau;
	};

	it('stops soon once the loss is flat', () => {
		expect(run(() => 1).steps).toBeLessThanOrEqual(250);
	});

	it('keeps going while the loss keeps falling, and stops after it levels off', () => {
		const plateau = run((step) => Math.max(0.5, 3 - step / 200));

		expect(plateau.steps).toBeGreaterThan(500);
		expect(plateau.steps).toBeLessThan(800);
		expect(plateau.latest).toBeCloseTo(0.5);
	});

	it('always ends, even if the loss falls forever', () => {
		expect(run((step) => 1 / (step + 1)).steps).toBeLessThanOrEqual(5000);
	});
});
