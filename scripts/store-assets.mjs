// Builds Chrome Web Store listing images from the real extension in dist/.
// Usage: npm run build && node scripts/store-assets.mjs
import { chromium } from '@playwright/test';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const DIST = resolve('dist');
const OUT = resolve('docs/store');
const SHOT = { width: 1280, height: 800 };
const PANEL_WIDTH = 400;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };

// Pages under this origin are answered from dist/, so the listing shows a clean address.
const SITE = 'https://shop.example.test';
async function serveDist(context) {
  await context.route(`${SITE}/**`, async route => {
    const path = join(DIST, new URL(route.request().url()).pathname);
    if (!path.startsWith(DIST)) return route.fulfill({ status: 404 });
    try { await route.fulfill({ body: await readFile(path), contentType: TYPES[extname(path)] || 'application/octet-stream' }); }
    catch { await route.fulfill({ status: 404 }); }
  });
}

// Native side panels are separate CDP targets, not ordinary Playwright pages.
async function attachPanel(cdp, targetId) {
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: false });
  let next = 0;
  const waiting = new Map();
  cdp.on('Target.receivedMessageFromTarget', event => {
    if (event.sessionId !== sessionId) return;
    const reply = JSON.parse(event.message);
    const pending = waiting.get(reply.id);
    if (!pending) return;
    waiting.delete(reply.id);
    if (reply.error) pending.reject(new Error(reply.error.message)); else pending.resolve(reply.result);
  });
  const send = async (method, params = {}) => {
    const id = ++next;
    const promise = new Promise((resolve, reject) => waiting.set(id, { resolve, reject }));
    await cdp.send('Target.sendMessageToTarget', { sessionId, message: JSON.stringify({ id, method, params }) });
    return promise;
  };
  const evaluate = async expression => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result.value;
  return { send, evaluate };
}

async function until(check, timeout = 15000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { if (await check()) return; await new Promise(r => setTimeout(r, 200)); }
  throw new Error('Timed out waiting for the extension');
}

const dataUrl = buffer => `data:image/png;base64,${buffer.toString('base64')}`;

// Lays captured images out on an exact-size canvas and saves it as an opaque JPEG.
async function compose(browser, name, size, html) {
  const page = await browser.newPage();
  await page.setViewportSize(size);
  await page.setContent(`<!doctype html><html><head><style>*{box-sizing:border-box}html,body{margin:0;width:${size.width}px;height:${size.height}px;overflow:hidden;background:#fff;font-family:system-ui,sans-serif}</style></head><body>${html}</body></html>`);
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: join(OUT, name), type: 'jpeg', quality: 92 });
  await page.close();
  console.log('written', join('docs/store', name));
}

