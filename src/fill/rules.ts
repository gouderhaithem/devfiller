import type { CustomField } from '../data';
import type { Control } from './types';
import { normalize } from './normalize';

// The user's custom rule for a control: a side-panel selector rule for this site first, then an
// exact label rule. Custom rules always win over recognition.
export function findCustomRule(custom: readonly CustomField[], el: Control, signals: readonly string[]): CustomField | undefined {
  const targeted = custom.find(c => c.selector && (!c.site || c.site === location.hostname) && (() => { try { return el.matches(c.selector!); } catch { return false; } })());
  return targeted || custom.find(c => !c.selector && c.label.trim() && signals.includes(normalize(c.label)));
}
