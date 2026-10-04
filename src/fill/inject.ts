// Extension-side helpers: inject the bundled engine, then call it in the same isolated world.
import type { fillPage, panelPageAction } from './index';
import type { exportFixture } from './export';
import type { revalidate } from './validation';
import type { fillWidgets } from './widgets';
import { servesSite, type embeddedForms, type EmbeddedForm, type frameAllowed } from './frames';
import type { TypeRule } from '../data';
import type { FillRequest, FillResult } from './types';

export const ENGINE_FILE = 'fill-engine.js';
export interface Engine { fillPage: typeof fillPage; panelPageAction: typeof panelPageAction; exportFixture: typeof exportFixture; revalidate: typeof revalidate; fillWidgets: typeof fillWidgets; embeddedForms: typeof embeddedForms; frameAllowed: typeof frameAllowed }
export type EngineGlobal = typeof globalThis & { __devfiller?: Engine };
type PanelAction = Parameters<typeof panelPageAction>[0];

async function injectEngine(target: chrome.scripting.InjectionTarget) {
  await chrome.scripting.executeScript({ target, files: [ENGINE_FILE] });
}

// Resolves to undefined when the page navigated away between the two injections. With `widgets`,
// the same call then fills custom ARIA widgets, so a fill is one round trip to the page.
export async function runFillPage(target: chrome.scripting.InjectionTarget, request: FillRequest, widgets = false): Promise<FillResult | undefined> {
  await injectEngine(target);
  const [reply] = await chrome.scripting.executeScript({
    target,
    func: async (req: FillRequest, withWidgets: boolean) => {
      const engine = (globalThis as EngineGlobal).__devfiller;
      const result = engine?.fillPage(req);
      if (!engine || !result || !withWidgets || req.mode || result.stale) return result;
      const custom = await engine.fillWidgets(req).catch(() => ({ filled: 0 }));
      return { ...result, filled: result.filled + custom.filled };
    },
    args: [request, widgets],
  });
  return reply?.result ?? undefined;
}

// The frames inside the page: those of the page's own site, and those of form services the person
// allowed from the panel (`sites`). Chrome skips frames DevFiller may not reach, without an error;
// the engine skips any other frame it does reach (a cookie banner, a payment form) on its own.
// The main page is filled first (AI suggestions belong to it), so frames get a plain local fill
// with the person the page used.
export interface FrameFill { filled: number; preserved: number; unmatched: number; invalid: number; frames: number }
export async function runFrameFills(tabId: number, request: FillRequest, topOrigin: string, sites: readonly string[]): Promise<FrameFill> {
  const target = { tabId, allFrames: true };
  const plain: FillRequest = { ...request, mode: undefined, expectedDocument: undefined, suggestions: undefined, suggestionsExpireAt: undefined, aiRequired: false, keepValues: true };
  await chrome.scripting.executeScript({ target, files: [ENGINE_FILE] });
  const replies = await chrome.scripting.executeScript({
    target,
    func: async (req: FillRequest, top: string, allowed: string[]) => {
      try {
        const engine = (globalThis as EngineGlobal).__devfiller;
        // self.origin, not location.origin: a srcdoc frame's location reads "null" though it shares its page's site.
        if (window === window.top || !engine?.frameAllowed(self.origin, top, allowed)) return null;
        const result = engine.fillPage(req);
        const custom = await engine.fillWidgets(req).catch(() => ({ filled: 0 }));
        return { filled: result.filled + custom.filled, preserved: result.preserved, unmatched: result.unmatched, invalid: result.invalid };
      } catch { return null; }
    },
    args: [plain, topOrigin, [...sites]],
  });
  const results = replies.flatMap(reply => reply.frameId !== 0 && reply.result ? [reply.result] : []);
  const sum = (key: 'filled' | 'preserved' | 'unmatched' | 'invalid') => results.reduce((total, result) => total + result[key], 0);
  return { filled: sum('filled'), preserved: sum('preserved'), unmatched: sum('unmatched'), invalid: sum('invalid'), frames: results.filter(result => result.filled > 0).length };
}

// Forms embedded from a form service DevFiller leaves alone: not allowed yet from the panel, or
// allowed but out of reach (the person withdrew the site's access). Most pages have none, so the
// frames are only asked for their site when the page shows one.
export async function missedEmbeds(tabId: number, sites: readonly string[]): Promise<EmbeddedForm[]> {
  const listed = async () => (await chrome.scripting.executeScript({ target: { tabId }, func: () => (globalThis as EngineGlobal).__devfiller?.embeddedForms() ?? null }))[0]?.result;
  let embeds = await listed();
  if (embeds === null || embeds === undefined) { await injectEngine({ tabId }); embeds = await listed(); }
  if (!embeds?.length) return [];
  const reached = (await chrome.scripting.executeScript({ target: { tabId, allFrames: true }, func: () => self.origin })).map(reply => reply.result);
  const allowed = new Set(sites);
  return embeds.filter(embed => !allowed.has(embed.site) || !reached.some(origin => origin && servesSite(origin, embed.site)));
}

// The page's own validation runs after our events, sometimes a moment later: wait, then retry the
// next way of writing each value the page rejected, for up to four rounds.
// `current` says whether this fill is still the latest one on the tab; a new click stops the retries.
export async function fixRejected(target: chrome.scripting.InjectionTarget, current: () => boolean = () => true): Promise<number> {
  let fixed = 0;
  for (let round = 0; round < 4; round++) {
    await new Promise(resolve => setTimeout(resolve, 300));
    if (!current()) break;
    // Firefox may refuse a call over every frame when it can't reach one: the page itself still retries.
    const revalidate = (on: chrome.scripting.InjectionTarget) => chrome.scripting.executeScript({ target: on, func: () => (globalThis as EngineGlobal).__devfiller?.revalidate() });
    const replies = await revalidate(target).catch(() => revalidate({ tabId: target.tabId }));
    const retried = replies.reduce((total, reply) => total + (reply?.result?.retried ?? 0), 0);
    fixed += retried;
    if (!retried) break;
  }
  return fixed;
}

export async function runExport(target: chrome.scripting.InjectionTarget, rules: TypeRule[]): Promise<ReturnType<typeof exportFixture>> {
  await injectEngine(target);
  const [reply] = await chrome.scripting.executeScript({ target, func: (list: TypeRule[]) => (globalThis as EngineGlobal).__devfiller?.exportFixture(list), args: [rules] });
  if (!reply?.result) throw new Error('This page changed. Refresh the field list.');
  return reply.result;
}

export async function runPanelAction(target: chrome.scripting.InjectionTarget, action: PanelAction, documentId: string, fieldId: string): Promise<ReturnType<typeof panelPageAction>> {
  await injectEngine(target);
  const [reply] = await chrome.scripting.executeScript({ target, func: (kind: PanelAction, doc: string, id: string) => (globalThis as EngineGlobal).__devfiller?.panelPageAction(kind, doc, id), args: [action, documentId, fieldId] });
  // No answer means the page navigated between the two injections: never report success.
  if (!reply?.result) throw new Error('This page changed. Refresh the field list.');
  return reply.result;
}
