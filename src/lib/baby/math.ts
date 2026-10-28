/**
 * The arithmetic inside Baby: plain loops over Float32Arrays, each forward kernel
 * paired with its backward (how much each input moved the result), which is what
 * training needs. Matrices are row-major: row `r` of an `rows × cols` matrix starts
 * at `r * cols`.
 *
 * Every index here is derived from the shapes passed in, so `!` on typed-array reads
 * is safe (and free, unlike `?? 0`, which would also hide a shape bug). This is the
 * only file allowed to use it; see eslint.config.js.
 */

/** Keeps RMS normalization finite when a row is all zeros. */
const NORM_EPSILON = 1e-5;

/** out (n × outDim) = x (n × inDim) · w (inDim × outDim) + bias. */
export function matmul(
	out: Float32Array,
	x: Float32Array,
	w: Float32Array,
	n: number,
	inDim: number,
	outDim: number,
	bias?: Float32Array
) {
	for (let t = 0; t < n; t++) {
		const row = t * outDim;
		for (let o = 0; o < outDim; o++) out[row + o] = bias ? bias[o]! : 0;
		for (let i = 0; i < inDim; i++) {
			const xi = x[t * inDim + i]!;
			const wRow = i * outDim;
			for (let o = 0; o < outDim; o++) out[row + o]! += xi * w[wRow + o]!;
		}
	}
}

/** Backward of `matmul`: accumulates into dx, dw and dBias. */
export function matmulBackward(
	dOut: Float32Array,
	x: Float32Array,
	w: Float32Array,
	n: number,
	inDim: number,
	outDim: number,
	dx: Float32Array,
	dw: Float32Array,
	dBias?: Float32Array
) {
	for (let t = 0; t < n; t++) {
		const row = t * outDim;
		for (let i = 0; i < inDim; i++) {
			const xi = x[t * inDim + i]!;
			const wRow = i * outDim;
			let sum = 0;
			for (let o = 0; o < outDim; o++) {
				const d = dOut[row + o]!;
				sum += d * w[wRow + o]!;
				dw[wRow + o]! += xi * d;
			}
			dx[t * inDim + i]! += sum;
		}
		if (dBias) for (let o = 0; o < outDim; o++) dBias[o]! += dOut[row + o]!;
	}
}

/**
 * out (n × rows) = x (n × dim) · tableᵀ, scoring each position against every row of
 * `table` (rows × dim). Used to turn Baby's final numbers into a score per word.
 */
export function scoreRows(
	out: Float32Array,
	x: Float32Array,
	table: Float32Array,
	n: number,
	dim: number,
	rows: number
) {
	for (let t = 0; t < n; t++) {
		for (let r = 0; r < rows; r++) {
			let sum = 0;
			for (let i = 0; i < dim; i++) sum += x[t * dim + i]! * table[r * dim + i]!;
			out[t * rows + r] = sum;
		}
	}
}

/** Backward of `scoreRows`: accumulates into dx and dTable. */
export function scoreRowsBackward(
	dOut: Float32Array,
	x: Float32Array,
	table: Float32Array,
	n: number,
	dim: number,
	rows: number,
	dx: Float32Array,
	dTable: Float32Array
) {
	for (let t = 0; t < n; t++) {
		for (let r = 0; r < rows; r++) {
			const d = dOut[t * rows + r]!;
			if (d === 0) continue;
			for (let i = 0; i < dim; i++) {
				dx[t * dim + i]! += d * table[r * dim + i]!;
				dTable[r * dim + i]! += d * x[t * dim + i]!;
			}
		}
	}
}

/** out (n × dim): each position's word embedding plus its position embedding. */
export function embed(
	out: Float32Array,
	ids: readonly number[],
	words: Float32Array,
	positions: Float32Array,
	dim: number
) {
	ids.forEach((id, t) => {
		for (let i = 0; i < dim; i++) out[t * dim + i] = words[id * dim + i]! + positions[t * dim + i]!;
	});
}

/** Backward of `embed`: accumulates into the rows that were looked up. */
export function embedBackward(
	dOut: Float32Array,
	ids: readonly number[],
	dim: number,
	dWords: Float32Array,
	dPositions: Float32Array
) {
	ids.forEach((id, t) => {
		for (let i = 0; i < dim; i++) {
			const d = dOut[t * dim + i]!;
			dWords[id * dim + i]! += d;
			dPositions[t * dim + i]! += d;
		}
	});
}

