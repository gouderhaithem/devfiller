import type { ControlSnapshot } from '../panel-types';
import type { FieldKey } from '../data';
import type { Control, ControlRun, FillContext, FillRequest, FillResult, Outcome, PageState, UnknownField } from './types';
import { CONSENT, CONTEXTUAL_KEYS, COUNTRY_CODES, MACHINE_ID, PASSWORD } from './dictionary';
import { controlSignals, isChoice, isEditableChoice, isFillable, isInput, isScale, isTrap, isVisible, legendText, listControls, optionTexts, radioScope, type ControlSignals } from './extract';
import { shouldExclude } from './exclude';
import { classificationOf, isSensitive, usableKey, type Classification } from './classify';
import { analyzePage } from './context';
import { coherentValues, fallbackValue, fitValue, matchChoice, spellingsFor, type Resolved } from './generate';
import { randomFor, secureRandom, type Random } from '../rng';
import { alignPhones } from './phones';
import { classifyWidget, listWidgets, WIDGET_SELECTOR } from './widgets';
import { DECIMAL_KEYS, localizeDecimal, measurementValue, referenceValue } from './specific';
import { alternatives, firstValid, forgetAlternatives, formatDateText, rememberAlternatives } from './validation';
import { DATE_FIELD_TYPES } from './dictionary';
import { setNativeChecked, setNativeValue, snapshot } from './apply';
import { controlReport, finalizeReport, finishFill } from './report';
import { normalize } from './normalize';
import { findCustomRule } from './rules';

export type { ClassifiedField, FillRequest, FillResult, SuggestedField, UnknownField } from './types';
export { panelPageAction } from './panel';

const run = (outcome: Outcome, extra: Partial<ControlRun> = {}): ControlRun => ({ outcome, source: 'local data', ...extra });
const NONE = run('none');

function fillRadioGroup(ctx: FillContext, el: HTMLInputElement): ControlRun {
  const { request, controls } = ctx;
  // Groups outside forms are told apart by the tree they live in, so a shadow root's "size" isn't the page's.
  const members = controls.filter((c): c is HTMLInputElement => c instanceof HTMLInputElement && c.type === 'radio' && radioScope(c) === radioScope(el) && (el.name ? c.name === el.name : c === el));
  const group = `${Array.from(document.forms).indexOf(el.form!)}:${el.name || 'unnamed'}:${controls.indexOf(members[0])}`;
  if (ctx.radioGroups.has(group)) return run('none', { reason: 'Radio group handled separately' });
  ctx.radioGroups.add(group);
  if (members.some(member => shouldExclude(member, ctx.exclusions))) return run('none', { reason: 'Another option in this group is excluded' });
  if (!request.overwrite && members.some(c => c.checked)) return run('preserved');
  // "Strongly agree" on a scale is an opinion, not consent: every answer on a scale may be chosen.
  const scale = !!isScale(optionTexts(el));
  const candidates = members.filter(c => isEditableChoice(c, ctx.visible.get(c)) && !isSensitive(classificationOf(ctx.classifications, c).type) && (scale || !CONSENT.test(normalize([c.name, c.id, c.getAttribute('aria-label') || '', ...Array.from(c.labels || []).map(l => l.textContent || '')].join(' ')))));
  const different = candidates.filter(c => !c.checked);
  const choices = ctx.fresh && different.length ? different : candidates;
  if (!choices.length) return run('none', { reason: 'No option in this group can be selected' });
  // A recognized group ("Male / Female") picks the answer that matches the generated value.
  const key = usableKey(classificationOf(ctx.classifications, el), request.fillUnknown);
  const matching = key ? matchChoice(candidates, spellingsFor(ctx.values[key], key), radio => [radio.value, ...Array.from(radio.labels || [], label => label.textContent || '')]) : undefined;
  const target = matching ?? choices[ctx.random(el)(choices.length)];
  for (const member of controls) if (member === target || (target.name && member instanceof HTMLInputElement && member.type === 'radio' && member.form === target.form && member.name === target.name)) ctx.touched.add(member);
  setNativeChecked(target, true);
  return run('filled');
}

// Checkboxes and radio groups get a random choice, and only when "Fill unknown fields" is on.
function fillChoice(ctx: FillContext, el: HTMLInputElement, signals: readonly string[]): ControlRun {
  const { request } = ctx;
  if (request.mode === 'scan') return NONE;
  if (!request.fillUnknown) return NONE;
  // A scale's question may say "agree" ("How much do you agree…"): an opinion, not consent.
  const scale = el.type === 'radio' && !!isScale(optionTexts(el));
  if (!scale && (signals.some(s => CONSENT.test(s)) || CONSENT.test(legendText(el)))) return run('none', { reason: 'Consent field stays untouched' });
  if (el.type === 'radio') return fillRadioGroup(ctx, el);
  if (el.checked && !request.overwrite) return run('preserved');
  ctx.touched.add(el);
  // Fresh fills toggle the box; a seeded fill always gives it the same state.
  setNativeChecked(el, request.seed?.trim() ? ctx.random(el)(2) === 1 : !el.checked);
  return run('filled');
}

