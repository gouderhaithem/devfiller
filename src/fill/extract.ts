import type { Control } from './types';
import { normalize } from './normalize';

// Input types the engine never touches or reports.
export const OMITTED_TYPES: readonly string[] = ['hidden','submit','button','reset','image'];
export const DATE_TYPES: readonly string[] = ['date','datetime-local','month','week','time'];
export const TEXT_TYPES: readonly string[] = ['text','search','email','tel','url','password'];

export function listControls(): Control[] {
  return Array.from(document.querySelectorAll<Control>('input, textarea, select'));
}

export const isInput = (el: Control): el is HTMLInputElement => el instanceof HTMLInputElement;
export const isChoice = (el: Control): el is HTMLInputElement => isInput(el) && (el.type === 'checkbox' || el.type === 'radio');
export const isVisible = (el: Control) => !!el.getClientRects().length && getComputedStyle(el).visibility === 'visible';
const isReadOnly = (el: Control) => 'readOnly' in el && el.readOnly;
const isDisabled = (el: Control) => el.disabled || el.matches(':disabled');

// Controls the user could type into or click right now.
// `visible` lets a fill pass in visibility measured before it wrote anything: checking styles
// after each write forces the browser to recalculate them, which is slow on large forms.
export const isFillable = (el: Control, visible = isVisible(el)) => !isDisabled(el) && !isReadOnly(el) && !el.closest('[inert]') && visible;
export const isEditableChoice = (el: HTMLInputElement, visible = isVisible(el)) => !isDisabled(el) && !el.closest('[inert]') && visible;

export const labelText = (el: Control) => Array.from(el.labels || []).map(label => label.textContent || '').join(' ');
export const labelledByText = (el: Control) => (el.getAttribute('aria-labelledby') || '').split(/\s+/).map(id => document.getElementById(id)?.textContent || '').join(' ');
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

export type SignalSource = 'autocomplete' | 'type' | 'inputmode' | 'label' | 'aria-label' | 'aria-labelledby' | 'placeholder' | 'title' | 'nearby' | 'name' | 'id' | 'legend';
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

// A radio group's question: its fieldset legend or its radiogroup's accessible name.
function groupText(el: Control): string {
  const group = el.closest('[role="radiogroup"], fieldset');
  if (!group) return '';
  const labelledBy = (group.getAttribute('aria-labelledby') || '').split(/\s+/).map(id => document.getElementById(id)?.textContent || '').join(' ');
  return clip(group.getAttribute('aria-label') || labelledBy || group.querySelector('legend')?.textContent || '');
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
  add('legend', radio ? groupText(el) : el.closest('fieldset')?.querySelector('legend')?.textContent);
  if (isInput(el)) { add('type', el.type); add('inputmode', el.getAttribute('inputmode')); }
  add('autocomplete', el.getAttribute('autocomplete'));
  return signals;
}
