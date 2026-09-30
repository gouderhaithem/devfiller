import type { Control } from './types';
import { NOT_SCALE_ANSWER, SCALE_ANSWER, TRAP } from './dictionary';
import { normalize } from './normalize';
import { placeholderShape } from './placeholder';

// Input types the engine never touches or reports.
export const OMITTED_TYPES: readonly string[] = ['hidden','submit','button','reset','image'];
export const DATE_TYPES: readonly string[] = ['date','datetime-local','month','week','time'];
export const TEXT_TYPES: readonly string[] = ['text','search','email','tel','url','password'];

// Open shadow roots, nested ones included, in document order. Closed roots can't be reached.
function shadowRoots(root: Document | ShadowRoot): ShadowRoot[] {
  return Array.from(root.querySelectorAll('*')).flatMap(el => el.shadowRoot ? [el.shadowRoot, ...shadowRoots(el.shadowRoot)] : []);
}

// The page's controls, then those inside open shadow roots, so light-DOM indexes never shift.
export function listControls(includeShadow = true): Control[] {
  const roots = includeShadow ? [document, ...shadowRoots(document)] : [document];
  return roots.flatMap(root => Array.from(root.querySelectorAll<Control>('input, textarea, select')));
}

// An id is looked up in the element's own tree: a label inside a shadow root points inside it.
function byId(el: Element, id: string): Element | null {
  const root = el.getRootNode();
  return (root instanceof Document || root instanceof ShadowRoot ? root.getElementById(id) : null) ?? document.getElementById(id);
}
const idsText = (el: Element, ids: string | null) => (ids || '').split(/\s+/).filter(Boolean).map(id => byId(el, id)?.textContent || '').join(' ');

export const isInput = (el: Control): el is HTMLInputElement => el instanceof HTMLInputElement;
export const isChoice = (el: Control): el is HTMLInputElement => isInput(el) && (el.type === 'checkbox' || el.type === 'radio');
export const isVisible = (el: Control) => !!el.getClientRects().length && getComputedStyle(el).visibility === 'visible';
const isReadOnly = (el: Control) => 'readOnly' in el && el.readOnly;
const isDisabled = (el: Control) => el.disabled || el.matches(':disabled');

// Date pickers from the common libraries: bootstrap, jQuery UI, flatpickr, Pikaday, react-datepicker,
// MUI, Ant Design, Element. Many are read-only so people use the calendar; a fill writes them anyway.
// Class tokens are matched whole: a "datepicker-row" wrapper doesn't make a total a date.
const PICKER_INPUT = /^(?:(?:js-|form-)?date-?picker(?:-input)?|datetimepicker|hasdatepicker|flatpickr-input|pikaday|daterangepicker|mat-datepicker-input|air-datepicker|litepicker|duet-date__input)$/i;
const PICKER_WRAPPER = /^(?:react-datepicker__input-container|muipickerstextfield-root|muipickersinputbase-root|ant-picker-input|el-date-editor|vdp-datepicker)$/i;
const TIME_ONLY = /^(?:time-?picker(?:-input)?|ui-timepicker-input|ant-picker-time|el-date-editor--time(?:-select)?)$/i;
const PICKER_TYPES: readonly string[] = ['text', 'tel', 'search', ''];
const tokens = (node: Element) => Array.from(node.classList);
// The hidden input a flatpickr alt input stands for: it holds the date the form submits.
export const pickerTarget = (el: Control): HTMLInputElement | undefined => {
  const previous = el.previousElementSibling;
  return previous instanceof HTMLInputElement && previous.type === 'hidden' && previous.classList.contains('flatpickr-input') ? previous : undefined;
};
export function isDatePicker(el: Control): boolean {
  if (!(el instanceof HTMLInputElement) || !PICKER_TYPES.includes(el.type)) return false;
  if (el.getAttribute('data-provide') === 'datepicker' || el.hasAttribute('data-date-format') || el.hasAttribute('data-datepicker') || pickerTarget(el)) return true;
  const own = tokens(el), around = [el.parentElement, el.parentElement?.parentElement].flatMap(node => node ? tokens(node) : []);
  if ([...own, ...around].some(token => TIME_ONLY.test(token))) return false;
  if (own.some(token => PICKER_INPUT.test(token)) || around.some(token => PICKER_WRAPPER.test(token))) return true;
  // An empty read-only field that shows a date format is a picker whatever its library.
  return el.readOnly && !el.value && placeholderShape(el.placeholder)?.kind === 'date';
}

