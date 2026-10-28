import {
	adam,
	add,
	causalAttention,
	causalAttentionBackward,
	crossEntropy,
	embed,
	embedBackward,
	matmul,
	matmulBackward,
	relu,
	reluBackward,
	rmsNorm,
	rmsNormBackward,
	scoreRows,
	scoreRowsBackward,
	softmax,
	sumOfSquares
} from './math.ts';
import type { Window } from './practice.ts';

/**
 * Baby's brain: a tiny decoder-only transformer, the same shape as the big ones.
 * Each word becomes coordinates (embedding) plus where it sits (position). Every
 * layer then lets each position look back at earlier ones (attention: query, key,
 * value) and think on its own (feed-forward), each added onto a running total
 * (residual). Finally every known word is scored as the next one (unembedding).
 *
 * It runs on the CPU in plain JavaScript; a WebGPU version will sit behind the same
 * methods and be checked against this one.
 */

export interface TransformerConfig {
	/** Numbers per word position (the width of everything). */
	dim: number;
	layers: number;
	/** Attention heads per layer; each sees dim / heads of the numbers. */
	heads: number;
	/** Width of the feed-forward step’s middle. */
	hidden: number;
	/** Most words Baby can see at once. */
	context: number;
}

/** Baby’s one fixed size (see the README’s core model decisions). */
export const BABY_CONFIG: TransformerConfig = {
	dim: 64,
	layers: 2,
	heads: 2,
	hidden: 256,
	context: 128
};

export function sameConfig(a: TransformerConfig, b: TransformerConfig): boolean {
	return (Object.keys(a) as (keyof TransformerConfig)[]).every((key) => a[key] === b[key]);
}

export interface OptimizerConfig {
	learningRate: number;
	/** Caps the overall size of each step’s gradient, so one odd window can’t wreck Baby. */
	maxGradientNorm: number;
}

const OPTIMIZER: OptimizerConfig = { learningRate: 3e-3, maxGradientNorm: 1 };
const ADAM_BETA1 = 0.9;
const ADAM_BETA2 = 0.99;
const ADAM_EPSILON = 1e-8;
/** Spread of the starting noise in every weight matrix. */
const INIT_SCALE = 0.02;

/** One set of learned numbers, with what training keeps alongside it. */
export class Param {
	data: Float32Array;
	/** How the loss changes as each number changes, accumulated by `backward`. */
	grad: Float32Array;
	/** Adam’s running averages of the gradient and its square. */
	m: Float32Array;
	v: Float32Array;

	constructor(size: number, init: () => number) {
		this.data = Float32Array.from({ length: size }, init);
		this.grad = new Float32Array(size);
		this.m = new Float32Array(size);
		this.v = new Float32Array(size);
	}

	/** Extends to `size` numbers, filling the new ones with `init` and keeping the rest. */
	grow(size: number, init: () => number) {
		const extend = (old: Float32Array, fill: () => number) => {
			const next = new Float32Array(size);
			next.set(old);
			for (let i = old.length; i < size; i++) next[i] = fill();
			return next;
		};
		this.data = extend(this.data, init);
		this.grad = extend(this.grad, () => 0);
		this.m = extend(this.m, () => 0);
		this.v = extend(this.v, () => 0);
	}
}

/** Everything a transformer has learned, as plain data to store and restore. */
export interface TransformerSnapshot {
	config: TransformerConfig;
	vocabularySize: number;
	/** Training steps taken so far, which Adam’s corrections depend on. */
	steps: number;
	/** Each of `params`, in order, with Adam’s running averages. */
	params: { data: Float32Array; m: Float32Array; v: Float32Array }[];
}

interface Layer {
	attentionNorm: Param;
	query: Param;
	key: Param;
	value: Param;
	attentionOut: Param;
	feedForwardNorm: Param;
	up: Param;
	upBias: Param;
	down: Param;
	downBias: Param;
}

