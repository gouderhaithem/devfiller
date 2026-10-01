// Joins the UCI classifier's labels (labelled.jsonl) with the engine's answers (engine.jsonl), one
// verdict per field group, and adds them up for the report.
import { compareField, compareFormType, type FieldVerdict, type FormVerdict } from './map';
import type { EngineForm, UciField } from './engine-entry';

export interface UciGroup { name: string | null; text: string; fields: number[]; labels: string[]; probabilities: Record<string, number> }
export interface LabelledForm {
  domain: string; job: string; form: string; formType: string | null; stored: string[];
  fields: Array<UciField & { label: string; previous: string }>; groups: UciGroup[];
}
export type EngineRow = EngineForm & { domain: string; job: string; form: string; error?: string };

export interface GroupCase {
  domain: string; job: string; form: string; name: string | null; text: string;
  labels: string[]; probability: number; ours: string; confidence: number; evidence?: string;
  verdict: FieldVerdict; visible: boolean;
}
export interface FormCase { theirs: string | null; ours?: string; verdict: FormVerdict }
export interface Compared { groups: GroupCase[]; unseen: number; form: FormCase }

// How sure their classifier was: of the labels it gave, or of the nearest one when it gave none.
function probabilityOf(group: UciGroup): number {
  const pool = group.labels.length ? group.labels.map(label => group.probabilities[label] ?? 0) : Object.values(group.probabilities);
  return Math.max(0, ...pool);
}

export function compareForm(labelled: LabelledForm, engine: EngineRow): Compared {
  const answers = new Map(engine.fields.map(field => [field.index, field]));
  const groups: GroupCase[] = [];
  let unseen = 0;
  for (const group of labelled.groups) {
    // Their text describes the whole group; ours is read from a field the crawler saw, if any.
    const answered = group.fields.filter(index => answers.has(index));
    const index = answered.find(i => labelled.fields[i]?.visible) ?? answered[0];
    if (index === undefined) { unseen++; continue; }
    const answer = answers.get(index)!;
    groups.push({
      domain: labelled.domain, job: labelled.job, form: labelled.form, name: group.name, text: group.text,
      labels: group.labels, probability: probabilityOf(group), ours: answer.type, confidence: answer.confidence, evidence: answer.evidence,
      verdict: compareField(group.labels, answer.type),
      visible: group.fields.some(index => labelled.fields[index]?.visible),
    });
  }
  return { groups, unseen, form: { theirs: labelled.formType, ours: engine.formType, verdict: compareFormType(labelled.formType ?? undefined, engine.formType) } };
}

export interface LabelSummary { total: number; agree: number; missed: number; conflict: number; ours: Record<string, number> }
export interface FormSummary { total: number; agree: number; conflict: number; ours: Record<string, number> }
export interface Summary {
  verdicts: Partial<Record<FieldVerdict, number>>; hidden: number; unseen: number;
  labels: Record<string, LabelSummary>; extra: Record<string, number>; forms: Record<string, FormSummary>;
}

const bump = (counts: Record<string, number>, key: string) => { counts[key] = (counts[key] ?? 0) + 1; };

// Field verdicts count what the crawler saw on screen; hidden groups are only counted.
export function summarize(results: readonly Compared[]): Summary {
  const summary: Summary = { verdicts: {}, hidden: 0, unseen: 0, labels: {}, extra: {}, forms: {} };
  for (const { groups, unseen, form } of results) {
    summary.unseen += unseen;
    for (const group of groups) {
      if (!group.visible) { summary.hidden++; continue; }
      bump(summary.verdicts, group.verdict);
      if (group.verdict === 'extra') bump(summary.extra, group.ours);
      // Each label by its own verdict: a group they call a name and an address, which we call a
      // full name, agrees on the name and not on the address.
      for (const label of group.labels) {
        const entry = summary.labels[label] ??= { total: 0, agree: 0, missed: 0, conflict: 0, ours: {} };
        const verdict = compareField([label], group.ours);
        entry.total++;
        if (verdict === 'agree' || verdict === 'missed' || verdict === 'conflict') entry[verdict]++;
        bump(entry.ours, group.ours);
      }
    }
    if (form.theirs) {
      const entry = summary.forms[form.theirs] ??= { total: 0, agree: 0, conflict: 0, ours: {} };
      entry.total++;
      if (form.verdict !== 'none') entry[form.verdict]++;
      bump(entry.ours, form.ours ?? 'none');
    }
  }
  return summary;
}
