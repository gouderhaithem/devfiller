import type { TypeRule } from '../data';
import type { Control } from './types';
import { analyzePage } from './context';
import { isVisible, listControls } from './extract';

// Exports the page's forms as a benchmark fixture: structure and labels only, never what anyone
// typed, and each control labelled with the type DevFiller gives it (or the one you set with a
// type rule). Review every label before adding the file to the benchmark.

const DROP = 'script, style, link, iframe, img, picture, svg, video, audio, canvas, noscript, object, embed, template, input[type="hidden"]';
const KEEP_VALUE = new Set(['radio', 'checkbox', 'submit', 'button', 'reset']);
const esc = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// The smallest pieces of the page that hold its forms: each <form>, and for fields outside forms
// their nearest section. Page text elsewhere (names in a header, messages) is left out.
function roots(controls: readonly Control[]): Element[] {
  const found = new Set<Element>();
  for (const el of controls) found.add(el.form ?? el.closest('fieldset, section, [role="form"], main') ?? el.parentElement ?? el);
  return [...found].filter(root => ![...found].some(other => other !== root && other.contains(root)));
}

function clean(root: Element) {
  root.querySelectorAll(DROP).forEach(el => el.remove());
  for (const el of [root, ...root.querySelectorAll('*')]) {
    for (const attribute of [...el.attributes]) {
      const name = attribute.name;
      const keepValue = name === 'value' && (el instanceof HTMLOptionElement || (el instanceof HTMLInputElement && KEEP_VALUE.has(el.type)));
      const ours = name === 'data-expect' || name === 'data-form-type';
      if (name.startsWith('on') || (name.startsWith('data-') && !ours) || ['checked', 'selected', 'src', 'srcset', 'nonce', 'integrity'].includes(name) || (name === 'value' && !keepValue)) el.removeAttribute(name);
      // Keep a link's or form's path, never its host or query: /checkout, not https://shop.example/checkout?session=…
      if (name === 'href' || name === 'action') { try { el.setAttribute(name, new URL(attribute.value, location.href).pathname); } catch { el.removeAttribute(name); } }
    }
    if (el instanceof HTMLTextAreaElement) el.textContent = '';
    if (el instanceof HTMLElement && el.isContentEditable) el.textContent = '';
  }
}

export function exportFixture(rules: readonly TypeRule[] = []): { html: string; filename: string } {
  // A fixture is copied from the page's own markup, which never holds a shadow root's contents.
  const controls = listControls(false);
  const shown = controls.filter(el => !(el instanceof HTMLInputElement && el.type === 'hidden'));
  const { fields, forms } = analyzePage(controls, new Map(controls.map(el => [el, isVisible(el)])), rules);
  const parts = roots(shown).map(root => {
    const copy = root.cloneNode(true) as Element;
    const originals = Array.from(root.querySelectorAll<Control>('input, select, textarea'));
    if (root.matches('input, select, textarea')) originals.unshift(root as Control);
    const copies = [copy, ...copy.querySelectorAll<Control>('input, select, textarea')].filter(el => el.matches('input, select, textarea')) as Control[];
    originals.forEach((el, i) => {
      const found = fields.get(el);
      if (found && copies[i]) copies[i].setAttribute('data-expect', found.type);
    });
    if (root instanceof HTMLFormElement) {
      const insight = forms.find(form => form.index === Array.from(document.forms).indexOf(root));
      copy.setAttribute('data-form-type', insight?.type ?? 'other');
    }
    clean(copy);
    return copy.outerHTML;
  });
  const host = location.hostname || 'page';
  const date = new Date().toISOString().slice(0, 10);
  const lang = document.documentElement.lang || 'en';
  const note = `Exported by DevFiller from ${host} on ${date}. The data-expect values are DevFiller's answers (or your type rules), not the truth: check each one against the page before adding this file to benchmark/fixtures/regressions/. Values people typed were removed.`;
  const html = `<!doctype html>\n<html lang="${esc(lang)}"${document.documentElement.dir ? ` dir="${esc(document.documentElement.dir)}"` : ''}>\n<head><meta charset="utf-8"><title>${esc(document.title || host)}</title></head>\n<body>\n<main>\n<!-- ${note.replace(/--/g, '—')} -->\n${parts.join('\n')}\n</main>\n</body>\n</html>\n`;
  return { html, filename: `devfiller-fixture-${host.replace(/[^a-z0-9.-]/gi, '_')}-${date}.html` };
}

