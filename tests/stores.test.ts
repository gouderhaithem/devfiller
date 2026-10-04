import { describe, expect, it } from 'vitest';
import { STORES, storeFor } from '../website/src/lib/site';

const UA = {
  chrome: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  edge: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0',
  firefox: 'Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0',
  opera: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 OPR/115.0.0.0',
  safari: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
};

describe('the store for a browser', () => {
  it('sends Firefox to Firefox Add-ons and Edge to Edge Add-ons', () => {
    expect(storeFor(UA.firefox).id).toBe('firefox');
    expect(storeFor(UA.edge).id).toBe('edge');
  });
  it('sends Chrome, other Chromium browsers and anything else to the Chrome Web Store', () => {
    for (const ua of [UA.chrome, UA.opera, UA.safari, '']) expect(storeFor(ua).id).toBe('chrome');
  });
  it('lists the three stores with their own links and button labels', () => {
    expect(STORES.map(store => [store.id, store.label])).toEqual([['chrome', 'Add to Chrome'], ['firefox', 'Add to Firefox'], ['edge', 'Add to Edge']]);
    expect(STORES.find(store => store.id === 'firefox')!.url).toBe('https://addons.mozilla.org/en-US/firefox/addon/devfiller/');
    expect(STORES.find(store => store.id === 'edge')!.url).toContain('microsoftedge.microsoft.com/addons/detail/');
  });
});
