import { describe, expect, it } from 'vitest';
import { acceptable, fillSummary } from '../scripts/model/acceptable';

describe('acceptable', () => {
  it('takes the exact answer', () => {
    expect(acceptable('email', 'email')).toBe(true);
    expect(acceptable('unknown', 'unknown')).toBe(true);
  });

  it('takes another kind of sentence for a free-text field', () => {
    expect(acceptable('notes', 'message')).toBe(true);
    expect(acceptable('description', 'message')).toBe(true);
    expect(acceptable('message', 'bio')).toBe(true);
  });

  it('takes a price for an amount', () => {
    expect(acceptable('price', 'amount')).toBe(true);
    expect(acceptable('amount', 'price')).toBe(true);
  });

  it('takes a skipped field that needed nothing', () => {
    expect(acceptable('unknown', 'skip:consent')).toBe(true);
    expect(acceptable('unknown', 'skip:card')).toBe(true);
  });

  it('refuses a sensitive field read as unknown, which a fill of unknown fields may touch', () => {
    expect(acceptable('skip:consent', 'unknown')).toBe(false);
    expect(acceptable('skip:otp', 'unknown')).toBe(false);
  });

  it('refuses a fill that would look wrong or break the form', () => {
    expect(acceptable('subject', 'skip:consent')).toBe(false);
    expect(acceptable('birthDate', 'date')).toBe(false);
    expect(acceptable('firstName', 'fullName')).toBe(false);
    expect(acceptable('unknown', 'website')).toBe(false);
    expect(acceptable('message', 'subject')).toBe(false);
  });
});

describe('fillSummary', () => {
  it('counts the fine fills and lists the real mistakes, most common first', () => {
    const pairs = [
      { expected: 'email', predicted: 'email' },
      { expected: 'notes', predicted: 'message' },
      { expected: 'subject', predicted: 'skip:consent' },
      { expected: 'subject', predicted: 'skip:consent' },
      { expected: 'unknown', predicted: 'website' },
    ];
    expect(fillSummary(pairs)).toEqual({
      fine: 2 / 5,
      mistakes: 3,
      top: [['subject → skip:consent', 2], ['unknown → website', 1]],
    });
  });

  it('copes with no fields', () => {
    expect(fillSummary([])).toEqual({ fine: 0, mistakes: 0, top: [] });
  });
});
