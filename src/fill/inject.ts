// Extension-side helpers: inject the bundled engine, then call it in the same isolated world.
import type { fillPage, panelPageAction } from './index';
import type { exportFixture } from './export';
import type { revalidate } from './validation';
import type { TypeRule } from '../data';
import type { FillRequest, FillResult } from './types';

export const ENGINE_FILE = 'fill-engine.js';
export interface Engine { fillPage: typeof fillPage; panelPageAction: typeof panelPageAction; exportFixture: typeof exportFixture; revalidate: typeof revalidate }
export type EngineGlobal = typeof globalThis & { __devfiller?: Engine };
type PanelAction = Parameters<typeof panelPageAction>[0];

async function injectEngine(target: chrome.scripting.InjectionTarget) {
  await chrome.scripting.executeScript({ target, files: [ENGINE_FILE] });
}

// Resolves to undefined when the page navigated away between the two injections.
export async function runFillPage(target: chrome.scripting.InjectionTarget, request: FillRequest): Promise<FillResult | undefined> {
  await injectEngine(target);
  const [reply] = await chrome.scripting.executeScript({ target, func: (req: FillRequest) => (globalThis as EngineGlobal).__devfiller?.fillPage(req), args: [request] });
  return reply?.result ?? undefined;
}

// The page's own validation runs after our events, sometimes a moment later: wait, then retry the
// next way of writing each value the page rejected, for up to four rounds.
export async function fixRejected(target: chrome.scripting.InjectionTarget): Promise<number> {
  let fixed = 0;
  for (let round = 0; round < 4; round++) {
    await new Promise(resolve => setTimeout(resolve, 300));
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
