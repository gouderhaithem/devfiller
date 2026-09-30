import type { ControlSnapshot } from '../panel-types';
import type { Control } from './types';

// Values go through the native setters, then input and change events, so React and Vue
// controlled inputs see the change. As with typing, input leaves a shadow root and change doesn't.
export function dispatchChange(el: Control) {
  el.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

export function setNativeValue(el: Control, value: string) {
  const prototype = el instanceof HTMLInputElement ? HTMLInputElement.prototype : el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLSelectElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, 'value')?.set?.call(el, value);
  dispatchChange(el);
}

export function setNativeChecked(el: HTMLInputElement, checked: boolean) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'checked')?.set?.call(el, checked);
  dispatchChange(el);
}

// Everything undo needs to restore a control.
export const snapshot = (el: Control): ControlSnapshot => ({
  value: el.value,
  ...(el instanceof HTMLInputElement && ['checkbox', 'radio'].includes(el.type) ? { checked: el.checked } : {}),
  ...(el instanceof HTMLSelectElement ? { selected: Array.from(el.options, o => o.selected) } : {}),
});