/**
 * RMS normalization: scales each row of x to unit root-mean-square, then by `gain`.
 * Writes each row's RMS to `rms`, which the backward pass needs.
 */
export function rmsNorm(
	out: Float32Array,
	rms: Float32Array,
	x: Float32Array,
	gain: Float32Array,
	n: number,
	dim: number
) {
	for (let t = 0; t < n; t++) {
		let squares = 0;
		for (let i = 0; i < dim; i++) squares += x[t * dim + i]! ** 2;
		const r = Math.sqrt(squares / dim + NORM_EPSILON);
		rms[t] = r;
		for (let i = 0; i < dim; i++) out[t * dim + i] = (gain[i]! * x[t * dim + i]!) / r;
	}
}

/** Backward of `rmsNorm`: accumulates into dx and dGain. */
export function rmsNormBackward(
	dOut: Float32Array,
	x: Float32Array,
	rms: Float32Array,
	gain: Float32Array,
	n: number,
	dim: number,
	dx: Float32Array,
	dGain: Float32Array
) {
	for (let t = 0; t < n; t++) {
		const r = rms[t]!;
		let dot = 0;
		for (let i = 0; i < dim; i++) {
			const normalized = x[t * dim + i]! / r;
			const d = dOut[t * dim + i]!;
			dGain[i]! += d * normalized;
			dot += d * gain[i]! * normalized;
		}
		for (let i = 0; i < dim; i++) {
			const normalized = x[t * dim + i]! / r;
			dx[t * dim + i]! += (dOut[t * dim + i]! * gain[i]! - (normalized * dot) / dim) / r;
		}
	}
}

/** out = max(0, x), elementwise. */
export function relu(out: Float32Array, x: Float32Array) {
	for (let i = 0; i < x.length; i++) out[i] = Math.max(0, x[i]!);
}

/** Backward of `relu`: accumulates into dx where x was positive. */
export function reluBackward(dOut: Float32Array, x: Float32Array, dx: Float32Array) {
	for (let i = 0; i < x.length; i++) if (x[i]! > 0) dx[i]! += dOut[i]!;
}

/**
 * Causal multi-head attention. q, k, v and out are n × dim, split into `heads`
 * slices of dim / heads columns. Each position asks (query) every earlier position
 * (key) how relevant it is, softmaxes those scores into weights, and takes the
 * weighted mix of their contents (value). Writes the weights to `weights`
 * (heads × n × n, zero above the diagonal), which the backward pass needs.
 */
export function causalAttention(
	out: Float32Array,
	weights: Float32Array,
	q: Float32Array,
	k: Float32Array,
	v: Float32Array,
	n: number,
	dim: number,
	heads: number
) {
	const headDim = dim / heads;
	const scale = 1 / Math.sqrt(headDim);
	weights.fill(0);
	out.fill(0);
	for (let h = 0; h < heads; h++) {
		const col = h * headDim;
		for (let i = 0; i < n; i++) {
			const row = (h * n + i) * n;
			let max = -Infinity;
			for (let j = 0; j <= i; j++) {
				let score = 0;
				for (let c = 0; c < headDim; c++) score += q[i * dim + col + c]! * k[j * dim + col + c]!;
				score *= scale;
				weights[row + j] = score;
				max = Math.max(max, score);
			}
			let total = 0;
			for (let j = 0; j <= i; j++) {
				const e = Math.exp(weights[row + j]! - max);
				weights[row + j] = e;
				total += e;
			}
			for (let j = 0; j <= i; j++) {
				const p = weights[row + j]! / total;
				weights[row + j] = p;
				for (let c = 0; c < headDim; c++) out[i * dim + col + c]! += p * v[j * dim + col + c]!;
			}
		}
	}
}

