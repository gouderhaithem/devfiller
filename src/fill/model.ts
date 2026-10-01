import type { FieldKey } from '../data';
import type { Control } from './types';
import { isSensitive, THRESHOLDS, type Classification, type Evidence } from './classify';
import { featuresOf, fieldInfo, hashFeature, type FieldInfo } from './features';
import { isChoice } from './extract';
import packed from './model.json';

// The learned second opinion: a small softmax regression trained offline (npm run train) that
// speaks only when the rules have no confident answer. Five safety rules: it never decides a
// sensitive field and never names one (its classes have no skip:*), it never overrides a confident
// rule, its confidence stays below medium, it abstains when its top two types are close, and it
// never names a type the rules ruled out.

export interface PackedModel {
  version: number;
  hashBits: number;
  classes: string[];
  bias: number[];
  scale: number[];          // one per class: a weight is value × scale[class]
  weights: Record<string, number[]>; // bucket → [classIndex, value, classIndex, value…]
  temperature: number;
  threshold: number;        // lowest top probability it answers with
  margin: number;           // lowest lead over the runner-up
  override?: number;        // lowest top probability that replaces a rule's weak guess
  exclude?: string[];       // feature prefixes the model was trained without
}

export interface Opinion { type: string; probability: number; runnerUp: number; clues: Array<[string, number]> }

// Model answers enter below medium confidence, so they never look as certain as a rule.
export const MODEL_CONFIDENCE_CAP = THRESHOLDS.medium - 0.01;

export function predict(model: PackedModel, features: readonly string[]): Opinion | undefined {
  if (!model.classes.length) return undefined;
  const scores = [...model.bias];
  const contributions = new Map<string, number>();
  const used = model.exclude?.length ? features.filter(feature => !model.exclude!.some(prefix => feature.startsWith(prefix))) : features;
  for (const feature of used) {
    const row = model.weights[hashFeature(feature, model.hashBits)];
    if (!row) continue;
    for (let k = 0; k < row.length; k += 2) scores[row[k]] += row[k + 1] * model.scale[row[k]];
    contributions.set(feature, 0);
  }
  const top = scores.indexOf(Math.max(...scores));
  const exp = scores.map(score => Math.exp((score - scores[top]) / model.temperature));
  const sum = exp.reduce((a, b) => a + b, 0);
  const probabilities = exp.map(value => value / sum);
  const runnerUp = Math.max(...probabilities.filter((_, i) => i !== top));
  // The clues that pushed hardest towards the answer, for the side panel's evidence.
  for (const feature of contributions.keys()) {
    const row = model.weights[hashFeature(feature, model.hashBits)]!;
    for (let k = 0; k < row.length; k += 2) if (row[k] === top) contributions.set(feature, row[k + 1] * model.scale[top]);
  }
  const clues = [...contributions].filter(([, weight]) => weight > 0).sort((a, b) => b[1] - a[1]).slice(0, 3);
  return { type: model.classes[top], probability: probabilities[top], runnerUp, clues };
}

// Whether the model answers at all: a real type, sure enough, and clearly ahead of the next one.
// Replacing a rule's own weak guess takes more certainty than naming a field the rules left unknown.
export function answer(model: PackedModel, opinion: Opinion | undefined, ruleGuess = 'unknown'): FieldKey | undefined {
  if (!opinion || opinion.type === 'unknown' || opinion.type.startsWith('skip:')) return undefined;
  const replaces = ruleGuess !== 'unknown' && ruleGuess !== opinion.type;
  if (opinion.probability < (replaces ? model.override ?? 1 : model.threshold) || opinion.probability - opinion.runnerUp < model.margin) return undefined;
  return opinion.type as FieldKey;
}

// Fields the model may speak for: ordinary text, number, date and select controls the rules left
// unknown or unsure. Checkboxes and radios are choices, sensitive fields belong to the rules alone.
export const askable = (el: Control, found: Classification) =>
  !isChoice(el) && !found.fixed && !isSensitive(found.type) && !found.unconfirmed && (found.type === 'unknown' || found.confidence < THRESHOLDS.medium);

export const MODEL: PackedModel = packed as PackedModel;

// What the model reads for every ordinary field, in page order: the dataset is built with exactly
// this, so training sees what the extension sees.
export function modelInputs(controls: readonly Control[], fields: ReadonlyMap<Control, Classification>): Array<{ el: Control; found: Classification; info: FieldInfo }> {
  const order = controls.filter(el => fields.has(el) && !isChoice(el));
  const types = order.map(el => fields.get(el)!.type);
  return order.map((el, i) => { const found = fields.get(el)!; return { el, found, info: fieldInfo(el, found, types[i - 1] ?? '', types[i + 1] ?? '') }; });
}

// From low confidence at the model's threshold up to the cap when it is certain.
const confidenceOf = (model: PackedModel, probability: number) =>
  Math.min(MODEL_CONFIDENCE_CAP, THRESHOLDS.low + (MODEL_CONFIDENCE_CAP - THRESHOLDS.low) * (probability - model.threshold) / Math.max(1e-6, 1 - model.threshold));

// Runs after the form-level pass, on what it left unknown or unsure. Features come from the first
// pass (`first`), exactly as the dataset records them.
export function secondOpinion(controls: readonly Control[], fields: Map<Control, Classification>, first: ReadonlyMap<Control, Classification> = fields, model: PackedModel = MODEL) {
  if (!model.classes.length) return;
  for (const { el, found: seen, info } of modelInputs(controls, first)) {
    const found = fields.get(el);
    if (!found || !askable(el, found)) continue;
    const opinion = predict(model, featuresOf(info));
    const type = answer(model, opinion, found.confidence >= THRESHOLDS.low ? found.type : 'unknown');
    // Nor does it name a type the rules ruled out: "Facility name" is no person's name.
    if (!type || !opinion || (found.ruledOut ?? seen.ruledOut)?.includes(type)) continue;
    // A weak rule guess the model agrees with keeps the rule's evidence and gains the model's.
    const agrees = found.type === type;
    const confidence = Math.min(MODEL_CONFIDENCE_CAP, Math.max(agrees ? found.confidence : 0, confidenceOf(model, opinion.probability)));
    const evidence: Evidence = { source: 'model', signal: `model v${model.version}: ${opinion.clues.map(([clue]) => clue).join(', ') || 'overall pattern'}`, weight: confidence, match: 'model' };
    fields.set(el, { ...found, type, confidence, evidence: [...(agrees ? found.evidence : []), evidence], model: !agrees, role: agrees ? found.role : undefined });
  }
}