// Controls the user could type into or click right now.
// `visible` lets a fill pass in visibility measured before it wrote anything: checking styles
// after each write forces the browser to recalculate them, which is slow on large forms.
export const isFillable = (el: Control, visible = isVisible(el)) => !isDisabled(el) && (!isReadOnly(el) || isDatePicker(el)) && !el.closest('[inert]') && visible;
export const isEditableChoice = (el: HTMLInputElement, visible = isVisible(el)) => !isDisabled(el) && !el.closest('[inert]') && visible;

export const labelText = (el: Control) => Array.from(el.labels || []).map(label => label.textContent || '').join(' ');
export const labelledByText = (el: Control) => idsText(el, el.getAttribute('aria-labelledby'));
export const legendText = (el: Control) => normalize(el.closest('fieldset')?.querySelector('legend')?.textContent || '');

// The last autocomplete token names the field: "shipping postal-code" → "postal-code".
export const autocompleteToken = (el: Control) => el.autocomplete?.trim().split(/\s+/).filter(token => token !== 'webauthn').at(-1) || '';

export interface ControlSignals { ac: string; label: string; labelledBy: string; signals: string[] }

// The signals classification reads, strongest first.
export function controlSignals(el: Control): ControlSignals {
  const label = labelText(el);
  const labelledBy = labelledByText(el);
  const signals = [label, el.getAttribute('aria-label') || '', labelledBy, el.name, el.id, el.getAttribute('placeholder') || ''].map(normalize).filter(Boolean);
  return { ac: autocompleteToken(el), label, labelledBy, signals };
}

// The signals exclusions and skip reasons read: every label on its own, then all of them together.
export function fieldSignals(el: Control): string[] {
  const labels = Array.from(el.labels || []).map(label => label.textContent || '');
  return [...labels, labels.join(' '), labelledByText(el), el.getAttribute('aria-label') || '', el.name, el.id, el.getAttribute('placeholder') || ''].map(normalize).filter(Boolean);
}

// The name the side panel shows for a field.
export function displayLabel(el: Control): string {
  return (labelText(el) || el.getAttribute('aria-label') || labelledByText(el).trim() || el.getAttribute('placeholder') || el.name || el.id || el.type || 'Unnamed field').trim().slice(0, 160);
}

export type SignalSource = 'autocomplete' | 'type' | 'inputmode' | 'label' | 'aria-label' | 'aria-labelledby' | 'placeholder' | 'title' | 'nearby' | 'name' | 'id' | 'legend' | 'options' | 'form' | 'unit' | 'rule' | 'format';
export interface Signal { source: SignalSource; raw: string; text: string }

const CONTROLS = 'input, select, textarea, button';
const clip = (text: string) => text.replace(/\s+/g, ' ').trim().slice(0, 120);

// A label's own words, without the text of a select or textarea it wraps.
function ownText(root: Element): string {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const parts: string[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.parentElement?.closest('select, textarea, option, script, style')) parts.push(node.textContent || '');
  }
  return clip(parts.join(' '));
}

const holdsControl = (node: Node) => node instanceof Element && (node.matches(CONTROLS) || !!node.querySelector(CONTROLS));

function siblingText(start: Node, forward: boolean): string {
  for (let node = forward ? start.nextSibling : start.previousSibling; node; node = forward ? node.nextSibling : node.previousSibling) {
    if (holdsControl(node)) return '';
    const text = clip(node.textContent || '');
    if (text) return text;
  }
  return '';
}

