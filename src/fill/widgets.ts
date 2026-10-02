import type { FieldKey } from '../data';
import type { FillRequest } from './types';
import type { Signal } from './extract';
import { isSensitive, rankElement, usableKey, type Classification } from './classify';
import { CONSENT, SENSITIVE_PHRASES, SESSION, PLACEHOLDER_OPTION } from './dictionary';
import { agreeingOption } from './sensitive';
import { isMeaningless } from './extract';
import { matchChoice, spellingsFor } from './generate';
import { normalize } from './normalize';
import { randomFor, type Random } from '../rng';

// Custom widgets built from ARIA roles instead of native controls: checkboxes and switches, radio
// groups, comboboxes that open a listbox, and rich-text editors. They follow the WAI-ARIA
// Authoring Practices patterns, so they are filled the way a person uses them: by pressing,
// choosing an option and typing.

export const WIDGET_SELECTOR = '[role="checkbox"]:not(input), [role="switch"]:not(input), [role="radio"]:not(input), [role="combobox"]:not(input):not(select), [contenteditable="true"], [contenteditable=""], [role="textbox"]:not(input):not(textarea)';
export type WidgetKind = 'checkbox' | 'radio' | 'combobox' | 'editor';

export function kindOf(el: Element): WidgetKind {
  const role = el.getAttribute('role');
  return role === 'checkbox' || role === 'switch' ? 'checkbox' : role === 'radio' ? 'radio' : role === 'combobox' ? 'combobox' : 'editor';
}

// Every widget on the page, without the parts of an editor that are editable themselves.
export function listWidgets(): HTMLElement[] {
  const all = Array.from(document.querySelectorAll<HTMLElement>(WIDGET_SELECTOR));
  return all.filter(el => !all.some(other => other !== el && kindOf(other) === 'editor' && other.contains(el)));
}

const clip = (text: string | null | undefined) => (text || '').replace(/\s+/g, ' ').trim().slice(0, 120);
const byIds = (ids: string | null) => (ids || '').split(/\s+/).map(id => document.getElementById(id)?.textContent || '').join(' ');
const signal = (source: Signal['source'], raw: string | null | undefined): Signal[] => { const text = normalize(clip(raw)); return text ? [{ source, raw: clip(raw), text }] : []; };

function groupOf(el: Element): Element | null { return el.closest('[role="radiogroup"], fieldset'); }
function groupLabel(group: Element | null): string {
  if (!group) return '';
  return group.getAttribute('aria-label') || byIds(group.getAttribute('aria-labelledby')) || group.querySelector('legend')?.textContent || '';
}
const ownText = (el: Element) => clip(el.getAttribute('aria-label') || byIds(el.getAttribute('aria-labelledby')) || el.textContent);
// The text beside a widget: the next sibling for a checkbox, the previous one otherwise.
function besideText(el: Element, forward: boolean): string {
  for (let node = forward ? el.nextSibling : el.previousSibling; node; node = forward ? node.nextSibling : node.previousSibling) {
    if (node instanceof Element && node.matches('input, select, textarea, [role]')) return '';
    const text = clip(node.textContent);
    if (text) return text;
  }
  return '';
}

// The heading over a group of toggles that isn't a fieldset: "Notifications & privacy" above a
// stack of switches. Climbs past rows of other toggles and stops at native fields, which mean the
// container is a whole form section rather than the group.
const NATIVE = 'input:not([type="hidden"]), select, textarea';
const TOGGLES = '[role="switch"], [role="checkbox"]';
const onlyToggles = (node: Element) => !node.matches(NATIVE) && !node.querySelector(NATIVE) && (node.matches(TOGGLES) || !!node.querySelector(TOGGLES)) && !node.querySelector('[role]:not([role="switch"]):not([role="checkbox"])');
const referencedIds = () => new Set(Array.from(document.querySelectorAll('[aria-labelledby], [aria-describedby]'), node => `${node.getAttribute('aria-labelledby') || ''} ${node.getAttribute('aria-describedby') || ''}`.split(/\s+/)).flat().filter(Boolean));
function headingAbove(el: Element): string {
  const referenced = referencedIds();
  const isLabelOfSomething = (node: Element) => node.matches('label') || (!!node.id && referenced.has(node.id));
  let node: Element = el;
  for (let depth = 0; depth < 8; depth++) {
    for (let sibling = node.previousElementSibling; sibling; sibling = sibling.previousElementSibling) {
      // Another toggle, or another field's label ("Share usage data" beside its switch), isn't a heading.
      if (onlyToggles(sibling) || isLabelOfSomething(sibling)) continue;
      if (sibling.matches(NATIVE) || sibling.querySelector(`${NATIVE}, [role]`)) return '';
      const text = clip(sibling.textContent);
      if (text) return text.length <= 80 ? text : '';
    }
    // The form, a fieldset or the page is as far as a group's heading can be.
    const parent = node.parentElement;
    if (!parent || parent.matches('form, fieldset, body') || parent.querySelector(NATIVE)) return '';
    node = parent;
  }
  return '';
}

