import type { Exclusions } from '../data';
import type { Control } from './types';
import { fieldSignals } from './extract';
import { normalize } from './normalize';
import { SEARCH_WORDS } from './dictionary';

const isSearch = (el: Control, signals: string[]) =>
  (el instanceof HTMLInputElement && el.type === 'search') || !!el.closest('search, [role="search"]')
  || signals.some(signal => signal === 'q' || signal === 'query' || SEARCH_WORDS.some(term => ` ${signal} `.includes(` ${normalize(term)} `)));

const siteMatches = (site: string) => {
  const hostname = location.hostname.toLowerCase().replace(/\.$/, '');
  const wanted = site.toLowerCase().replace(/\.$/, '');
  return !wanted || hostname === wanted || hostname.endsWith(`.${wanted}`);
};

const selectorMatches = (el: Control, selector: string) => {
  try { return !!el.closest(selector); } catch { return false; /* Ignore malformed selectors from old or imported settings. */ }
};

// Why a field is excluded: the user's own label or selector rules, and the header/navigation and
// search settings. The side panel removes the rules to include a field again.
export interface ExclusionCause { rules: string[]; header: boolean; search: boolean }
export function exclusionCause(el: Control, exclusions: Exclusions): ExclusionCause | undefined {
  const signals = fieldSignals(el);
  const rules = exclusions.rules.filter(rule => siteMatches(rule.site) && !!rule.value.trim()
    && (rule.match === 'label' ? signals.includes(normalize(rule.value)) : rule.match === 'selector' && selectorMatches(el, rule.value))).map(rule => rule.id);
  const header = exclusions.skipHeader && !!el.closest('header, nav, [role="banner"], [role="navigation"]');
  const search = exclusions.skipSearch && isSearch(el, signals);
  return rules.length || header || search ? { rules, header, search } : undefined;
}

// The user's exclusions: header/navigation, searches, and their own label or selector rules.
export function shouldExclude(el: Control, exclusions: Exclusions): boolean {
  if (exclusions.skipHeader && el.closest('header, nav, [role="banner"], [role="navigation"]')) return true;
  if (!exclusions.skipSearch && !exclusions.rules.length) return false;
  return !!exclusionCause(el, exclusions);
}
