// Injected into a blank tab by engine.ts: puts one UCI form in the page and returns what the
// engine (src/fill) makes of each of its fields, and what the model reads of each (its first-pass
// inputs, as scripts/model/page-entry.ts records them for the dataset). innerHTML never runs the
// form's scripts.
import { analyzePage, firstPass } from '../../src/fill/context';
import { listControls } from '../../src/fill/extract';
import { modelInputs } from '../../src/fill/model';
import type { FieldInfo } from '../../src/fill/features';

export interface UciField { html: string; name: string | null; tag: string | null; visible: boolean }
export interface EngineField { index: number; type: string; confidence: number; evidence?: string; info?: FieldInfo }
export interface EngineForm { fields: EngineField[]; unmatched: number[]; formType?: string; formConfidence?: number }

type Control = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

// Finds the control each crawled field was: the same markup first, else the same name and tag.
function match(form: Element, fields: readonly UciField[]): Map<number, Control> {
  const controls = Array.from(form.querySelectorAll<Control>('input, select, textarea'));
  const markup = new Map(controls.map(el => [el, el.outerHTML]));
  const taken = new Set<Control>();
  const found = new Map<number, Control>();
  const claim = (index: number, test: (el: Control) => boolean) => {
    const el = controls.find(candidate => !taken.has(candidate) && test(candidate));
    if (el) { taken.add(el); found.set(index, el); }
  };
  fields.forEach((field, index) => claim(index, el => markup.get(el) === field.html));
  fields.forEach((field, index) => {
    if (!found.has(index) && field.name) claim(index, el => el.getAttribute('name') === field.name && el.tagName === field.tag);
  });
  return found;
}

(globalThis as unknown as { __uciRun: (html: string, fields: UciField[]) => EngineForm }).__uciRun = (html, fields) => {
  document.body.innerHTML = html;
  const form = document.body.querySelector('form') ?? document.body;
  const matched = match(form, fields);
  // Form types are judged on what the crawler saw, not on this unstyled copy.
  const visible = new Map(Array.from(matched, ([index, el]) => [el, fields[index].visible] as const));
  const controls = listControls();
  const inputs = new Map(modelInputs(controls, firstPass(controls)).map(({ el, info }) => [el, info]));
  const analysis = analyzePage(controls, visible);
  const out: EngineField[] = [];
  for (const [index, el] of matched) {
    const found = analysis.fields.get(el);
    if (!found) continue;
    const top = found.evidence?.[0];
    out.push({ index, type: found.type, confidence: Math.round(found.confidence * 1000) / 1000, evidence: top ? `${top.source}: ${top.signal}` : undefined, info: inputs.get(el) });
  }
  const insight = analysis.forms[0];
  return {
    fields: out.sort((a, b) => a.index - b.index),
    unmatched: fields.map((_, index) => index).filter(index => !matched.has(index)),
    formType: insight?.type, formConfidence: insight?.confidence,
  };
};