/** Everything one layer computed, kept for the backward pass. */
interface LayerTrace {
	input: Float32Array;
	attentionNormed: Float32Array;
	attentionRms: Float32Array;
	q: Float32Array;
	k: Float32Array;
	v: Float32Array;
	weights: Float32Array;
	mixed: Float32Array;
	middle: Float32Array;
	feedForwardNormed: Float32Array;
	feedForwardRms: Float32Array;
	upOut: Float32Array;
	activated: Float32Array;
}

interface Trace {
	ids: readonly number[];
	layers: LayerTrace[];
	final: Float32Array;
	finalNormed: Float32Array;
	finalRms: Float32Array;
	scores: Float32Array;
}

export class Transformer {
	readonly config: TransformerConfig;
	#vocabularySize: number;
	#random: () => number;
	#steps = 0;

	readonly wordEmbedding: Param;
	readonly positionEmbedding: Param;
	readonly layers: Layer[];
	readonly finalNorm: Param;
	readonly unembedding: Param;

	constructor(config: TransformerConfig, vocabularySize: number, random: () => number) {
		const { dim, layers, hidden, context } = config;
		if (dim % config.heads !== 0) throw new RangeError('dim must divide evenly into heads');
		this.config = config;
		this.#vocabularySize = vocabularySize;
		this.#random = random;

		const noise = () => this.#noise();
		const ones = () => 1;
		const zeros = () => 0;
		this.wordEmbedding = new Param(vocabularySize * dim, noise);
		this.positionEmbedding = new Param(context * dim, noise);
		this.layers = Array.from({ length: layers }, () => ({
			attentionNorm: new Param(dim, ones),
			query: new Param(dim * dim, noise),
			key: new Param(dim * dim, noise),
			value: new Param(dim * dim, noise),
			attentionOut: new Param(dim * dim, noise),
			feedForwardNorm: new Param(dim, ones),
			up: new Param(dim * hidden, noise),
			upBias: new Param(hidden, zeros),
			down: new Param(hidden * dim, noise),
			downBias: new Param(dim, zeros)
		}));
		this.finalNorm = new Param(dim, ones);
		this.unembedding = new Param(vocabularySize * dim, noise);
	}

	/** A transformer that picks up exactly where `snapshot` left off. */
	static restore(snapshot: TransformerSnapshot, random: () => number): Transformer {
		const transformer = new Transformer(snapshot.config, snapshot.vocabularySize, random);
		const params = transformer.params;
		if (params.length !== snapshot.params.length) {
			throw new RangeError('Snapshot has the wrong number of parameters');
		}
		params.forEach((param, i) => {
			const saved = snapshot.params[i];
			if (saved?.data.length !== param.data.length) {
				throw new RangeError('Snapshot parameters have the wrong sizes');
			}
			param.data.set(saved.data);
			param.m.set(saved.m);
			param.v.set(saved.v);
		});
		transformer.#steps = snapshot.steps;
		return transformer;
	}

	/** A copy of everything learned so far; training on afterwards doesn’t change it. */
	snapshot(): TransformerSnapshot {
		return {
			config: { ...this.config },
			vocabularySize: this.#vocabularySize,
			steps: this.#steps,
			params: this.params.map(({ data, m, v }) => ({
				data: data.slice(),
				m: m.slice(),
				v: v.slice()
			}))
		};
	}

	get vocabularySize(): number {
		return this.#vocabularySize;
	}

	/** Every set of learned numbers. */
	get params(): Param[] {
		return [
			this.wordEmbedding,
			this.positionEmbedding,
			...this.layers.flatMap((layer) => Object.values(layer)),
			this.finalNorm,
			this.unembedding
		];
	}

