import { launchExtension } from './helpers/extension';
import { test, expect } from '@playwright/test';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';

// Real custom elements in Chromium, filled from the toolbar: labels slotted in from the page or set
// on the component, a component inside another, the page's form around them, and a closed root,
// which no one outside can reach and which stays as it is.
const COMPONENTS = `
  const define = (name, template, mode = 'open') => customElements.define(name, class extends HTMLElement {
    connectedCallback() { if (this.done) return; this.done = true; const root = this.attachShadow({ mode }); root.innerHTML = template(this); if (mode === 'closed') window.closedRoot = root; }
  });
  define('fluent-text-field', host => '<label part="label" for="control"><slot></slot></label><input id="control" type="' + (host.getAttribute('type') || 'text') + '">');
  define('sl-input', () => '<label for="input"><slot name="label"></slot></label><input id="input">');
  define('x-text-input', host => '<span>' + (host.getAttribute('label') || '') + '</span><input>');
  define('x-textarea', () => '<textarea></textarea>');
  define('x-card', () => '<div class="card"><x-text-input label="Job title"></x-text-input></div>');
  define('x-secret', () => '<label for="s">Company</label><input id="s">', 'closed');
`;
const PAGE = `<form id="contact">
  <fluent-text-field id="email" type="email">Work email</fluent-text-field>
  <sl-input id="phone"><span slot="label">Phone number</span></sl-input>
  <x-text-input id="company" label="Company"></x-text-input>
  <x-card id="card"></x-card>
  <x-textarea id="message"></x-textarea>
  <x-secret id="secret"></x-secret>
</form>`;

test('fills fields inside web components from the toolbar', async () => {
  const extensionPath = resolve('dist');
  const profile = await mkdtemp(resolve(tmpdir(), 'devfiller-test-'));
  const context = await launchExtension(profile, extensionPath);
  try {
    const id = createHash('sha256').update(extensionPath).digest('hex').slice(0, 32).replace(/[0-9a-f]/g, c => String.fromCharCode(97 + parseInt(c, 16)));
    const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
    await worker.evaluate(() => chrome.storage.local.set({ settings: { locale: 'en', overwrite: true, fillUnknown: false, passwords: false, custom: [] } }));
    const website = await context.newPage();
    const errors: string[] = []; website.on('pageerror', e => errors.push(e.message));
    await website.goto('http://127.0.0.1:5188/demo.html');
    await website.evaluate(({ script, html }) => { document.body.innerHTML = html; new Function(script)(); }, { script: COMPONENTS, html: PAGE });
    const cdp = await context.browser()!.newBrowserCDPSession();
    const { targetInfos } = await cdp.send('Target.getTargets', { filter: [{ type: 'tab', exclude: false }, { exclude: true }] });
    const target = targetInfos.find(t => t.url === website.url())!;
    await cdp.send('Extensions.triggerAction', { id, targetId: target.targetId });
    const value = (host: string, nested?: string) => website.evaluate(([h, n]) => {
      let root = document.getElementById(h!)!.shadowRoot!;
      if (n) root = root.querySelector(n)!.shadowRoot!;
      return (root.querySelector('input, textarea') as HTMLInputElement).value;
    }, [host, nested] as const);
    await expect.poll(() => value('email')).toMatch(/@example\.com$/);
    expect(await value('phone')).toMatch(/^\+?[\d ()-]{8,}$/);
    expect(await value('company')).not.toBe('');
    expect(await value('card', 'x-text-input')).not.toBe('');
    expect(await value('message')).not.toBe('');
    expect(await website.evaluate(() => ((window as unknown as { closedRoot: ShadowRoot }).closedRoot.querySelector('input') as HTMLInputElement).value)).toBe('');
    expect(errors).toEqual([]);
  } finally {
    await context.close();
    await rm(profile, { recursive: true, force: true });
  }
});
