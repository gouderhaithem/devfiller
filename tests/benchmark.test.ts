import { describe, expect, it } from 'vitest';
import { regressions, score, type Current, type Pair } from '../benchmark/metrics';
import { spellings, variantCases, VARIANT_BASES } from '../benchmark/variants';

const pair = (expected: string, predicted: string, index = 0): Pair => ({ fixture: 'f.html', index, expected, predicted });

describe('benchmark metrics', () => {
  const pairs = [pair('email', 'email'), pair('email', 'unknown'), pair('phone', 'email'), pair('unknown', 'unknown'), pair('unknown', 'city'), pair('skip:card', 'skip:card')];
  it('scores precision and recall over typed answers, per type and overall', () => {
    const { summary, types } = score(pairs);
    expect(types.email).toMatchObject({ support: 2, predicted: 2, correct: 1, precision: 0.5, recall: 0.5 });
    expect(types.phone).toMatchObject({ precision: null, recall: 0 });
    expect(types.city).toMatchObject({ precision: 0, recall: null, f1: null });
    // 2 of 4 typed predictions are right, and 2 of 4 fields expecting a type were found.
    expect(summary).toMatchObject({ fields: 6, precision: 0.5, recall: 0.5, accuracy: 0.5 });
    expect(summary.unknownRate).toBeCloseTo(2 / 6);
    expect(summary.falsePositiveRate).toBe(0.5);
    expect(summary.wrongRate).toBeCloseTo(2 / 6);
  });
  it('lists the most frequent confusions first', () => {
    expect(score([...pairs, pair('email', 'unknown', 1)]).confusions[0]).toEqual({ expected: 'email', predicted: 'unknown', count: 2 });
  });
  it('fails on leaks, submissions and network requests even without a baseline', () => {
    const { summary, types } = score(pairs);
    const current: Current = { summary, types, leaks: 1, submits: 1, requests: 2, variants: { correct: 1, total: 1 } };
    expect(regressions(current, undefined)).toHaveLength(3);
  });
  it('fails when overall or per-type precision or recall drops', () => {
    const before = score(pairs);
    const after = score([pair('email', 'unknown'), pair('email', 'unknown'), pair('phone', 'email'), pair('unknown', 'unknown'), pair('unknown', 'city'), pair('skip:card', 'skip:card')]);
    const baseline = { summary: before.summary, types: before.types, leaks: 0, variants: { correct: 5, total: 5 } };
    const problems = regressions({ summary: after.summary, types: after.types, leaks: 0, submits: 0, requests: 0, variants: { correct: 4, total: 5 } }, baseline);
    expect(problems.join('\n')).toMatch(/overall recall/);
    expect(problems.join('\n')).toMatch(/email recall/);
    expect(problems.join('\n')).toMatch(/spelling variants/);
    expect(regressions({ ...baseline, submits: 0, requests: 0 }, baseline)).toEqual([]);
  });
});

describe('spelling variants', () => {
  it('writes a phrase the ways developers name fields', () => {
    expect(spellings('phone number')).toEqual(expect.arrayContaining(['phone number', 'phone_number', 'phone-number', 'phoneNumber', 'PhoneNumber', 'PHONE_NUMBER', 'phone.number', 'phonenumber']));
    expect(spellings('numéro de téléphone')).toEqual(expect.arrayContaining(['numero_de_telephone', 'numéro-de-téléphone']));
    expect(spellings('رقم الهاتف')).toEqual(expect.arrayContaining(['رقم-الهاتف', 'رقم_الهاتف']));
  });
  it('never repeats a spelling for the same phrase', () => {
    const cases = variantCases();
    expect(new Set(cases.map(c => `${c.base}|${c.name}`)).size).toBe(cases.length);
    expect(new Set(cases.map(c => c.base)).size).toBe(VARIANT_BASES.length);
  });
});