const profile = await mkdtemp(join(tmpdir(), 'devfiller-store-'));
const context = await chromium.launchPersistentContext(profile, {
  channel: 'chromium', headless: true, viewport: SHOT,
  args: ['--enable-unsafe-extension-debugging', `--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`],
});
try {
  await serveDist(context);
  await mkdir(OUT, { recursive: true });
  const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
  const id = worker.url().split('/')[2];
  await worker.evaluate(() => chrome.storage.local.set({ settings: { locale: 'en', overwrite: true, fillUnknown: true, passwords: false, custom: [] } }));
  const welcomeTabs = context.pages().filter(p => p.url().includes('welcome.html'));

  // Fill the demo website with the toolbar action, then open the real side panel beside it.
  const options = await context.newPage();
  await options.goto(`chrome-extension://${id}/index.html`);
  const website = await context.newPage();
  await website.setViewportSize({ width: SHOT.width - PANEL_WIDTH, height: SHOT.height });
  await website.goto(`${SITE}/demo.html`);
  const cdp = await context.browser().newBrowserCDPSession();
  const { targetInfos } = await cdp.send('Target.getTargets', { filter: [{ type: 'tab', exclude: false }, { exclude: true }] });
  await cdp.send('Extensions.triggerAction', { id, targetId: targetInfos.find(t => t.url === website.url()).targetId });
  await until(async () => (await website.locator('#email').inputValue()) !== '');
  const tab = await worker.evaluate(async () => (await chrome.tabs.query({ active: true, lastFocusedWindow: true }))[0]);
  await options.evaluate(windowId => chrome.sidePanel.open({ windowId }), tab.windowId);
  await website.bringToFront();
  let panelTarget;
  await until(async () => (panelTarget = (await cdp.send('Target.getTargets')).targetInfos.find(t => t.url.endsWith('/sidepanel.html'))?.targetId));
  const panel = await attachPanel(cdp, panelTarget);
  await panel.send('Emulation.setDeviceMetricsOverride', { width: PANEL_WIDTH, height: SHOT.height, deviceScaleFactor: 1, mobile: false });
  await until(() => panel.evaluate('document.querySelector(".results-heading")?.textContent.includes("filled")'));
  const websiteShot = await website.screenshot();
  const panelShot = Buffer.from((await panel.send('Page.captureScreenshot', { format: 'png' })).data, 'base64');

  // Options sections, captured at full store size.
  await options.bringToFront();
  const optionShots = {};
  for (const [key, button] of [['generator', 'Generator'], ['ai', 'AI'], ['exclusions', 'Excluded fields']]) {
    await options.reload();
    await options.getByRole('button', { name: button, exact: true }).click();
    if (key === 'ai') await options.getByLabel('Use AI for unknown fields').check();
    await options.waitForTimeout(400);
    const card = await options.locator('main.panel').boundingBox();
    optionShots[key] = await options.screenshot({ clip: { x: card.x, y: card.y, width: card.width, height: SHOT.height - 60 } });
  }
  const welcome = welcomeTabs[0] || await context.newPage();
  await welcome.setViewportSize(SHOT);
  await welcome.goto(`chrome-extension://${id}/welcome.html`);
  await welcome.waitForTimeout(400);
  const welcomeShot = await welcome.screenshot();

  await compose(context, '1-fill-with-side-panel.jpg', SHOT,
    `<div style="display:flex;height:100%"><img src="${dataUrl(websiteShot)}" style="width:${SHOT.width - PANEL_WIDTH}px;height:100%;display:block"><img src="${dataUrl(panelShot)}" style="width:${PANEL_WIDTH}px;height:100%;display:block;border-left:1px solid #dfe3dc"></div>`);
  const captioned = (image, title, text) => `<div style="height:100%;display:flex;align-items:flex-start;gap:72px;padding:60px 0 0 110px;background:#f2f3f1"><div style="width:520px;padding-top:120px"><div style="font-size:44px;line-height:1.12;font-weight:700;letter-spacing:-1px;color:#23304f">${title}</div><div style="font-size:20px;line-height:1.55;color:#5a6079;margin-top:22px">${text}</div></div><img src="${dataUrl(image)}" style="display:block;border:1px solid #e2e5e1;border-bottom:0;border-radius:8px 8px 0 0;box-shadow:0 10px 40px rgba(35,48,79,.08)"></div>`;
  await compose(context, '2-generator.jpg', SHOT, captioned(optionShots.generator, 'Realistic test data that fits together', 'Names, usernames, emails and addresses that match each other, in English, French or Arabic.'));
  await compose(context, '3-ai-suggestions.jpg', SHOT, captioned(optionShots.ai, 'Optional AI for unusual fields', 'Bring your own Groq or Gemini key. Only field labels are sent, never what you type.'));
  await compose(context, '4-excluded-fields.jpg', SHOT, captioned(optionShots.exclusions, 'Leave the fields you care about alone', 'Skip search bars, navigation and any field you choose, on every site or just one.'));
  await compose(context, '5-welcome.jpg', SHOT, `<img src="${dataUrl(welcomeShot)}" style="display:block">`);

  const icon = dataUrl(await readFile(join(DIST, 'icons/icon-128.png')));
  await compose(context, 'promo-small-440x280.jpg', { width: 440, height: 280 },
    `<div style="height:100%;display:flex;align-items:center;gap:22px;padding:0 34px;background:linear-gradient(135deg,#f4f6fd,#e3e9fa)"><img src="${icon}" width="96" height="96"><div><div style="font-size:40px;font-weight:700;letter-spacing:-1px;color:#23304f">devfiller</div><div style="font-size:17px;line-height:1.35;color:#4a5680;margin-top:6px">Fill any form with<br>realistic test data<br>in one click.</div></div></div>`);
} finally {
  await context.close();
  await rm(profile, { recursive: true, force: true });
}
