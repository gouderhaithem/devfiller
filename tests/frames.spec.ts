import { launchExtension } from './helpers/extension';
import { attachPanel } from './helpers/native-panel';
import { test, expect, type BrowserContext } from '@playwright/test';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

// A form service (share.hsforms.com) and a cookie banner (consent.example.org), both from another
// site: served by a small server of their own, at names the test browser maps to it. Nothing leaves
// the machine.
const FIXTURES = resolve('tests/fixtures/frames');
let server: Server;
let port = 0;
test.beforeAll(async () => {
  server = createServer(async (request, response) => {
    const name = request.url?.includes('banner') ? 'banner.html' : 'embed.html';
    response.writeHead(200, { 'content-type': 'text/html' });
    response.end(await readFile(resolve(FIXTURES, name)));
  });
  await new Promise<void>(done => server.listen(0, '127.0.0.1', done));
  port = (server.address() as AddressInfo).port;
});
test.afterAll(() => new Promise<void>(done => server.close(() => done())));
const HOSTS = ['--host-resolver-rules=MAP share.hsforms.com 127.0.0.1, MAP consent.example.org 127.0.0.1'];
const pageUrl = () => `http://127.0.0.1:5188/tests/fixtures/frames/main.html?embed=${encodeURIComponent(`http://share.hsforms.com:${port}/embed.html`)}&banner=${encodeURIComponent(`http://consent.example.org:${port}/banner.html`)}`;

async function fillFromToolbar(context: BrowserContext, url: string) {
  const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
  const id = worker.url().split('/')[2];
  await worker.evaluate(() => chrome.storage.local.set({ settings: { locale: 'en', overwrite: true, fillUnknown: true, passwords: false, custom: [] } }));
  const website = await context.newPage();
  await website.goto(url);
  await expect(website.frameLocator('#embed').locator('#mail')).toBeAttached();
  await expect(website.frameLocator('#banner').locator('#ads')).toBeAttached();
  await expect(website.frameLocator('#inner').frameLocator('#nested').locator('#city')).toBeAttached();
  const cdp = await context.browser()!.newBrowserCDPSession();
  const click = async () => {
    const { targetInfos } = await cdp.send('Target.getTargets', { filter: [{ type: 'tab', exclude: false }, { exclude: true }] });
    await cdp.send('Extensions.triggerAction', { id, targetId: targetInfos.find(t => t.url === website.url())!.targetId });
  };
  await click();
  const tab = await worker.evaluate(async () => (await chrome.tabs.query({})).find(t => t.url?.includes('/frames/main.html'))!);
  return { worker, id, website, cdp, tab, click };
}

test('fills same-site frames and offers the embedded form it leaves alone', async () => {
  test.setTimeout(60000);
  const profile = await mkdtemp(resolve(tmpdir(), 'devfiller-frames-test-'));
  const context = await launchExtension(profile, resolve('dist'), HOSTS);
  try {
    const { worker, id, website, cdp, tab } = await fillFromToolbar(context, pageUrl());
    const inner = website.frameLocator('#inner');
    await expect(website.locator('#email')).toHaveValue(/@example\.com$/);
    await expect(inner.locator('#company')).not.toHaveValue('');
    await expect(inner.locator('#phone')).not.toHaveValue('');
    await expect(inner.frameLocator('#nested').locator('#city')).not.toHaveValue('');
    await expect(website.frameLocator('#embed').locator('#mail')).toHaveValue('');
    await expect(website.frameLocator('#banner').locator('#ads')).not.toBeChecked();
    await expect.poll(() => worker.evaluate(tabId => chrome.action.getBadgeText({ tabId }), tab.id!)).toBe('5');
    const title = await worker.evaluate(tabId => chrome.action.getTitle({ tabId }), tab.id!);
    expect(title).toContain('5 filled (3 inside 2 frames; Undo restores the main page only)');
    expect(title).toContain(`An embedded form from share.hsforms.com:${port} was not filled`);
    expect(title).not.toContain('consent.example.org');

    const options = await context.newPage(); await options.goto(`chrome-extension://${id}/index.html`);
    await options.evaluate(windowId => chrome.sidePanel.open({ windowId }), tab.windowId);
    await website.bringToFront();
    let panelTarget: string | undefined;
    await expect.poll(async () => { panelTarget = (await cdp.send('Target.getTargets')).targetInfos.find(t => t.url.endsWith('/sidepanel.html'))?.targetId; return !!panelTarget; }).toBe(true);
    const panel = await attachPanel(cdp, panelTarget!);
    await expect.poll(() => panel.evaluate(`document.querySelector('.embed')?.textContent || ''`), { timeout: 10000 }).toContain('Allow on hsforms.com');
    expect(panel.errors).toEqual([]);
  } finally {
    await context.close();
    await rm(profile, { recursive: true, force: true });
  }
});

// A person who gave DevFiller every site still gets no fill in another site's frames until they
// allow that form service from the panel; a cookie banner is never filled.
test('fills another site\'s form only once its service is allowed, with the page\'s person', async () => {
  test.setTimeout(60000);
  const profile = await mkdtemp(resolve(tmpdir(), 'devfiller-frames-test-'));
  const extension = await mkdtemp(resolve(tmpdir(), 'devfiller-all-sites-'));
  await cp(resolve('dist'), extension, { recursive: true });
  const manifest = JSON.parse(await readFile(resolve(extension, 'manifest.json'), 'utf8'));
  await writeFile(resolve(extension, 'manifest.json'), JSON.stringify({ ...manifest, host_permissions: [...manifest.host_permissions, '<all_urls>'] }));
  const context = await launchExtension(profile, extension, HOSTS);
  try {
    const { worker, website, click } = await fillFromToolbar(context, pageUrl());
    const embed = website.frameLocator('#embed');
    await expect(website.locator('#email')).toHaveValue(/@example\.com$/);
    await website.waitForTimeout(1500);
    await expect(embed.locator('#mail')).toHaveValue('');
    await expect(website.frameLocator('#banner').locator('#ads')).not.toBeChecked();
    await expect(website.frameLocator('#banner').locator('#pref')).toHaveValue('');

    await worker.evaluate(() => chrome.storage.local.set({ embedSites: ['hsforms.com'] }));
    await click();
    await expect(embed.locator('#msg')).not.toHaveValue('');
    expect(await embed.locator('#mail').inputValue()).toBe(await website.locator('#email').inputValue());
    await expect(website.frameLocator('#banner').locator('#ads')).not.toBeChecked();
    await expect(website.frameLocator('#banner').locator('#pref')).toHaveValue('');
  } finally {
    await context.close();
    await rm(profile, { recursive: true, force: true });
    await rm(extension, { recursive: true, force: true });
  }
});