function widgetSignals(el: HTMLElement, kind: WidgetKind): Signal[] {
  const label = el.id ? document.querySelector(`label[for="${el.id.replace(/"/g, '\\"')}"]`)?.textContent : '';
  const signals = [
    ...signal('aria-label', el.getAttribute('aria-label')),
    ...signal('aria-labelledby', byIds(el.getAttribute('aria-labelledby'))),
    ...signal('label', label),
    ...signal('placeholder', el.getAttribute('aria-placeholder') || el.getAttribute('data-placeholder')),
    ...signal('title', el.getAttribute('title')),
  ];
  if (!signals.length && kind !== 'radio') signals.push(...signal('nearby', besideText(el, kind === 'checkbox') || besideText(el, kind !== 'checkbox')));
  if (kind === 'checkbox' && !signals.length) signals.push(...signal('label', el.textContent));
  if (el.id && !isMeaningless(el.id)) signals.push(...signal('id', el.id));
  signals.push(...signal('legend', kind === 'radio' ? groupLabel(groupOf(el)) : el.closest('fieldset')?.querySelector('legend')?.textContent || (kind === 'checkbox' ? headingAbove(el) : '')));
  return signals;
}

function groupMembers(el: Element): HTMLElement[] {
  const group = groupOf(el);
  return group ? Array.from(group.querySelectorAll<HTMLElement>('[role="radio"]')) : [el as HTMLElement];
}

function listboxOf(el: Element): HTMLElement | null {
  for (const id of [el.getAttribute('aria-controls'), el.getAttribute('aria-owns')].join(' ').split(/\s+/).filter(Boolean)) {
    const found = document.getElementById(id);
    if (found) return found.matches('[role="listbox"]') ? found : found.querySelector('[role="listbox"]');
  }
  return el.parentElement?.querySelector<HTMLElement>('[role="listbox"]') ?? null;
}
const optionsOf = (listbox: Element | null) => Array.from(listbox?.querySelectorAll<HTMLElement>('[role="option"]') ?? []).filter(option => option.getAttribute('aria-disabled') !== 'true');

function answersOf(el: HTMLElement, kind: WidgetKind): string[] {
  if (kind === 'radio') return groupMembers(el).map(ownText).filter(Boolean);
  if (kind === 'combobox') return optionsOf(listboxOf(el)).map(option => clip(option.textContent)).filter(Boolean);
  return [];
}

const texts = (signals: readonly Signal[]) => signals.map(item => item.text);

export function classifyWidget(el: HTMLElement): Classification {
  const kind = kindOf(el);
  const signals = widgetSignals(el, kind);
  const skip = (type: Classification['type'], reason: string): Classification => ({ type, confidence: 1, candidates: [], evidence: [{ source: 'label', signal: reason.slice(0, 120), weight: 1, match: 'sensitive' }], signals });
  if (kind === 'checkbox' || kind === 'radio') {
    // For a radio group, "I agree" on any answer makes the whole question a consent question.
    const said = [...texts(signals), ...(kind === 'radio' ? groupMembers(el).map(member => normalize(ownText(member))) : [normalize(ownText(el))])];
    const consent = said.find(text => CONSENT.test(text));
    if (consent) return skip('skip:consent', consent);
    const session = said.find(text => SESSION.test(text));
    if (session) return skip('skip:session', session);
    if (kind === 'checkbox') return { type: 'unknown', confidence: 0, candidates: [], evidence: [], signals };
  } else {
    for (const [kindName, phrases] of Object.entries(SENSITIVE_PHRASES) as [string, readonly string[]][]) {
      const hit = texts(signals).find(text => phrases.some(phrase => ` ${text} `.includes(` ${phrase} `)));
      if (hit) return skip(`skip:${kindName}` as Classification['type'], hit);
    }
  }
  return rankElement(el, signals, answersOf(el, kind), kind === 'radio');
}

