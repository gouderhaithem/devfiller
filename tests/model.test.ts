// @vitest-environment jsdom
// The learned second opinion (src/fill/model.ts): safety rules, size, speed, and that the shipped
// model was trained on the dataset in the repo.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fillPage, type FillRequest } from '../src/fill';
import { generateIdentities, generateValues } from '../src/data';
import { generateSamples } from '../src/samples';
import { MODEL, MODEL_CONFIDENCE_CAP, answer, predict } from '../src/fill/model';
import { featuresOf, hashFeature, type FieldInfo } from '../src/fill/features';
import { THRESHOLDS } from '../src/fill/classify';

const request: FillRequest = { values: generateValues('en'), identities: generateIdentities('en'), samples: generateSamples('en'), custom: [], overwrite: true, fillUnknown: true, passwords: false };
beforeEach(() => {
  document.body.replaceChildren();
  vi.spyOn(Element.prototype, 'getClientRects').mockReturnValue([{}] as unknown as DOMRectList);
});
const empty: FieldInfo = { signals: [], tag: 'input', type: 'text', inputmode: '', autocomplete: '', maxLength: -1, pattern: false, shape: '', unit: '', options: { count: 0, numbers: 0, dates: 0, times: 0, lists: [], scale: '' }, rule: [], verdict: ['unknown', 0], prev: '', next: '' };
const withText = (text: string, source: FieldInfo['signals'][number]['source'] = 'label'): FieldInfo => ({ ...empty, signals: [{ source, text }] });

describe('the shipped model', () => {
  it('never knows a sensitive type', () => {
    expect(MODEL.classes.length).toBeGreaterThan(10);
    expect(MODEL.classes.filter(name => name.startsWith('skip:'))).toEqual([]);
  });
  it('stays within the size budget', () => {
    expect(readFileSync('src/fill/model.json').length).toBeLessThanOrEqual(150 * 1024);
  });
  it('was trained on the dataset in the repo', () => {
    const hash = createHash('sha256').update(readFileSync('benchmark/model/dataset.jsonl')).digest('hex').slice(0, 16);
    expect((MODEL as unknown as { dataset: string }).dataset, 'retrain with npm run train').toBe(hash);
  });
  it('abstains when a field says nothing', () => {
    expect(answer(MODEL, predict(MODEL, featuresOf(empty)))).toBeUndefined();
  });
  it('is deterministic and quick', () => {
    const features = featuresOf(withText('given name s'));
    expect(predict(MODEL, features)).toEqual(predict(MODEL, features));
    const start = performance.now();
    for (let i = 0; i < 1000; i++) predict(MODEL, featuresOf(withText(`field ${i} name`)));
    expect(performance.now() - start).toBeLessThan(250);
  });
  it('hashes features into its buckets', () => {
    expect(hashFeature('bias', MODEL.hashBits)).toBeLessThan(2 ** MODEL.hashBits);
  });
});

describe('model guesses on a page', () => {
  function classified(html: string, extra: Partial<FillRequest> = {}) {
    document.body.innerHTML = `<form>${html}</form>`;
    const controls = Array.from(document.querySelectorAll<HTMLInputElement>('input, select, textarea'));
    const result = fillPage({ ...request, modelGuesses: true, ...extra, mode: 'classify' });
    return new Map((result.classified ?? []).map(found => [controls[found.index].id, found]));
  }
  it('stays below medium confidence', () => {
    for (const found of classified('<label for="a">Given name(s)</label><input id="a"><label for="b">Name of host person</label><input id="b"><label for="c">Qty req.</label><input id="c" type="number">').values()) {
      if (found.type !== 'unknown' && found.confidence < THRESHOLDS.medium) expect(found.confidence).toBeLessThanOrEqual(MODEL_CONFIDENCE_CAP);
    }
  });
  it('never touches a sensitive field', () => {
    const found = classified('<label for="c">Card number</label><input id="c"><label for="i">IBAN</label><input id="i"><label for="o">Verification code</label><input id="o">');
    expect([...found.values()].map(f => f.type)).toEqual(['skip:card', 'skip:iban', 'skip:otp']);
  });
  it('is off unless asked for', () => {
    document.body.innerHTML = '<form><label for="a">Leaving on</label><input id="a" type="date"></form>';
    expect(fillPage({ ...request, mode: 'classify' }).classified?.[0]).toEqual(fillPage({ ...request, modelGuesses: false, mode: 'classify' }).classified?.[0]);
  });
  it('can be switched off', () => {
    const on = classified('<label for="a">Leaving on</label><input id="a" type="date">');
    const off = classified('<label for="a">Leaving on</label><input id="a" type="date">', { modelGuesses: false });
    expect(off.get('a')?.confidence ?? 0).toBeLessThanOrEqual(on.get('a')?.confidence ?? 0);
  });
});
