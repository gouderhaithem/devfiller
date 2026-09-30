// Extension-side helpers: inject the bundled engine, then call it in the same isolated world.
import type { fillPage, panelPageAction } from './index';
import type { exportFixture } from './export';
import type { revalidate } from './validation';
import type { fillWidgets } from './widgets';
import type { TypeRule } from '../data';
import type { FillRequest, FillResult } from './types';

export const ENGINE_FILE = 'fill-engine.js';
export interface Engine { fillPage: typeof fillPage; panelPageAction: typeof panelPageAction; exportFixture: typeof exportFixture; revalidate: typeof revalidate; fillWidgets: typeof fillWidgets }
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

// The page's own validation runs after our events, sometimes a moment later: wait, then retry the
// next way of writing each value the page rejected, for up to four rounds.
// `current` says whether this fill is still the latest one on the tab; a new click stops the retries.
export async function fixRejected(target: chrome.scripting.InjectionTarget, current: () => boolean = () => true): Promise<number> {
  let fixed = 0;
  for (let round = 0; round < 4; round++) {
    await new Promise(resolve => setTimeout(resolve, 300));
    if (!current()) break;
    const [reply] = await chrome.scripting.executeScript({ target, func: () => (globalThis as EngineGlobal).__devfiller?.revalidate() });
    const retried = reply?.result?.retried ?? 0;
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