	/** Makes room for newly read words: each gets fresh noise, like Baby’s first numbers. */
	growVocabulary(size: number) {
		if (size <= this.#vocabularySize) return;
		const noise = () => this.#noise();
		this.wordEmbedding.grow(size * this.config.dim, noise);
		this.unembedding.grow(size * this.config.dim, noise);
		this.#vocabularySize = size;
	}

	/** Probabilities for the word after `ids` (the last `context` of them). */
	predict(ids: readonly number[]): Float32Array {
		const window = ids.slice(-this.config.context);
		const { scores } = this.#forward(window);
		const last = scores.slice((window.length - 1) * this.#vocabularySize);
		softmax(last);
		return last;
	}

	/**
	 * Measures the average loss of predicting each target from the words before it,
	 * over every window, and accumulates every parameter’s gradient. Returns the loss.
	 */
	lossAndGradients(windows: readonly Window[]): number {
		const positions = windows.reduce((sum, { targets }) => sum + targets.length, 0);
		let loss = 0;
		for (const { inputs, targets } of windows) {
			if (inputs.length !== targets.length || inputs.length > this.config.context) {
				throw new RangeError('inputs and targets must match and fit in the context');
			}
			loss += this.#backward(this.#forward(inputs), targets, 1 / positions);
		}
		return loss / positions;
	}

	/** One training step on a batch: learn from it, then nudge every number. Returns the loss. */
	train(windows: readonly Window[]): number {
		for (const param of this.params) param.grad.fill(0);
		const loss = this.lossAndGradients(windows);
		this.#update(OPTIMIZER);
		return loss;
	}

	#noise(): number {
		// Box–Muller: two uniform picks make one normally distributed one.
		const u = 1 - this.#random();
		const v = this.#random();
		return INIT_SCALE * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
	}

	#forward(ids: readonly number[]): Trace {
		const { dim, heads, hidden } = this.config;
		const n = ids.length;
		const vocabulary = this.#vocabularySize;

		let x = new Float32Array(n * dim);
		embed(x, ids, this.wordEmbedding.data, this.positionEmbedding.data, dim);

		const layers = this.layers.map((layer) => {
			const input = x;
			const attentionNormed = new Float32Array(n * dim);
			const attentionRms = new Float32Array(n);
			rmsNorm(attentionNormed, attentionRms, input, layer.attentionNorm.data, n, dim);

			const q = new Float32Array(n * dim);
			const k = new Float32Array(n * dim);
			const v = new Float32Array(n * dim);
			matmul(q, attentionNormed, layer.query.data, n, dim, dim);
			matmul(k, attentionNormed, layer.key.data, n, dim, dim);
			matmul(v, attentionNormed, layer.value.data, n, dim, dim);

			const weights = new Float32Array(heads * n * n);
			const mixed = new Float32Array(n * dim);
			causalAttention(mixed, weights, q, k, v, n, dim, heads);

			const middle = new Float32Array(n * dim);
			matmul(middle, mixed, layer.attentionOut.data, n, dim, dim);
			add(middle, middle, input);

			const feedForwardNormed = new Float32Array(n * dim);
			const feedForwardRms = new Float32Array(n);
			rmsNorm(feedForwardNormed, feedForwardRms, middle, layer.feedForwardNorm.data, n, dim);

			const upOut = new Float32Array(n * hidden);
			matmul(upOut, feedForwardNormed, layer.up.data, n, dim, hidden, layer.upBias.data);
			const activated = new Float32Array(n * hidden);
			relu(activated, upOut);

			x = new Float32Array(n * dim);
			matmul(x, activated, layer.down.data, n, hidden, dim, layer.downBias.data);
			add(x, x, middle);

			return {
				input,
				attentionNormed,
				attentionRms,
				q,
				k,
				v,
				weights,
				mixed,
				middle,
				feedForwardNormed,
				feedForwardRms,
				upOut,
				activated
			};
		});

		const finalNormed = new Float32Array(n * dim);
		const finalRms = new Float32Array(n);
		rmsNorm(finalNormed, finalRms, x, this.finalNorm.data, n, dim);
		const scores = new Float32Array(n * vocabulary);
		scoreRows(scores, finalNormed, this.unembedding.data, n, dim, vocabulary);

		return { ids, layers, final: x, finalNormed, finalRms, scores };
	}

	/** Returns the summed loss; gradients are of that sum times `scale`. */
	#backward(trace: Trace, targets: readonly number[], scale: number): number {
		const { dim, heads, hidden } = this.config;
		const n = trace.ids.length;
		const vocabulary = this.#vocabularySize;

