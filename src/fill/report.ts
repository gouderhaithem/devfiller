import { fields } from '../data';
import type { ControlSnapshot, Detection, FieldReport } from '../panel-types';
import type { Control, ControlRun, FillContext } from './types';
import { PASSWORD } from './dictionary';
import { classificationOf, isSensitive, THRESHOLDS, usableKey, type Classification, type Evidence, type FieldType } from './classify';
import { controlSignals, displayLabel, fieldSignals, isChoice, isVisible, OMITTED_TYPES } from './extract';
import { findCustomRule } from './rules';
import { shouldExclude } from './exclude';
import { snapshot } from './apply';

const EXCLUDED = 'Excluded by your settings';
const UNSURE = 'Not sure this is';

// Why a control is skipped before any value is chosen, "omit" for controls the panel never lists,
// or "" when it can be filled.
export function skipReason(ctx: FillContext, el: Control): string {
  const { request } = ctx;
  if (el instanceof HTMLInputElement && OMITTED_TYPES.includes(el.type)) return 'omit';
  if (!(ctx.visible.get(el) ?? isVisible(el))) return 'omit';
  if (el.disabled || el.matches(':disabled')) return 'Disabled field';
  if ('readOnly' in el && el.readOnly) return 'Read-only field';
  if (el.closest('[inert]')) return 'Inactive section';
  if (shouldExclude(el, ctx.exclusions)) return EXCLUDED;
  if (el instanceof HTMLInputElement && el.type === 'file') return 'File uploads are not supported';
  const ac = el.autocomplete || '';
  const { type } = classificationOf(ctx.classifications, el);
  if (type === 'skip:card' || type === 'skip:otp') return 'Protected payment or verification field';
  if (type === 'skip:iban') return 'Protected bank account field';
  if (type === 'skip:consent') return 'Consent field stays untouched';
  if (type === 'skip:session') return 'Session choice stays untouched';
  if (!request.passwords && (el.type === 'password' || type === 'password' || ac.includes('password') || fieldSignals(el).some(signal => PASSWORD.test(signal)))) return 'Password filling disabled';
  if (isChoice(el) && !request.fillUnknown) return 'Unknown-field filling disabled';
  return '';
}

const TYPE_LABELS: Readonly<Record<string, string>> = { ...Object.fromEntries(fields), unknown: 'Unknown', 'skip:card': 'Card details', 'skip:otp': 'One-time code', 'skip:iban': 'Bank details', 'skip:consent': 'Consent', 'skip:session': 'Session choice' };
const SOURCE_LABELS: Readonly<Record<Evidence['source'], string>> = { autocomplete: 'autocomplete', type: 'type', inputmode: 'inputmode', label: 'label', 'aria-label': 'aria-label', 'aria-labelledby': 'accessible name', placeholder: 'placeholder', title: 'title', nearby: 'text beside it', name: 'name', id: 'id', legend: 'section', options: 'options', form: 'form' };
const typeLabel = (type: FieldType | string) => TYPE_LABELS[type] ?? type;

// "autocomplete=tel", "label “Téléphone”", "against: type=email".
function describeEvidence(item: Evidence): string {
  const source = SOURCE_LABELS[item.source];
  const text = ['autocomplete', 'type', 'inputmode'].includes(item.source) ? `${source}=${item.signal}` : item.source === 'form' || item.source === 'options' ? item.signal : `${source} “${item.signal.slice(0, 60)}”`;
  return item.weight < 0 ? `against: ${text}` : text;
}

export function detection(classification: Classification): Detection {
  const { type, confidence, candidates, evidence } = classification;
  const alternatives = candidates.filter(candidate => candidate.type !== type).slice(0, 2).map(candidate => `${typeLabel(candidate.type)} ${Math.round(candidate.score * 100)}%`);
  return { type, label: typeLabel(type), confidence: Math.round(confidence * 100) / 100, evidence: evidence.slice(0, 5).map(describeEvidence), alternatives };
}