function unknownField(el: Control, index: number, { label, labelledBy }: ControlSignals): UnknownField {
  const field: UnknownField = { id: `field_${index}`, label: (label || el.getAttribute('aria-label') || labelledBy || '').trim().slice(0, 160), name: (el.name || el.id).slice(0, 120), placeholder: (el.getAttribute('placeholder') || '').slice(0, 160), type: el instanceof HTMLTextAreaElement ? 'textarea' : el.type, min: el.getAttribute('min') || '', max: el.getAttribute('max') || '', step: el.getAttribute('step') || '', minLength: 'minLength' in el ? el.minLength : -1, maxLength: 'maxLength' in el ? el.maxLength : -1 };
  return { ...field, signature: JSON.stringify(field) };
}

// A usable AI suggestion for this exact field, preferring one that changes the current value.
function suggestion(ctx: FillContext, el: Control, field: UnknownField): string | undefined {
  const { request } = ctx;
  const supplied = request.suggestions?.[field.id];
  if (!supplied || supplied.signature !== field.signature || (request.suggestionsExpireAt && request.suggestionsExpireAt <= Date.now())) return undefined;
  const usable = supplied.values.filter(v => typeof v === 'string' && v.trim() && !MACHINE_ID.test(v));
  return usable.find(v => v !== el.value) ?? usable[0];
}

// Values that depend on another field: a confirmation repeats what was written into the field it
// confirms, and a current password differs from the new one.
function relatedValue(ctx: FillContext, found: Classification, key: string): { value: string; literal: boolean } | undefined {
  // Whatever the first field holds, filled now, kept, or read-only, the confirmation repeats it.
  // If it stays empty, so does the confirmation.
  if (found.role === 'confirm' && found.pairOf) return { value: found.pairOf.value, literal: true };
  if (found.role === 'current' && key === 'password') {
    const other = (ctx.request.samples?.password ?? []).find(sample => sample !== ctx.values.password);
    if (other) return { value: other, literal: false };
  }
  return undefined;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}/;
const addDays = (date: string, days: number) => { const day = new Date(`${date}T00:00:00Z`); day.setUTCDate(day.getUTCDate() + days); return day.toISOString().slice(0, 10); };

// A country field that holds two or three letters takes the country's code: "US", "USA". Every
// generated country has codes; another one keeps its name.
function countryCode(el: Control, country: string): string {
  const codes = COUNTRY_CODES[country];
  const length = isInput(el) ? el.maxLength : -1;
  return codes && (length === 2 || length === 3) ? codes[length - 2] : country;
}

// Measurements and references are shaped by their field; numbers get the page's decimal separator.
function shapedValue(ctx: FillContext, el: Control, found: Classification, key: FieldKey): string {
  if (key === 'measurement') return measurementValue(el, found, ctx.random(el));
  if (key === 'country') return countryCode(el, ctx.values.country);
  if (key === 'reference') return referenceValue(el, found, ctx.random(el), ctx.values.date.slice(0, 4));
  if (DATE_FIELD_TYPES.has(key)) return formatDateText(el, ctx.values[key]);
  return DECIMAL_KEYS.has(key) ? localizeDecimal(el, ctx.values[key]) : ctx.values[key];
}

// An end date lands one to fourteen days after its start date (and no later than its max) when
// generated values or limits would put it earlier.
function afterStart(el: Control, found: Classification, resolved: Resolved, value: string, random: Random): string {
  const start = found.role === 'end' && !resolved.literal ? found.after?.value ?? '' : '';
  if (!ISO_DATE.test(start) || !ISO_DATE.test(value) || !(el instanceof HTMLInputElement) || !['date', 'datetime-local'].includes(el.type) || value.slice(0, 10) > start.slice(0, 10)) return value;
  const first = addDays(start.slice(0, 10), 1);
  const last = el.max && ISO_DATE.test(el.max) ? el.max.slice(0, 10) : addDays(first, 13);
  if (first > last) return value;
  const span = Math.round((Date.parse(`${last}T00:00:00Z`) - Date.parse(`${first}T00:00:00Z`)) / 86400000);
  const day = addDays(first, random(Math.min(span, 13) + 1));
  return el.type === 'date' ? day : `${day}${value.slice(10) || 'T12:00'}`;
}

type Resolution = { resolved: Resolved; source: string; aiSuggestion?: string } | { done: ControlRun };

