import { describe, expect, it } from 'vitest';
import { Model } from './model.ts';
import { seededRandom } from './random.ts';
import { decodeSave, encodeSave, SaveFileError } from './saveFile.ts';
import type { TransformerConfig } from './transformer.ts';
import { tokenize } from './vocabulary.ts';

const SMALL: TransformerConfig = { dim: 16, layers: 2, heads: 2, hidden: 32, context: 16 };

async function trained() {
	const model = new Model({ random: seededRandom(1), idle: async () => {}, config: SMALL });
	const documents = [tokenize('the cow jumped over the moon'), tokenize('the dish ran away')];
	for await (const event of model.read({ source: 'rhyme', title: 'Rhyme', documents })) void event;
	return model;
}

describe('save file', () => {
	it('round-trips a model exactly', async () => {
		const snapshot = (await trained()).snapshot();
		const decoded = decodeSave(encodeSave(snapshot));

		expect(decoded.words).toEqual(snapshot.words);
		expect(decoded.sources).toEqual(snapshot.sources);
		expect(decoded.documents).toEqual(snapshot.documents);
		expect(decoded.transformer.config).toEqual(snapshot.transformer.config);
		expect(decoded.transformer.steps).toBe(snapshot.transformer.steps);
		expect(decoded.transformer.params).toEqual(snapshot.transformer.params);
	});

	it('restores a model that replies just like the original', async () => {
		const model = await trained();
		const restored = new Model({
			random: seededRandom(1),
			idle: async () => {},
			config: SMALL,
			snapshot: decodeSave(encodeSave(model.snapshot()))
		});
		expect(restored.state).toEqual(model.state);
		expect(restored.snapshot().transformer.params).toEqual(model.snapshot().transformer.params);
	});

	it('reads a file that sits partway into a larger buffer', async () => {
		const bytes = encodeSave((await trained()).snapshot());
		const padded = new Uint8Array(bytes.length + 3);
		padded.set(bytes, 3);
		expect(decodeSave(padded.subarray(3)).words).toEqual(decodeSave(bytes).words);
	});

	it('refuses other files, other formats, and damaged ones', async () => {
		const bytes = encodeSave((await trained()).snapshot());
		expect(() => decodeSave(new TextEncoder().encode('hello there, not a model'))).toThrow(
			SaveFileError
		);

		const otherFormat = bytes.slice();
		new DataView(otherFormat.buffer).setUint32(4, 99, true);
		expect(() => decodeSave(otherFormat)).toThrow(SaveFileError);

		expect(() => decodeSave(bytes.subarray(0, bytes.length - 4))).toThrow(SaveFileError);
	});
});