// ---- Filling. Everything here runs after the native fill, one widget at a time, because
// opening a combobox changes the page before the next widget can be used.

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
async function waitFor<T>(find: () => T | undefined | null | false, timeout = 400): Promise<T | undefined> {
  for (let waited = 0; waited <= timeout; waited += 25) { const found = find(); if (found) return found; await sleep(25); }
  return undefined;
}
// Libraries react to pointer, mouse or click events: send the whole sequence a press makes.
function press(el: HTMLElement) {
  for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup']) el.dispatchEvent(new (type.startsWith('pointer') && typeof PointerEvent !== 'undefined' ? PointerEvent : MouseEvent)(type, { bubbles: true, cancelable: true, button: 0 }));
  el.click();
}
const isShown = (el: Element) => !!el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden';
const checked = (el: Element) => el.getAttribute('aria-checked') === 'true';

interface WidgetRun { request: FillRequest; random: (el: Element) => Random; fresh: boolean }

async function fillCheckbox(run: WidgetRun, el: HTMLElement): Promise<boolean> {
  const { request } = run;
  if (!request.fillUnknown || (checked(el) && !request.overwrite)) return false;
  const want = request.seed?.trim() ? run.random(el)(2) === 1 : !checked(el);
  if (want === checked(el)) return true;
  press(el);
  if (await waitFor(() => checked(el) === want, 150)) return true;
  el.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true }));
  return checked(el) === want;
}

async function fillRadio(run: WidgetRun, el: HTMLElement, found: Classification, done: Set<Element>): Promise<boolean> {
  const { request } = run;
  const members = groupMembers(el).filter(member => member.getAttribute('aria-disabled') !== 'true');
  members.forEach(member => done.add(member));
  if (!request.overwrite && members.some(checked)) return false;
  const key = usableKey(found, request.fillUnknown);
  const matching = key ? matchChoice(members, spellingsFor(request.values[key], key), member => [ownText(member)]) : undefined;
  if (!matching && !request.fillUnknown) return false;
  const others = members.filter(member => !checked(member));
  const pool = run.fresh && others.length ? others : members;
  const target = matching ?? pool[run.random(el)(pool.length)];
  if (!target) return false;
  press(target);
  await waitFor(() => checked(target), 150);
  return true;
}

async function fillCombobox(run: WidgetRun, el: HTMLElement, found: Classification): Promise<boolean> {
  const { request } = run;
  const key = usableKey(found, request.fillUnknown);
  if (!key && !request.fillUnknown) return false;
  if (el.getAttribute('aria-expanded') !== 'true') press(el);
  const options = await waitFor(() => { const list = optionsOf(listboxOf(el)).filter(isShown); return list.length ? list : undefined; });
  if (!options) return false;
  const usable = options.filter(option => clip(option.textContent) && !PLACEHOLDER_OPTION.test(option.textContent || ''));
  const matching = key ? matchChoice(usable, spellingsFor(request.values[key], key), option => [option.textContent || '', option.getAttribute('data-value') || '']) : undefined;
  const others = usable.filter(option => option.getAttribute('aria-selected') !== 'true');
  const pool = run.fresh && others.length ? others : usable;
  const target = matching ?? (request.fillUnknown ? pool[run.random(el)(pool.length)] : undefined);
  if (!target) { el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); return false; }
  press(target);
  await sleep(30);
  return true;
}

// An editable combobox (an <input role="combobox">, as in React Select or MUI Autocomplete) was
// typed into by the native fill; choose the option its list now offers.
async function pickTypedOption(el: HTMLInputElement): Promise<boolean> {
  if (!el.value) return false;
  el.focus();
  el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
  const options = await waitFor(() => { const list = optionsOf(listboxOf(el)).filter(isShown); return list.length ? list : undefined; }, 300);
  if (!options) return false;
  const target = matchChoice(options, [el.value], option => [option.textContent || '']) ?? options[0];
  press(target);
  await sleep(30);
  return true;
}

