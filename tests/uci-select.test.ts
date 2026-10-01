import { describe, expect, it } from 'vitest';
import { selectRows } from '../scripts/uci/select';
import type { EngineRow, LabelledForm, UciGroup } from '../scripts/uci/compare';
import type { FieldInfo } from '../src/fill/features';

const info = (tag: FieldInfo['tag'] = 'input'): FieldInfo => ({
  signals: [{ source: 'label', text: 'x' }], tag, type: 'text', inputmode: '', autocomplete: '', maxLength: -1, pattern: false, shape: '', unit: '',
  options: { count: 0, numbers: 0, dates: 0, times: 0, lists: [], scale: '' }, rule: [], verdict: ['unknown', 0], prev: '', next: '',
});
const field = (name: string, visible = true) => ({ name, tag: 'INPUT', html: `<input name="${name}">`, visible, label: name, previous: '' });

function form(groups: Array<Pick<UciGroup, 'labels' | 'probabilities'> & { fields?: number[] }>, answers: EngineRow['fields'], visible = true): [LabelledForm, EngineRow] {
  const count = Math.max(1, ...groups.flatMap(g => g.fields ?? []).map(i => i + 1), groups.length);
  const labelled: LabelledForm = {
    domain: 'example.com', job: 'j1', form: 'form-0.json', formType: null, stored: [],
    fields: Array.from({ length: count }, (_, i) => field(`f${i}`, visible)),
    groups: groups.map((g, i) => ({ name: `f${i}`, text: `f${i}`, fields: g.fields ?? [i], labels: g.labels, probabilities: g.probabilities })),
  };
  return [labelled, { domain: 'example.com', job: 'j1', form: 'form-0.json', unmatched: [], fields: answers }];
}
const answer = (index: number, type: string, tag?: FieldInfo['tag']) => ({ index, type, confidence: 0.5, info: info(tag) });

describe('selectRows', () => {
  it('keeps a sure label that names one of our types', () => {
    const rows = selectRows(...form([{ labels: ['EmailAddress'], probabilities: { EmailAddress: 0.97 } }], [answer(0, 'unknown')]));
    expect(rows).toEqual([{ page: 'uci/example.com/j1/form-0.json', source: 'uci', lang: 'en', index: 0, expect: 'email', info: info() }]);
  });

  it('takes the label over the engine when they differ', () => {
    expect(selectRows(...form([{ labels: ['PhoneNumber'], probabilities: { PhoneNumber: 0.95 } }], [answer(0, 'postalCode')]))[0].expect).toBe('phone');
  });

  it('drops labels the classifier was not sure of', () => {
    expect(selectRows(...form([{ labels: ['EmailAddress'], probabilities: { EmailAddress: 0.7 } }], [answer(0, 'unknown')]))).toEqual([]);
  });

  it('resolves a broad label only through an engine type it covers', () => {
    const [agreed] = selectRows(...form([{ labels: ['PersonName'], probabilities: { PersonName: 0.99 } }], [answer(0, 'lastName')]));
    expect(agreed.expect).toBe('lastName');
    expect(selectRows(...form([{ labels: ['PersonName'], probabilities: { PersonName: 0.99 } }], [answer(0, 'unknown')]))).toEqual([]);
  });

  it('keeps birth dates only for inputs, not the selects of a split date', () => {
    expect(selectRows(...form([{ labels: ['DateOfBirth'], probabilities: { DateOfBirth: 0.99 } }], [answer(0, 'unknown')]))[0].expect).toBe('birthDate');
    expect(selectRows(...form([{ labels: ['DateOfBirth'], probabilities: { DateOfBirth: 0.99 } }], [answer(0, 'year', 'select')]))).toEqual([]);
  });

  it('skips fields with several labels, out-of-scope labels, and sensitive ones', () => {
    const rows = selectRows(...form([
      { labels: ['UsernameOrOtherId', 'EmailAddress'], probabilities: { UsernameOrOtherId: 0.95, EmailAddress: 0.95 } },
      { labels: ['TaxId'], probabilities: { TaxId: 0.99 } },
      { labels: ['BankAccountNumber'], probabilities: { BankAccountNumber: 0.99 } },
      { labels: ['EmailAddress'], probabilities: { EmailAddress: 0.99 } },
    ], [answer(0, 'unknown'), answer(1, 'unknown'), answer(2, 'skip:iban'), answer(3, 'skip:otp')]));
    expect(rows).toEqual([]);
  });

  it('skips fields without a label: no PI is not the same as unknown', () => {
    expect(selectRows(...form([{ labels: [], probabilities: {} }], [answer(0, 'unknown')]))).toEqual([]);
  });

  it('skips hidden fields, multi-field groups and fields with no model inputs', () => {
    const sure = { labels: ['EmailAddress'], probabilities: { EmailAddress: 0.99 } };
    expect(selectRows(...form([sure], [answer(0, 'unknown')], false))).toEqual([]);
    expect(selectRows(...form([{ ...sure, fields: [0, 1] }], [answer(0, 'unknown'), answer(1, 'unknown')]))).toEqual([]);
    expect(selectRows(...form([sure], [{ index: 0, type: 'unknown', confidence: 0 }]))).toEqual([]);
  });
});
