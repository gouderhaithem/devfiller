import { afterEach, describe, expect, it, vi } from 'vitest';
import { hasAiConsent, isFirefox, openPanel, requestAiAccess } from '../src/browser';

const g = globalThis as Record<string, unknown>;
afterEach(() => { delete g.chrome; delete g.browser; vi.unstubAllGlobals(); });
const asFirefox = () => vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0' });
const asChrome = () => vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36' });

describe('the panel', () => {
  it('opens Chrome\'s side panel in the window', () => {
    const open = vi.fn(async () => {});
    g.chrome = { sidePanel: { open } };
    openPanel(7);
    expect(open).toHaveBeenCalledWith({ windowId: 7 });
  });
  it('opens Firefox\'s sidebar, which has no side panel', () => {
    const open = vi.fn(async () => {});
    g.chrome = {};
    g.browser = { sidebarAction: { open } };
    openPanel(7);
    expect(open).toHaveBeenCalled();
  });
});

describe('consent to send field descriptions to an AI provider', () => {
  it('is never asked for in Chrome', async () => {
    asChrome();
    const request = vi.fn();
    g.chrome = { permissions: { request, contains: vi.fn() } };
    expect(isFirefox()).toBe(false);
    expect(await requestAiAccess()).toBe(true);
    expect(await hasAiConsent()).toBe(true);
    expect(request).not.toHaveBeenCalled();
  });
  it('asks Chrome only for website access, when preparing ahead of the click', async () => {
    asChrome();
    const request = vi.fn(async () => true);
    g.chrome = { permissions: { request, contains: vi.fn() } };
    expect(await requestAiAccess(['https://*/*'])).toBe(true);
    expect(request).toHaveBeenCalledWith({ origins: ['https://*/*'] });
  });
  it('asks Firefox once for consent and website access together, inside the click', async () => {
    asFirefox();
    const request = vi.fn(async () => true);
    g.chrome = { permissions: { request, contains: vi.fn() } };
    expect(await requestAiAccess(['https://*/*'])).toBe(true);
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith({ origins: ['https://*/*'], data_collection: ['websiteContent'] });
  });
  it('is asked for in Firefox as website content, and followed', async () => {
    asFirefox();
    const request = vi.fn(async () => false);
    const contains = vi.fn(async () => false);
    g.chrome = { permissions: { request, contains } };
    expect(isFirefox()).toBe(true);
    expect(await requestAiAccess()).toBe(false);
    expect(request).toHaveBeenCalledWith({ data_collection: ['websiteContent'] });
    expect(await hasAiConsent()).toBe(false);
    expect(contains).toHaveBeenCalledWith({ data_collection: ['websiteContent'] });
  });
});
