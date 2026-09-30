import type { ControlSnapshot } from '../panel-types';
import type { Control, ControlRun, FillContext, FillRequest, FillResult, Outcome, PageState, UnknownField } from './types';
import { CONSENT, CONTEXTUAL_KEYS, MACHINE_ID, PASSWORD } from './dictionary';
import { controlSignals, isChoice, isEditableChoice, isFillable, isInput, legendText, listControls, type ControlSignals } from './extract';
import { shouldExclude } from './exclude';
import { classificationOf, classifyControl, isSensitive, usableKey } from './classify';
import { coherentValues, fallbackValue, fitValue, random, type Resolved } from './generate';
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
  const group = `${Array.from(document.forms).indexOf(el.form!)}:${el.name || `unnamed-${controls.indexOf(el)}`}`;
  if (ctx.radioGroups.has(group)) return run('none', { reason: 'Radio group handled separately' });
  ctx.radioGroups.add(group);
  const members = controls.filter((c): c is HTMLInputElement => c instanceof HTMLInputElement && c.type === 'radio' && c.form === el.form && (el.name ? c.name === el.name : c === el));
  if (members.some(member => shouldExclude(member, ctx.exclusions))) return run('none', { reason: 'Another option in this group is excluded' });
  if (!request.overwrite && members.some(c => c.checked)) return run('preserved');
  const candidates = members.filter(c => isEditableChoice(c) && !isSensitive(classificationOf(ctx.classifications, c).type) && !CONSENT.test(normalize([c.name, c.id, c.getAttribute('aria-label') || '', ...Array.from(c.labels || []).map(l => l.textContent || '')].join(' '))));
  const different = candidates.filter(c => !c.checked);
  const choices = request.overwrite && different.length ? different : candidates;
  if (!choices.length) return run('none', { reason: 'No option in this group can be selected' });
  const target = choices[random(choices.length)];
  for (const member of controls) if (member === target || (target.name && member instanceof HTMLInputElement && member.type === 'radio' && member.form === target.form && member.name === target.name)) ctx.touched.add(member);
  setNativeChecked(target, true);
  return run('filled');
}

// Checkboxes and radio groups get a random choice, and only when "Fill unknown fields" is on.
function fillChoice(ctx: FillContext, el: HTMLInputElement, signals: readonly string[]): ControlRun {
  const { request } = ctx;
  if (request.mode === 'scan') return NONE;
  if (!request.fillUnknown) return NONE;
  if (signals.some(s => CONSENT.test(s)) || CONSENT.test(legendText(el))) return run('none', { reason: 'Consent field stays untouched' });
  if (el.type === 'radio') return fillRadioGroup(ctx, el);
  if (el.checked && !request.overwrite) return run('preserved');
  ctx.touched.add(el);
  setNativeChecked(el, !el.checked);
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
    const key = usableKey(classificationOf(ctx.classifications, el), request.fillUnknown);
    if (key) resolved = { value: ctx.values[key], key, literal: false, generic: false, ai: false };
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
  const value = fitValue(ctx, el, resolved);
  if (value === undefined) return run('invalid', { source });
  ctx.touched.add(el);
  setNativeValue(el, value);
  if (el.value !== value) return run('invalid', { source });
  if (aiSuggestion !== undefined && ctx.result.used) ctx.result.used[`field_${index}`] = aiSuggestion;
  return run('filled', { source });
}

function processControl(ctx: FillContext, el: Control, index: number): ControlRun {
  const { request } = ctx;
  if (!isFillable(el) || shouldExclude(el, ctx.exclusions)) return NONE;
  if (isInput(el) && ['hidden', 'file', 'submit', 'button', 'reset', 'image'].includes(el.type)) return NONE;
  if (isInput(el) && el.type === 'password' && !request.passwords) return NONE;
  const sig = controlSignals(el);
  const { type } = classificationOf(ctx.classifications, el);
  // Card, one-time-code, bank and consent fields are recognized so they are never filled.
  if (isSensitive(type)) return NONE;
  if (!request.passwords && (type === 'password' || sig.ac.includes('password') || sig.signals.some(s => PASSWORD.test(s)))) return NONE;
  if (isChoice(el)) return fillChoice(ctx, el, sig.signals);
  return fillValue(ctx, el, index, sig);
}

function tally(result: FillResult, outcome: Outcome) {
  if (outcome !== 'none') result[outcome]++;
}

// The engine's entry point. It runs inside the page, in the extension's isolated world, and
// never submits a form or sends anything off the page.
export function fillPage(request: FillRequest): FillResult {
  const pageState = globalThis as PageState;
  pageState.__formlyDocumentId ||= crypto.randomUUID();
  const result: FillResult = { filled: 0, preserved: 0, unmatched: 0, invalid: 0, documentId: pageState.__formlyDocumentId, origin: location.origin };
  if (request.expectedDocument && request.expectedDocument !== result.documentId) return { ...result, stale: true };
  if (request.mode === 'scan') result.unknown = [];
  if (request.suggestions) result.used = {};
  const controls = listControls();
  if (request.mode === 'classify') {
    result.classified = controls.flatMap((el, index) => { const found = classifyControl(el); return found ? [{ index, type: found.type, confidence: found.confidence }] : []; });
    return result;
  }
  const exclusions = request.exclusions || { skipSearch: true, skipHeader: true, rules: [] };
  const panel = request.mode === 'scan' ? undefined : (pageState.__formlyPanel ||= { elements: new Map(), ids: new WeakMap(), reports: new Map(), undo: [] });
  const base = { request, controls, exclusions, panel, result, radioGroups: new Set<string>(), usedText: new Set<string>(), touched: new Set<Control>(), classifications: new Map() };
  if (request.mode === 'inspect') { finalizeReport({ ...base, values: request.values }); return result; }
  const before: Map<Control, ControlSnapshot> | undefined = panel ? new Map(controls.map(el => [el, snapshot(el)])) : undefined;
  if (panel) { panel.reports.clear(); panel.undo = []; }
  const ctx: FillContext = { ...base, values: coherentValues(request, controls, exclusions) };
  controls.forEach((el, index) => {
    let outcome: ControlRun = NONE;
    try {
      outcome = processControl(ctx, el, index);
      tally(result, outcome.outcome);
    } finally {
      if (panel) panel.reports.set(el, controlReport(ctx, el, outcome));
    }
  });
  if (panel && before) { finishFill(ctx, before); finalizeReport(ctx); }
  return result;
}
