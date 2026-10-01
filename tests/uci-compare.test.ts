import { describe, expect, it } from 'vitest';
import { compareForm, summarize, type EngineRow, type LabelledForm } from '../scripts/uci/compare';

const field = (name: string, visible = true) => ({ name, tag: 'INPUT', html: `<input name="${name}">`, visible, label: name, previous: '' });

const labelled: LabelledForm = {
  domain: 'example.com', job: 'j1', form: 'form-0.json', formType: 'Account Login Form', stored: ['EmailAddress', 'Password'],
  fields: [field('email'), field('password'), field('remember'), field('csrf', false)],
  groups: [
    { name: 'email', text: 'email', fields: [0], labels: ['EmailAddress'], probabilities: { EmailAddress: 0.98 } },
    { name: 'password', text: 'password', fields: [1], labels: ['Password'], probabilities: { Password: 0.99 } },
    { name: 'remember', text: 'remember', fields: [2], labels: [], probabilities: {} },
    { name: 'csrf', text: 'csrf', fields: [3], labels: [], probabilities: {} },
  ],
};
const engine: EngineRow = {
  domain: 'example.com', job: 'j1', form: 'form-0.json', unmatched: [], formType: 'login', formConfidence: 0.85,
  fields: [
    { index: 0, type: 'username', confidence: 0.9, evidence: 'name: email' },
    { index: 1, type: 'password', confidence: 0.99, evidence: 'type: password' },
    { index: 2, type: 'unknown', confidence: 0 },
  ],
};

describe('compareForm', () => {
  const result = compareForm(labelled, engine);

  it('gives each field group a verdict from its labels and our type', () => {
    expect(result.groups.map(group => [group.name, group.ours, group.verdict])).toEqual([
      ['email', 'username', 'conflict'], ['password', 'password', 'agree'], ['remember', 'unknown', 'none'],
    ]);
  });

  it('leaves out groups the engine never classified', () => {
    expect(result.groups.find(group => group.name === 'csrf')).toBeUndefined();
    expect(result.unseen).toBe(1);
  });

  it('carries the classifier probability of the labels it compared', () => {
    expect(result.groups[0].probability).toBe(0.98);
  });

  it('compares the form type', () => {
    expect(result.form).toEqual({ theirs: 'Account Login Form', ours: 'login', verdict: 'agree' });
  });

  it('reads a group as its first field the crawler saw, else its first one', () => {
    const radios: LabelledForm = { ...labelled, fields: [field('g', false), field('g')], groups: [{ name: 'g', text: 'g', fields: [0, 1], labels: ['Gender'], probabilities: { Gender: 0.9 } }] };
    const both: EngineRow = { ...engine, fields: [{ index: 0, type: 'unknown', confidence: 0 }, { index: 1, type: 'gender', confidence: 0.9 }] };
    expect(compareForm(radios, both).groups[0]).toMatchObject({ ours: 'gender', verdict: 'agree', visible: true });
    const hidden: EngineRow = { ...engine, fields: [{ index: 0, type: 'unknown', confidence: 0 }] };
    expect(compareForm(radios, hidden).groups[0]).toMatchObject({ ours: 'unknown', verdict: 'missed' });
  });

  it('gives no form verdict when the engine read no form', () => {
    expect(compareForm(labelled, { ...engine, formType: undefined }).form.verdict).toBe('none');
  });
});

describe('summarize', () => {
  it('counts verdicts overall and per label, visible groups only', () => {
    const hidden = { ...labelled, fields: labelled.fields.map(f => ({ ...f, visible: false })) };
    const summary = summarize([compareForm(labelled, engine), compareForm(hidden, engine)]);
    expect(summary.verdicts).toEqual({ conflict: 1, agree: 1, none: 1 });
    expect(summary.hidden).toBe(3);
    expect(summary.labels.EmailAddress).toEqual({ total: 1, agree: 0, missed: 0, conflict: 1, ours: { username: 1 } });
    expect(summary.forms['Account Login Form']).toEqual({ total: 2, agree: 2, conflict: 0, ours: { login: 2 } });
  });

  it('counts each label of a group by its own verdict', () => {
    const mixed: LabelledForm = { ...labelled, groups: [{ name: 'who', text: 'who', fields: [0], labels: ['PersonName', 'Address', 'TaxId'], probabilities: {} }] };
    const summary = summarize([compareForm(mixed, { ...engine, fields: [{ index: 0, type: 'fullName', confidence: 0.9 }] })]);
    expect(summary.labels.PersonName).toMatchObject({ total: 1, agree: 1 });
    expect(summary.labels.Address).toMatchObject({ total: 1, agree: 0, conflict: 1 });
    expect(summary.labels.TaxId).toMatchObject({ total: 1, agree: 0, missed: 0, conflict: 0 });
  });
});
