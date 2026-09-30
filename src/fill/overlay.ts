import { classifyField, THRESHOLDS } from './classify';
import { isVisible, listControls, OMITTED_TYPES } from './extract';
import { detection } from './report';

type OverlayState = typeof globalThis & { __devfillerOverlayCleanup?: () => void };

const colour = (type: string, confidence: number) => type.startsWith('skip:') ? '#b34c3c' : type === 'unknown' ? '#77806f'
  : confidence >= THRESHOLDS.high ? '#4f7d45' : confidence >= THRESHOLDS.medium ? '#5370ce' : '#a06d2a';

function draw(layer: HTMLElement) {
  layer.replaceChildren();
  for (const el of listControls()) {
    if ((el instanceof HTMLInputElement && [...OMITTED_TYPES, 'file'].includes(el.type)) || !isVisible(el)) continue;
    const found = detection(classifyField(el));
    const rect = el.getBoundingClientRect();
    const badge = document.createElement('span');
    // textContent only: nothing taken from the page is ever parsed as markup.
    badge.textContent = found.type === 'unknown' ? 'Unknown' : found.type.startsWith('skip:') ? `${found.label} · skipped` : `${found.label} ${Math.round(found.confidence * 100)}%`;
    badge.style.left = `${rect.left + scrollX}px`;
    badge.style.top = `${Math.max(0, rect.top + scrollY - 17)}px`;
    badge.style.background = colour(found.type, found.confidence);
    layer.append(badge);
  }
}

// Debug view: each field's type and confidence drawn just above it. Toggled from the side panel;
// it lives in a closed shadow root so page styles can't reach it, and it never changes a field.
export function showOverlay(on: boolean) {
  const state = globalThis as OverlayState;
  state.__devfillerOverlayCleanup?.();
  if (!on) return { overlay: false };
  const host = document.createElement('div');
  host.style.cssText = 'position:absolute;top:0;left:0;width:0;height:0;z-index:2147483647;pointer-events:none';
  const shadow = host.attachShadow({ mode: 'closed' });
  const style = document.createElement('style');
  style.textContent = 'span{position:absolute;font:600 10px/15px system-ui,sans-serif;color:#fff;padding:0 5px;border-radius:3px;white-space:nowrap;box-shadow:0 1px 2px #0003}';
  const layer = document.createElement('div');
  shadow.append(style, layer);
  let frame = 0;
  const render = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(() => draw(layer)); };
  draw(layer);
  document.documentElement.append(host);
  addEventListener('resize', render);
  state.__devfillerOverlayCleanup = () => { cancelAnimationFrame(frame); removeEventListener('resize', render); host.remove(); delete state.__devfillerOverlayCleanup; };
  return { overlay: true };
}