// Text a person reads next to an unlabelled control: the text just before it (after it for a
// checkbox or radio), or the previous cell of a table row. Climbs out of wrappers that hold only
// this control.
export function nearbyText(el: Control): string {
  let anchor: Element = el;
  for (let depth = 0; depth < 3 && anchor.parentElement; depth++) {
    const text = (isChoice(el) && siblingText(anchor, true)) || siblingText(anchor, false);
    if (text) return text;
    const parent: Element = anchor.parentElement;
    if (parent.matches('td, th')) {
      const cell = parent.previousElementSibling;
      return cell && !holdsControl(cell) ? clip(cell.textContent || '') : '';
    }
    if (parent.querySelectorAll(CONTROLS).length > 1 || parent.matches('form, fieldset, body')) return '';
    anchor = parent;
  }
  return '';
}

// Radio groups by form (or, outside forms, by the document or shadow root) and name, built once
// per pass so large forms don't rescan every radio.
export const radioScope = (el: HTMLInputElement): Node => el.form ?? el.getRootNode();
let radioIndex: Map<Node, Map<string, HTMLInputElement[]>> | undefined;
export function indexRadios(controls: readonly Control[] | undefined) {
  if (!controls) { radioIndex = undefined; return; }
  radioIndex = new Map();
  for (const el of controls) {
    if (!(el instanceof HTMLInputElement) || el.type !== 'radio' || !el.name) continue;
    const byName = radioIndex.get(radioScope(el)) ?? new Map<string, HTMLInputElement[]>();
    radioIndex.set(radioScope(el), byName);
    const members = byName.get(el.name) ?? [];
    members.push(el);
    byName.set(el.name, members);
  }
}

// The other radios answering the same question.
export function radioGroup(el: HTMLInputElement): HTMLInputElement[] {
  if (!el.name) return [el];
  const indexed = radioIndex?.get(radioScope(el))?.get(el.name);
  if (indexed) return indexed;
  const scope = radioScope(el) as ParentNode;
  return Array.from(scope.querySelectorAll<HTMLInputElement>('input[type="radio"]')).filter(radio => radio.name === el.name && radioScope(radio) === radioScope(el));
}

// The answers a field offers: a select's options (without an empty placeholder) or the labels of
// a radio group's buttons.
export function optionTexts(el: Control): string[] {
  if (el instanceof HTMLSelectElement) return Array.from(el.options).filter((option, i) => i > 0 || option.value !== '').map(option => clip(option.textContent || ''));
  if (isChoice(el) && el.type === 'radio') return radioGroup(el).map(radio => Array.from(radio.labels || []).map(ownText).join(' ') || radio.getAttribute('aria-label') || '').filter(Boolean);
  return [];
}

// A radio group's question: its fieldset legend or its radiogroup's accessible name.
function groupText(el: Control): string {
  const group = el.closest('[role="radiogroup"], fieldset');
  if (!group) return '';
  return clip(group.getAttribute('aria-label') || idsText(group, group.getAttribute('aria-labelledby')) || group.querySelector('legend')?.textContent || '');
}

const MAX_CAPTIONED = 30;
// The question over choices that aren't in a fieldset: the text just before the element that holds
// the group ("Have you ever been diagnosed with…" above a row of checkboxes).
function choiceCaption(el: HTMLInputElement): string {
  const sameGroup = (other: Element) => other instanceof HTMLInputElement && other.type === el.type && (el.type === 'checkbox' || other.name === el.name);
  let node: Element = el;
  for (let depth = 0; depth < 3 && node.parentElement; depth++) {
    const parent: Element = node.parentElement;
    const inside = parent.querySelectorAll(CONTROLS);
    // A caption sits over a handful of choices; a container of dozens is a layout, not a group.
    if (parent.matches('form, fieldset, body') || inside.length > MAX_CAPTIONED || !Array.from(inside).every(sameGroup)) return '';
    node = parent;
    const text = siblingText(node, false);
    if (text) return text;
  }
  return '';
}