export function reportFor(ctx: FillContext, el: Control): FieldReport {
  const panel = ctx.panel!;
  let id = panel.ids.get(el);
  if (!id) { id = crypto.randomUUID(); panel.ids.set(el, id); }
  panel.elements.set(id, el);
  const reason = skipReason(ctx, el);
  // Say up front when a fill will leave the field alone, but keep it open for a custom rule.
  const unmatched = !reason && willNotMatch(ctx, el) ? unmatchedReason(ctx, el) : '';
  return { id, label: displayLabel(el), status: reason || unmatched ? 'skipped' : 'ready', reason: reason || unmatched || 'Ready to fill', editable: !reason || reason === EXCLUDED, detected: detection(classificationOf(ctx.classifications, el)) };
}

// With guessing off, a field without a custom rule or a confident type gets no value.
function willNotMatch(ctx: FillContext, el: Control): boolean {
  if (ctx.request.fillUnknown || isChoice(el)) return false;
  if (findCustomRule(ctx.request.custom, el, controlSignals(el).signals)) return false;
  return !usableKey(classificationOf(ctx.classifications, el), false);
}

// A low-confidence guess is only used when the user allows guessing.
function unmatchedReason(ctx: FillContext, el: Control): string {
  const found = classificationOf(ctx.classifications, el);
  if (ctx.request.fillUnknown || found.type === 'unknown' || isSensitive(found.type) || found.confidence >= THRESHOLDS.medium) return 'No matching generator';
  return `${UNSURE} ${typeLabel(found.type).toLowerCase()} (${Math.round(found.confidence * 100)}%). Turn on Fill unknown fields to fill it.`;
}

// The report for a control the fill loop just handled.
export function controlReport(ctx: FillContext, el: Control, run: ControlRun): FieldReport {
  const report = reportFor(ctx, el);
  if (report.status !== 'ready') return report;
  if (run.outcome === 'invalid') return { ...report, status: 'incompatible', reason: 'The generated value does not fit this control' };
  if (run.outcome === 'filled') return { ...report, status: 'filled', reason: `Filled with ${run.source}` };
  const reason = run.aiSkipped ? 'AI data is not ready for this field. Click Fill again.'
    : run.outcome === 'preserved' ? 'Existing value preserved'
    : run.outcome === 'unmatched' ? unmatchedReason(ctx, el) : run.reason ?? 'Not filled';
  return { ...report, status: 'skipped', reason };
}

const isPasswordLike = (el: Control) => el.type === 'password' || !!el.autocomplete?.includes('password') || fieldSignals(el).some(signal => PASSWORD.test(signal));

// Records undo entries for what changed and the values the panel shows. Passwords are never shown.
export function finishFill(ctx: FillContext, before: Map<Control, ControlSnapshot>) {
  const panel = ctx.panel!;
  for (const el of ctx.controls) {
    const original = before.get(el)!, after = snapshot(el);
    if (ctx.touched.has(el) && JSON.stringify(original) !== JSON.stringify(after)) panel.undo.push({ element: el, before: original, after });
    const report = panel.reports.get(el);
    if (report && el instanceof HTMLInputElement && el.type === 'radio' && ctx.touched.has(el)) {
      report.status = el.checked ? 'filled' : 'skipped';
      report.reason = el.checked ? 'Selected in this group' : 'Another option selected in this group';
    }
    if (report?.status === 'filled') {
      report.value = isPasswordLike(el) ? 'Password generated' : ('checked' in after ? after.checked ? 'Selected' : 'Not selected' : el.value.slice(0, 180));
    }
  }
}

// The field list for the side panel. A fresh skip reason always wins; otherwise the result of the
// last fill stays until settings make it out of date.
export function finalizeReport(ctx: FillContext) {
  const { panel, request, result } = ctx;
  if (!panel) return;
  const live = new Set(ctx.controls);
  for (const [id, el] of panel.elements) if (!live.has(el)) { panel.elements.delete(id); panel.reports.delete(el); }
  result.fields = ctx.controls.filter(el => skipReason(ctx, el) !== 'omit').map(el => {
    const fresh = reportFor(ctx, el), previous = panel.reports.get(el);
    if (fresh.status === 'skipped' || !previous) return fresh;
    if (previous.reason === EXCLUDED || ((previous.reason === 'No matching generator' || previous.reason.startsWith(UNSURE)) && request.fillUnknown)) return fresh;
    if (previous.reason === 'Existing value preserved' && request.overwrite) return fresh;
    return { ...previous, label: fresh.label, editable: fresh.editable };
  });
  result.canUndo = panel.undo.some(entry => entry.element.isConnected);
}