function editorText(request: FillRequest, found: Classification, random: Random): string | undefined {
  const key = usableKey(found, request.fillUnknown);
  if (key) return request.values[key as FieldKey];
  if (!request.fillUnknown) return undefined;
  const sentences = request.samples?.description ?? ['A simple project for a growing team.'];
  return sentences[random(sentences.length)];
}

// Rich-text editors keep their own model of the text, so insert it the way typing does.
function fillEditor(el: HTMLElement, text: string, overwrite: boolean): boolean {
  if (!isWritable(el) || (!overwrite && clip(el.textContent))) return false;
  el.focus();
  const selection = getSelection();
  const range = document.createRange();
  range.selectNodeContents(el);
  selection?.removeAllRanges();
  selection?.addRange(range);
  const inserted = typeof document.execCommand === 'function' && document.execCommand('insertText', false, text);
  if (!inserted || !el.textContent?.includes(text)) {
    el.textContent = text;
    el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
  }
  return true;
}
const isWritable = (el: HTMLElement) => el.getAttribute('aria-readonly') !== 'true' && el.getAttribute('aria-disabled') !== 'true';

function excluded(el: Element, request: FillRequest): boolean {
  const exclusions = request.exclusions ?? { skipSearch: true, skipHeader: true, rules: [] };
  if (exclusions.skipHeader && el.closest('header, nav, [role="banner"], [role="navigation"]')) return true;
  if (exclusions.skipSearch && el.closest('search, [role="search"]')) return true;
  return exclusions.rules.some(rule => rule.match === 'selector' && (() => { try { return !!el.closest(rule.value); } catch { return false; } })());
}

async function agree(el: HTMLElement, kind: 'checkbox' | 'radio', done: Set<Element>): Promise<boolean> {
  if (kind === 'checkbox') {
    if (checked(el)) return true;
    press(el);
    return waitFor(() => checked(el), 150).then(Boolean);
  }
  const members = groupMembers(el).filter(member => member.getAttribute('aria-disabled') !== 'true');
  members.forEach(member => done.add(member));
  const target = agreeingOption(members, ownText);
  if (!target) return false;
  if (!checked(target)) { press(target); await waitFor(() => checked(target), 150); }
  return true;
}

export async function fillWidgets(request: FillRequest): Promise<{ filled: number; skipped: number }> {
  const seed = request.seed?.trim();
  const streams = new Map<Element, Random>();
  const all = listWidgets();
  const random = (el: Element) => {
    if (!seed) return randomFor();
    let stream = streams.get(el);
    if (!stream) { stream = randomFor(seed, `widget|${all.indexOf(el as HTMLElement)}`); streams.set(el, stream); }
    return stream;
  };
  const run: WidgetRun = { request, random, fresh: request.overwrite && !seed };
  const done = new Set<Element>();
  let filled = 0, skipped = 0;
  for (const el of all) {
    if (done.has(el) || !el.isConnected || !isShown(el) || el.closest('[inert], [aria-disabled="true"]') || excluded(el, request)) continue;
    const found = classifyWidget(el);
    const kind = kindOf(el);
    // Consent and "stay signed in" toggles are ticked as test values, like their native boxes.
    if ((found.type === 'skip:consent' || found.type === 'skip:session') && (kind === 'checkbox' || kind === 'radio')) {
      try { if (await agree(el, kind, done)) filled++; } catch { skipped++; }
      continue;
    }
    if (isSensitive(found.type)) { skipped++; if (kind === 'radio') groupMembers(el).forEach(member => done.add(member)); continue; }
    try {
      const ok = kind === 'checkbox' ? await fillCheckbox(run, el)
        : kind === 'radio' ? await fillRadio(run, el, found, done)
        : kind === 'combobox' ? await fillCombobox(run, el, found)
        : (() => { const text = editorText(request, found, random(el)); return text !== undefined && fillEditor(el, text, request.overwrite); })();
      if (ok) filled++;
    } catch { skipped++; }
  }
  for (const input of Array.from(document.querySelectorAll<HTMLInputElement>('input[role="combobox"]'))) {
    if (!isShown(input) || excluded(input, request) || !(input.getAttribute('aria-autocomplete') || input.getAttribute('aria-controls'))) continue;
    try { if (await pickTypedOption(input)) filled++; } catch { skipped++; }
  }
  return { filled, skipped };
}