// Answers that read as a scale: worded ("Strongly disagree … Strongly agree") or numbered, 1 to 5 up
// to 0 to 10. Months and days count further, so they are never a scale.
export function isScale(answers: readonly string[]): 'words' | 'numbers' | undefined {
  if (answers.length < 4) return undefined;
  const texts = answers.map(normalize);
  if (texts.some(text => NOT_SCALE_ANSWER.test(text))) return undefined;
  if (texts.filter(text => SCALE_ANSWER.test(text)).length >= Math.ceil(0.75 * texts.length)) return 'words';
  const numbers = texts.map(text => text.match(/^\d+/)?.[0]).filter(Boolean).map(Number);
  const counting = numbers.length === texts.length && numbers.every((n, i) => i === 0 || n === numbers[i - 1] + 1) && numbers[0] <= 1 && numbers[numbers.length - 1] <= 10;
  return counting ? 'numbers' : undefined;
}

// Honeypots: fields hidden from people (aria-hidden, placed off the page) or that say to leave them
// empty. A person never fills them; a bot does, and the page then rejects the form.
// A modal library hides the rest of the page with aria-hidden too, so that only counts with tabindex="-1".
export function isTrap(el: Control): boolean {
  if (el.getAttribute('tabindex') === '-1' && el.closest('[aria-hidden="true"]')) return true;
  const hints = [el.getAttribute('placeholder'), labelText(el), el.getAttribute('aria-label'), el.getAttribute('title')];
  if (hints.some(hint => TRAP.test(normalize(hint || '')))) return true;
  const box = el.getBoundingClientRect();
  return box.width > 0 && (box.right + scrollX <= 0 || box.bottom + scrollY <= 0);
}

const FILLER = new Set(['field', 'fld', 'input', 'inp', 'text', 'txt', 'ctl', 'ctrl', 'mat', 'form', 'el', 'elem', 'control', 'widget', 'item']);
// Generated names carry no meaning: field1, input_7, mat-input-3, ":r5:", UUIDs.
export function isMeaningless(raw: string): boolean {
  if (/\b[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\b/i.test(raw)) return true;
  const tokens = normalize(raw).split(' ').filter(Boolean);
  return !tokens.length || tokens.every(token => /^\d+$/.test(token) || /^[a-z]{1,2}\d+$/.test(token) || FILLER.has(token.replace(/\d+$/, '')));
}

// Every signal classification can read, with its source. Values are never read.
export function describeSignals(el: Control): Signal[] {
  const signals: Signal[] = [];
  const add = (source: SignalSource, raw: string | null | undefined) => {
    const text = raw ? normalize(raw) : '';
    if (text) signals.push({ source, raw: clip(raw!), text });
  };
  const choice = isChoice(el);
  const radio = choice && el.type === 'radio';
  // A radio's own label is one of the answers ("Male"), so its group names the field.
  if (!radio) {
    for (const label of Array.from(el.labels || [])) add('label', ownText(label));
    add('aria-label', el.getAttribute('aria-label'));
    add('aria-labelledby', labelledByText(el));
  }
  add('placeholder', el.getAttribute('placeholder'));
  // A select's empty first option ("Select country") works as its placeholder.
  if (el instanceof HTMLSelectElement && el.options[0] && !el.options[0].value) add('placeholder', el.options[0].textContent);
  add('title', el.getAttribute('title'));
  if (!signals.some(signal => signal.source === 'label' || signal.source === 'aria-label' || signal.source === 'aria-labelledby')) add('nearby', radio ? '' : nearbyText(el));
  if (!isMeaningless(el.name)) add('name', el.name);
  if (!isMeaningless(el.id)) add('id', el.id);
  // A radio group's question, else the heading just above it. A checkbox reads its fieldset's legend
  // and the heading just above its own group, which may sit inside that larger fieldset.
  add('legend', radio ? groupText(el) || choiceCaption(el) : el.closest('fieldset')?.querySelector('legend')?.textContent);
  if (choice && !radio) add('legend', choiceCaption(el));
  if (isInput(el)) { add('type', el.type); add('inputmode', el.getAttribute('inputmode')); }
  add('autocomplete', el.getAttribute('autocomplete'));
  return signals;
}
