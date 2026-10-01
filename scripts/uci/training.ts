// Writes $UCI_DIR/uci-train.jsonl from labelled.jsonl and engine.jsonl: UCI fields as extra
// training rows for the second-opinion model, chosen by select.ts. A field seen identically on many
// forms counts once, and each type keeps at most UCI_PER_TYPE rows (the same ones on every run), so
// the commonest types don't drown the rest.
//
//   node scripts/uci/run.mjs training          # then: EXTRA=$UCI_DIR/uci-train.jsonl npm run train
import { createHash } from 'node:crypto';
import { createReadStream, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { resolve } from 'node:path';
import type { EngineRow, LabelledForm } from './compare';
import { selectRows, type TrainingRow } from './select';

const UCI_DIR = process.env.UCI_DIR || resolve(process.env.HOME || '', 'datasets/uci-webform');
const PER_TYPE = Number(process.env.UCI_PER_TYPE || 800);

async function readJsonl<T>(name: string): Promise<T[]> {
  const rows: T[] = [];
  for await (const line of createInterface({ input: createReadStream(resolve(UCI_DIR, name)) })) if (line) rows.push(JSON.parse(line));
  return rows;
}
const hash = (text: string) => createHash('sha1').update(text).digest('hex');

const engine = new Map((await readJsonl<EngineRow>('engine.jsonl')).filter(row => !row.error).map(row => [`${row.job}/${row.form}`, row]));
const seen = new Set<string>();
const byType = new Map<string, Array<[string, TrainingRow]>>();
let selected = 0;
for (const form of await readJsonl<LabelledForm>('labelled.jsonl')) {
  const row = engine.get(`${form.job}/${form.form}`);
  if (!row) continue;
  for (const candidate of selectRows(form, row)) {
    selected++;
    const same = JSON.stringify([candidate.expect, candidate.info]);
    if (seen.has(same)) continue;
    seen.add(same);
    byType.set(candidate.expect, [...(byType.get(candidate.expect) ?? []), [hash(same), candidate]]);
  }
}
const kept = [...byType.values()].flatMap(list => list.sort((a, b) => a[0].localeCompare(b[0])).slice(0, PER_TYPE).map(([, row]) => row));
writeFileSync(resolve(UCI_DIR, 'uci-train.jsonl'), kept.map(row => JSON.stringify(row)).join('\n') + '\n');
const counts = Object.fromEntries([...byType].map(([type, list]) => [type, `${Math.min(list.length, PER_TYPE)}/${list.length}`]));
console.log(`${selected} fields selected, ${seen.size} distinct, ${kept.length} kept (at most ${PER_TYPE} per type) -> ${resolve(UCI_DIR, 'uci-train.jsonl')}`, counts);