// Decides the value for a text, number, date or select control: a custom rule, a recognized type,
// an AI suggestion, or generic data.
function resolveValue(ctx: FillContext, el: Control, index: number, sig: ControlSignals): Resolution {
  const { request } = ctx;
  let resolved: Resolved | undefined;
  let source = 'local data';
  let aiSuggestion: string | undefined;
  const customRule = findCustomRule(request.custom, el, sig.signals);
  if (customRule) { resolved = { value: customRule.value, literal: true, generic: false, ai: false }; source = 'your custom rule'; }
  else {
    const found = classificationOf(ctx.classifications, el);
    const key = usableKey(found, request.fillUnknown);
    const related = key && relatedValue(ctx, found, key);
    if (key) resolved = { value: related ? related.value : shapedValue(ctx, el, found, key), key, literal: !!related?.literal, generic: false, ai: false };
  }
  // Contextual text must reach AI even when a familiar label matched a local sample.
  // Explicit rules and coherent identity/contact fields keep their existing generators.
  const contextual = resolved?.key && CONTEXTUAL_KEYS.includes(resolved.key);
  if (request.aiRequired && contextual && !(el instanceof HTMLSelectElement) && (el instanceof HTMLTextAreaElement || ['text', 'search'].includes(el.type))) resolved = undefined;
  if (!resolved && request.fillUnknown && !(el instanceof HTMLSelectElement)) {
    const field = unknownField(el, index, sig);
    if (request.mode === 'scan') {
      if ((request.overwrite || !el.value.trim()) && ctx.result.unknown!.length < 30) ctx.result.unknown!.push(field);
    } else {
      aiSuggestion = suggestion(ctx, el, field);
      if (aiSuggestion !== undefined) { resolved = { value: aiSuggestion, literal: false, generic: true, ai: true }; source = 'AI data'; }
      else if (request.aiRequired) return { done: el.value.trim() && !request.overwrite ? run('preserved') : run('unmatched', { aiSkipped: true }) };
    }
  }
  if (request.mode === 'scan') return { done: NONE };
  if (!resolved && request.fillUnknown) {
    const fallback = fallbackValue(ctx, el);
    resolved = { value: fallback.value, literal: false, generic: fallback.generic, ai: false };
  }
  if (!resolved?.value) return { done: run('unmatched') };
  if (el.value.trim() && !request.overwrite) return { done: run('preserved') };
  return { resolved, source, aiSuggestion };
}

function fillValue(ctx: FillContext, el: Control, index: number, sig: ControlSignals): ControlRun {
  const resolution = resolveValue(ctx, el, index, sig);
  if ('done' in resolution) return resolution.done;
  const { resolved, source, aiSuggestion } = resolution;
  let fitted = fitValue(ctx, el, resolved);
  // Other ways to write the value, for a field whose rules reject the first one. Your own values
  // and AI suggestions are written as they are.
  const reshape = !resolved.literal && !resolved.ai && !(el instanceof HTMLSelectElement);
  // Dates are reshaped from the ISO date, not from the format the field first got.
  const original = resolved.key && DATE_FIELD_TYPES.has(resolved.key) && !resolved.generic ? ctx.values[resolved.key] : fitted ?? resolved.value;
  const otherPhones = resolved.key === 'phone' ? Object.values(ctx.request.phones ?? {}) : [];
  const options = reshape ? alternatives(el, resolved.generic ? undefined : resolved.key, original, ctx.random(el), otherPhones) : [];
  if (reshape) fitted = firstValid(el, [...(fitted === undefined ? [] : [fitted]), ...options]) ?? fitted;
  if (fitted === undefined) return run('invalid', { source });
  const value = afterStart(el, classificationOf(ctx.classifications, el), resolved, fitted, ctx.random(el));
  rememberAlternatives(el, options.filter(option => option !== value));
  ctx.touched.add(el);
  setNativeValue(el, value);
  if (el.value !== value) return run('invalid', { source });
  if (aiSuggestion !== undefined && ctx.result.used) ctx.result.used[`field_${index}`] = aiSuggestion;
  if (resolved.key && !resolved.literal) ctx.filled.set(el, resolved.key);
  return run('filled', { source });
}

