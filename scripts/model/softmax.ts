// Multinomial logistic regression over sparse binary features, trained with FTRL-Proximal:
// per-coordinate learning rates with L1 and L2, so most weights end exactly at zero and the packed
// model stays small. Deterministic: examples are visited in a seeded order.
import { rng } from './rng';

export interface Example { cols: Int32Array; y: number; weight: number }
export interface Settings { alpha: number; beta: number; l1: number; l2: number; epochs: number; seed: number }
export interface Fitted { weights: Float32Array; epochs: number; validLoss: number }

export function scores(weights: Float32Array, cols: Int32Array, classes: number): Float64Array {
  const out = new Float64Array(classes);
  for (const col of cols) { const base = col * classes; for (let k = 0; k < classes; k++) out[k] += weights[base + k]; }
  return out;
}

export function softmax(values: Float64Array, temperature = 1): Float64Array {
  let max = -Infinity;
  for (const v of values) max = Math.max(max, v);
  const out = new Float64Array(values.length);
  let sum = 0;
  for (let k = 0; k < values.length; k++) { out[k] = Math.exp((values[k] - max) / temperature); sum += out[k]; }
  for (let k = 0; k < values.length; k++) out[k] /= sum;
  return out;
}

export function logLoss(weights: Float32Array, examples: readonly Example[], classes: number, temperature = 1): number {
  let total = 0, mass = 0;
  for (const ex of examples) { total -= ex.weight * Math.log(Math.max(1e-12, softmax(scores(weights, ex.cols, classes), temperature)[ex.y])); mass += ex.weight; }
  return total / Math.max(1e-9, mass);
}

export function train(examples: readonly Example[], dims: number, classes: number, settings: Settings, valid?: readonly Example[]): Fitted {
  const { alpha, beta, l1, l2, epochs, seed } = settings;
  const z = new Float64Array(dims * classes), n = new Float64Array(dims * classes);
  const weightOf = (i: number) => Math.abs(z[i]) <= l1 ? 0 : -(z[i] - Math.sign(z[i]) * l1) / ((beta + Math.sqrt(n[i])) / alpha + l2);
  // Current weights, kept in step with z and n so the forward pass is a plain sum.
  const w = new Float64Array(dims * classes);
  const snapshot = () => Float32Array.from(w);
  const random = rng(seed);
  const order = examples.map((_, i) => i);
  let best: Fitted = { weights: snapshot(), epochs: 0, validLoss: Infinity };
  let worse = 0;
  const logits = new Float64Array(classes);
  for (let epoch = 1; epoch <= epochs; epoch++) {
    random.shuffle(order);
    for (const index of order) {
      const ex = examples[index];
      logits.fill(0);
      for (const col of ex.cols) { const base = col * classes; for (let k = 0; k < classes; k++) logits[k] += w[base + k]; }
      const p = softmax(logits);
      for (const col of ex.cols) {
        const base = col * classes;
        for (let k = 0; k < classes; k++) {
          const i = base + k;
          const g = ex.weight * (p[k] - (k === ex.y ? 1 : 0));
          const sigma = (Math.sqrt(n[i] + g * g) - Math.sqrt(n[i])) / alpha;
          z[i] += g - sigma * w[i];
          n[i] += g * g;
          w[i] = weightOf(i);
        }
      }
    }
    if (!valid) continue;
    // Early stopping on validation log-loss, two epochs of patience.
    const weights = snapshot();
    const loss = logLoss(weights, valid, classes);
    if (loss < best.validLoss - 1e-4) { best = { weights, epochs: epoch, validLoss: loss }; worse = 0; }
    else if (++worse >= 2) break;
  }
  return valid ? best : { weights: snapshot(), epochs, validLoss: NaN };
}
