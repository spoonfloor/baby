import { describe, expect, it } from 'vitest';
import { Plateau, practiceBudget, sampleBatch } from './practice.ts';
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

describe('practiceBudget', () => {
	it('grows with the reading, in whole blocks of steps', () => {
		expect(practiceBudget(256)).toBe(800);
		expect(practiceBudget(189)).toBe(600);
	});

	it('leaves a short reading enough steps to notice a stall, and caps a long one', () => {
		expect(practiceBudget(6)).toBe(200);
		expect(practiceBudget(100_000)).toBe(5000);
	});
});

describe('Plateau', () => {
	const run = (lossAt: (step: number) => number, budget = 5000) => {
		const plateau = new Plateau(budget);
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

	it('ends at its budget, even if the loss falls forever', () => {
		expect(run((step) => 1 / (step + 1), 300).steps).toBe(300);
	});
});