function processControl(ctx: FillContext, el: Control, index: number): ControlRun {
  const { request } = ctx;
  if (!isFillable(el, ctx.visible.get(el)) || shouldExclude(el, ctx.exclusions)) return NONE;
  if (isInput(el) && ['hidden', 'file', 'submit', 'button', 'reset', 'image'].includes(el.type)) return NONE;
  if (ctx.traps.has(el)) return run('none', { reason: 'Hidden trap for bots' });
  // When the page keeps its fields in forms, a checkbox outside them is a page setting, not data.
  if (isChoice(el) && !el.form && ctx.inForms) return run('none', { reason: 'Outside the page\'s forms' });
  if (isInput(el) && el.type === 'password' && !request.passwords) return NONE;
  const sig = controlSignals(el);
  const { type } = classificationOf(ctx.classifications, el);
  // Card, one-time-code, bank and consent fields are recognized so they are never filled.
  if (isSensitive(type)) return NONE;
  if (!request.passwords && (type === 'password' || sig.ac.includes('password') || sig.signals.some(s => PASSWORD.test(s)))) return NONE;
  if (isChoice(el)) return fillChoice(ctx, el, sig.signals);
  return fillValue(ctx, el, index, sig);
}

// With a seed, each field draws from its own stream, keyed by its name and how many fields before
// it share that name, so adding a field elsewhere doesn't change the others.
function fieldRandom(seed: string | undefined, controls: readonly Control[]): (el?: Control) => Random {
  if (!seed?.trim()) return () => secureRandom;
  const streams = new Map<Control, Random>();
  const seen = new Map<string, number>();
  const keys = new Map(controls.map(el => {
    const name = `${el.tagName}|${el instanceof HTMLInputElement ? el.type : ''}|${el.name || el.id}`;
    const count = seen.get(name) ?? 0;
    seen.set(name, count + 1);
    return [el, `${name}|${count}`];
  }));
  return el => {
    if (!el) return secureRandom;
    let stream = streams.get(el);
    if (!stream) { stream = randomFor(seed, keys.get(el) ?? 'field'); streams.set(el, stream); }
    return stream;
  };
}

function tally(result: FillResult, outcome: Outcome) {
  if (outcome !== 'none') result[outcome]++;
}

// The engine's entry point. It runs inside the page, in the extension's isolated world, and
// never submits a form or sends anything off the page.
export function fillPage(request: FillRequest): FillResult {
  const pageState = globalThis as PageState;
  pageState.__devfillerDocumentId ||= crypto.randomUUID();
  const result: FillResult = { filled: 0, preserved: 0, unmatched: 0, invalid: 0, documentId: pageState.__devfillerDocumentId, origin: location.origin };
  if (request.expectedDocument && request.expectedDocument !== result.documentId) return { ...result, stale: true };
  if (request.mode === 'scan') result.unknown = [];
  if (request.suggestions) result.used = {};
  const controls = listControls();
  const visible = new Map(controls.map(el => [el, isVisible(el)]));
  const analysis = analyzePage(controls, visible, request.typeRules ?? []);
  result.forms = analysis.forms;
  if (request.mode === 'classify') {
    result.classified = controls.flatMap((el, index) => { const found = analysis.fields.get(el); return found ? [{ index, type: found.type, confidence: found.confidence }] : []; });
    // Widgets are indexed in document.querySelectorAll(WIDGET_SELECTOR).
    const widgets = Array.from(document.querySelectorAll<HTMLElement>(WIDGET_SELECTOR));
    result.widgets = listWidgets().map(el => { const found = classifyWidget(el); return { index: widgets.indexOf(el), type: found.type, confidence: found.confidence }; });
    return result;
  }
  const exclusions = request.exclusions || { skipSearch: true, skipHeader: true, rules: [] };
  const panel = request.mode === 'scan' ? undefined : (pageState.__devfillerPanel ||= { elements: new Map(), ids: new WeakMap(), reports: new Map(), undo: [] });
  const base = { request, controls, exclusions, panel, result, radioGroups: new Set<string>(), usedText: new Set<string>(), touched: new Set<Control>(), classifications: analysis.fields, visible, random: fieldRandom(request.seed, controls), fresh: request.overwrite && !request.seed?.trim(), filled: new Map(), inForms: controls.some(el => el.form), traps: new Set(controls.filter(isTrap)) };
  if (request.mode === 'inspect') { finalizeReport({ ...base, values: request.values }); return result; }
  const before: Map<Control, ControlSnapshot> | undefined = panel ? new Map(controls.map(el => [el, snapshot(el)])) : undefined;
  if (panel) { panel.reports.clear(); panel.undo = []; }
  if (request.mode !== 'scan') forgetAlternatives();
  const ctx: FillContext = { ...base, values: coherentValues(request, controls, exclusions) };
  controls.forEach((el, index) => {
    let outcome: ControlRun = NONE;
    try {
      outcome = processControl(ctx, el, index);
    } catch {
      // One odd control must not stop the rest of the form from filling.
      outcome = run('invalid', { reason: 'This control could not be filled' });
    } finally {
      tally(result, outcome.outcome);
      if (panel) panel.reports.set(el, controlReport(ctx, el, outcome));
    }
  });
  alignPhones(ctx);
  if (panel && before) { finishFill(ctx, before); finalizeReport(ctx); }
  return result;
}
