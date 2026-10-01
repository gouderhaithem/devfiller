// Which UCI fields become training rows for the second-opinion model, and with what label. Their
// labels are a model's, so only the sure, unambiguous ones are used: one label, at or above
// MIN_PROBABILITY, on a single visible field. A label that names one of our types is taken as is;
// a broad one (PersonName, LocationCityOrCoarser…) only through an engine answer it covers, which
// picks first name or city. Fields with no PI label are never used: no PI is not "unknown" to us.
import type { FieldInfo } from '../../src/fill/features';
import type { EngineRow, LabelledForm } from './compare';
import { UCI_LABELS } from './map';

// Their probabilities run low: an obvious password or email field scores 0.8 to 0.9.
export const MIN_PROBABILITY = 0.75;

export const DIRECT: Readonly<Record<string, string>> = {
  EmailAddress: 'email', Password: 'password', PhoneNumber: 'phone', PostalCode: 'postalCode',
  UsernameOrOtherId: 'username', Gender: 'gender', AgeOrAgeGroup: 'age', DateOfBirth: 'birthDate',
};
// Sensitive fields belong to the rules alone; the model never learns them.
const SENSITIVE = new Set(['BankAccountNumber']);

export interface TrainingRow { page: string; source: 'uci'; lang: 'en'; index: number; expect: string; info: FieldInfo }

function expected(label: string, ours: string, info: FieldInfo): string | undefined {
  // Selects of a split birth date are a day, a month or a year, not a whole date.
  if (label === 'DateOfBirth' && info.tag !== 'input') return undefined;
  return DIRECT[label] ?? (UCI_LABELS[label]?.includes(ours) ? ours : undefined);
}

export function selectRows(labelled: LabelledForm, engine: EngineRow, minProbability = MIN_PROBABILITY): TrainingRow[] {
  const answers = new Map(engine.fields.map(field => [field.index, field]));
  const rows: TrainingRow[] = [];
  for (const group of labelled.groups) {
    if (group.fields.length !== 1 || group.labels.length !== 1) continue;
    const [index] = group.fields, [label] = group.labels;
    const answer = answers.get(index);
    if (!answer?.info || !labelled.fields[index]?.visible) continue;
    if (SENSITIVE.has(label) || answer.type.startsWith('skip:') || !UCI_LABELS[label]?.length) continue;
    if ((group.probabilities[label] ?? 0) < minProbability) continue;
    const expect = expected(label, answer.type, answer.info);
    if (expect) rows.push({ page: `uci/${labelled.domain}/${labelled.job}/${labelled.form}`, source: 'uci', lang: 'en', index, expect, info: answer.info });
  }
  return rows;
}
