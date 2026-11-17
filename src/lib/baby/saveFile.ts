import type { ModelSnapshot } from './model.ts';
import type { TransformerConfig } from './transformer.ts';

/**
 * A model as one self-contained file (`.baby`), so it can be kept anywhere: this
 * device, a server, a download. Layout, all little-endian:
 *
 *   "BABY" · u32 format · u32 header length · header (UTF-8 JSON) · padding to 4 bytes
 *   · every document’s word ids (u32) · every parameter’s data, m, v (f32), in order
 *
 * The header says how long each document and parameter is, so the numbers after it
 * need no separators.
 */

const MAGIC = 'BABY';
/** Bump when the layout or header changes, so older files are refused rather than misread. */
const FORMAT = 1;
/** Magic, format, header length. */
const PREAMBLE_BYTES = 12;

interface Header {
	config: TransformerConfig;
	vocabularySize: number;
	steps: number;
	words: string[];
	sources: string[];
	documentLengths: number[];
	paramLengths: number[];
}

/** A file that isn’t a model this app can load: another file type, a newer format, or damaged. */
export class SaveFileError extends Error {
	override name = 'SaveFileError';
}

// Typed arrays use the machine’s byte order; every browser and Node machine in use is little-endian.
const littleEndian = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1;

export function encodeSave(snapshot: ModelSnapshot): Uint8Array<ArrayBuffer> {
	if (!littleEndian) throw new SaveFileError('Saving needs a little-endian machine');
	const { transformer } = snapshot;
	const header: Header = {
		config: transformer.config,
		vocabularySize: transformer.vocabularySize,
		steps: transformer.steps,
		words: snapshot.words,
		sources: snapshot.sources,
		documentLengths: snapshot.documents.map((document) => document.length),
		paramLengths: transformer.params.map(({ data }) => data.length)
	};
	const headerBytes = new TextEncoder().encode(JSON.stringify(header));
	const numbersStart = align4(PREAMBLE_BYTES + headerBytes.length);
	const tokenCount = sum(header.documentLengths);
	const floatCount = 3 * sum(header.paramLengths);

	const buffer = new ArrayBuffer(numbersStart + 4 * (tokenCount + floatCount));
	const bytes = new Uint8Array(buffer);
	bytes.set(new TextEncoder().encode(MAGIC), 0);
	const view = new DataView(buffer);
	view.setUint32(4, FORMAT, true);
	view.setUint32(8, headerBytes.length, true);
	bytes.set(headerBytes, PREAMBLE_BYTES);

	const tokens = new Uint32Array(buffer, numbersStart, tokenCount);
	let at = 0;
	for (const document of snapshot.documents) {
		tokens.set(document, at);
		at += document.length;
	}
	const floats = new Float32Array(buffer, numbersStart + 4 * tokenCount, floatCount);
	at = 0;
	for (const { data, m, v } of transformer.params) {
		for (const values of [data, m, v]) {
			floats.set(values, at);
			at += values.length;
		}
	}
	return bytes;
}

/** The model in `bytes`; throws a `SaveFileError` if it isn’t one this app can load. */
export function decodeSave(bytes: Uint8Array): ModelSnapshot {
	if (!littleEndian) throw new SaveFileError('Loading needs a little-endian machine');
	if (bytes.length < PREAMBLE_BYTES) throw new SaveFileError('Not a saved model');
	if (new TextDecoder().decode(bytes.subarray(0, 4)) !== MAGIC) {
		throw new SaveFileError('Not a saved model');
	}
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	const format = view.getUint32(4, true);
	if (format !== FORMAT) throw new SaveFileError(`Saved in format ${format}, not ${FORMAT}`);
	const headerLength = view.getUint32(8, true);

	let header: Header;
	try {
		header = JSON.parse(
			new TextDecoder().decode(bytes.subarray(PREAMBLE_BYTES, PREAMBLE_BYTES + headerLength))
		) as Header;
	} catch {
		throw new SaveFileError('The saved model is damaged');
	}
	const numbersStart = align4(PREAMBLE_BYTES + headerLength);
	const tokenCount = sum(header.documentLengths);
	const floatCount = 3 * sum(header.paramLengths);
	if (bytes.length !== numbersStart + 4 * (tokenCount + floatCount)) {
		throw new SaveFileError('The saved model is damaged');
	}

	// Copied out, so the snapshot owns aligned arrays whatever `bytes` sits in.
	const numbers = bytes.slice(numbersStart).buffer;
	const tokens = new Uint32Array(numbers, 0, tokenCount);
	const floats = new Float32Array(numbers, 4 * tokenCount, floatCount);

	let at = 0;
	const documents = header.documentLengths.map((length) => {
		const document = Array.from(tokens.subarray(at, at + length));
		at += length;
		return document;
	});
	at = 0;
	const take = (length: number) => {
		const values = floats.subarray(at, at + length);
		at += length;
		return values;
	};
	const params = header.paramLengths.map((length) => ({
		data: take(length),
		m: take(length),
		v: take(length)
	}));

	return {
		words: header.words,
		documents,
		sources: header.sources,
		transformer: {
			config: header.config,
			vocabularySize: header.vocabularySize,
			steps: header.steps,
			params
		}
	};
}

function align4(offset: number): number {
	return Math.ceil(offset / 4) * 4;
}

function sum(values: readonly number[]): number {
	return values.reduce((total, value) => total + value, 0);
}