/** Backward of `causalAttention`: accumulates into dq, dk and dv. */
export function causalAttentionBackward(
	dOut: Float32Array,
	weights: Float32Array,
	q: Float32Array,
	k: Float32Array,
	v: Float32Array,
	n: number,
	dim: number,
	heads: number,
	dq: Float32Array,
	dk: Float32Array,
	dv: Float32Array
) {
	const headDim = dim / heads;
	const scale = 1 / Math.sqrt(headDim);
	const dWeights = new Float32Array(n);
	for (let h = 0; h < heads; h++) {
		const col = h * headDim;
		for (let i = 0; i < n; i++) {
			const row = (h * n + i) * n;
			let dot = 0;
			for (let j = 0; j <= i; j++) {
				const p = weights[row + j]!;
				let dp = 0;
				for (let c = 0; c < headDim; c++) {
					const d = dOut[i * dim + col + c]!;
					dp += d * v[j * dim + col + c]!;
					dv[j * dim + col + c]! += p * d;
				}
				dWeights[j] = dp;
				dot += p * dp;
			}
			for (let j = 0; j <= i; j++) {
				const dScore = weights[row + j]! * (dWeights[j]! - dot) * scale;
				for (let c = 0; c < headDim; c++) {
					dq[i * dim + col + c]! += dScore * k[j * dim + col + c]!;
					dk[j * dim + col + c]! += dScore * q[i * dim + col + c]!;
				}
			}
		}
	}
}

/** Turns one row of scores into probabilities that sum to 1, in place. */
export function softmax(scores: Float32Array) {
	let max = -Infinity;
	for (let i = 0; i < scores.length; i++) max = Math.max(max, scores[i]!);
	let total = 0;
	for (let i = 0; i < scores.length; i++) {
		const e = Math.exp(scores[i]! - max);
		scores[i] = e;
		total += e;
	}
	for (let i = 0; i < scores.length; i++) scores[i]! /= total;
}

/**
 * Next-word loss (cross-entropy: how surprised Baby was by each right answer, in
 * nats), summed over n positions of `rows`-wide scores. Writes its gradient with
 * respect to the scores, times `scale`, into dScores; a batch passes 1 / (positions
 * in the batch) so the gradient is of the batch’s average loss.
 */
export function crossEntropy(
	scores: Float32Array,
	targets: readonly number[],
	rows: number,
	scale: number,
	dScores: Float32Array
): number {
	let loss = 0;
	targets.forEach((target, t) => {
		const row = scores.subarray(t * rows, (t + 1) * rows);
		const probabilities = dScores.subarray(t * rows, (t + 1) * rows);
		probabilities.set(row);
		softmax(probabilities);
		loss -= Math.log(Math.max(probabilities[target]!, Number.MIN_VALUE));
		probabilities[target]! -= 1;
		for (let i = 0; i < rows; i++) probabilities[i]! *= scale;
	});
	return loss;
}

/** out = a + b, elementwise (the residual connection). */
export function add(out: Float32Array, a: Float32Array, b: Float32Array) {
	for (let i = 0; i < out.length; i++) out[i] = a[i]! + b[i]!;
}

/** The sum of squares of every number in `arrays`. */
export function sumOfSquares(arrays: readonly Float32Array[]): number {
	let sum = 0;
	for (const array of arrays) for (let i = 0; i < array.length; i++) sum += array[i]! ** 2;
	return sum;
}

export interface AdamStep {
	learningRate: number;
	beta1: number;
	beta2: number;
	epsilon: number;
	/** Multiplies every gradient first (gradient clipping). */
	gradientScale: number;
	/** 1 − beta ** step, undoing the running averages’ start at zero. */
	correction1: number;
	correction2: number;
}

/**
 * Adam: moves each number against its gradient, scaled by that gradient’s recent
 * history, updating the running averages m and v in place.
 */
export function adam(
	data: Float32Array,
	grad: Float32Array,
	m: Float32Array,
	v: Float32Array,
	step: AdamStep
) {
	const { learningRate, beta1, beta2, epsilon, gradientScale, correction1, correction2 } = step;
	for (let i = 0; i < data.length; i++) {
		const g = grad[i]! * gradientScale;
		const mi = beta1 * m[i]! + (1 - beta1) * g;
		const vi = beta2 * v[i]! + (1 - beta2) * g * g;
		m[i] = mi;
		v[i] = vi;
		data[i]! -= (learningRate * (mi / correction1)) / (Math.sqrt(vi / correction2) + epsilon);
	}
}