		const dScores = new Float32Array(n * vocabulary);
		const loss = crossEntropy(trace.scores, targets, vocabulary, scale, dScores);

		const dFinalNormed = new Float32Array(n * dim);
		scoreRowsBackward(
			dScores,
			trace.finalNormed,
			this.unembedding.data,
			n,
			dim,
			vocabulary,
			dFinalNormed,
			this.unembedding.grad
		);
		// The gradient flowing back along the residual stream.
		let dx = new Float32Array(n * dim);
		rmsNormBackward(
			dFinalNormed,
			trace.final,
			trace.finalRms,
			this.finalNorm.data,
			n,
			dim,
			dx,
			this.finalNorm.grad
		);

		for (let l = this.layers.length - 1; l >= 0; l--) {
			const layer = this.layers[l];
			const t = trace.layers[l];
			if (!layer || !t) throw new Error('trace does not match layers');

			// Feed-forward: x = middle + down(relu(up(norm(middle)))).
			const dMiddle = dx.slice();
			const dActivated = new Float32Array(n * hidden);
			matmulBackward(
				dx,
				t.activated,
				layer.down.data,
				n,
				hidden,
				dim,
				dActivated,
				layer.down.grad,
				layer.downBias.grad
			);
			const dUpOut = new Float32Array(n * hidden);
			reluBackward(dActivated, t.upOut, dUpOut);
			const dFeedForwardNormed = new Float32Array(n * dim);
			matmulBackward(
				dUpOut,
				t.feedForwardNormed,
				layer.up.data,
				n,
				dim,
				hidden,
				dFeedForwardNormed,
				layer.up.grad,
				layer.upBias.grad
			);
			rmsNormBackward(
				dFeedForwardNormed,
				t.middle,
				t.feedForwardRms,
				layer.feedForwardNorm.data,
				n,
				dim,
				dMiddle,
				layer.feedForwardNorm.grad
			);

			// Attention: middle = input + out(attention(q, k, v of norm(input))).
			const dInput = dMiddle.slice();
			const dMixed = new Float32Array(n * dim);
			matmulBackward(
				dMiddle,
				t.mixed,
				layer.attentionOut.data,
				n,
				dim,
				dim,
				dMixed,
				layer.attentionOut.grad
			);
			const dq = new Float32Array(n * dim);
			const dk = new Float32Array(n * dim);
			const dv = new Float32Array(n * dim);
			causalAttentionBackward(dMixed, t.weights, t.q, t.k, t.v, n, dim, heads, dq, dk, dv);
			const dAttentionNormed = new Float32Array(n * dim);
			for (const [d, param] of [
				[dq, layer.query],
				[dk, layer.key],
				[dv, layer.value]
			] as const) {
				matmulBackward(d, t.attentionNormed, param.data, n, dim, dim, dAttentionNormed, param.grad);
			}
			rmsNormBackward(
				dAttentionNormed,
				t.input,
				t.attentionRms,
				layer.attentionNorm.data,
				n,
				dim,
				dInput,
				layer.attentionNorm.grad
			);
			dx = dInput;
		}

		embedBackward(dx, trace.ids, dim, this.wordEmbedding.grad, this.positionEmbedding.grad);
		return loss;
	}

	/** Adam, with the whole gradient first scaled down to at most `maxGradientNorm`. */
	#update({ learningRate, maxGradientNorm }: OptimizerConfig) {
		const params = this.params;
		const norm = Math.sqrt(sumOfSquares(params.map(({ grad }) => grad)));
		this.#steps++;
		const step = {
			learningRate,
			beta1: ADAM_BETA1,
			beta2: ADAM_BETA2,
			epsilon: ADAM_EPSILON,
			gradientScale: Math.min(1, maxGradientNorm / (norm + ADAM_EPSILON)),
			correction1: 1 - ADAM_BETA1 ** this.#steps,
			correction2: 1 - ADAM_BETA2 ** this.#steps
		};
		for (const { data, grad, m, v } of params) adam(data, grad, m, v, step);
	}
}
