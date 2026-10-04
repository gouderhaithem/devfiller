// @vitest-environment jsdom
// Pages served over plain HTTP from a name other than localhost (http://192.168.1.20:3000, a .test
// domain) are not secure contexts: the browser gives them no crypto.randomUUID. The engine runs
// there all the same.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fillPage, type FillRequest } from '../src/fill';
import { generateIdentities, generateValues } from '../src/data';
import { generateSamples } from '../src/samples';

const request: FillRequest = { values: generateValues('en'), identities: generateIdentities('en'), samples: generateSamples('en'), custom: [], overwrite: true, fillUnknown: true, passwords: false };
beforeEach(() => {
  document.body.replaceChildren();
  vi.spyOn(Element.prototype, 'getClientRects').mockReturnValue([{}] as unknown as DOMRectList);
  vi.stubGlobal('crypto', { getRandomValues: crypto.getRandomValues.bind(crypto), subtle: crypto.subtle });
  delete (globalThis as { __devfillerDocumentId?: string }).__devfillerDocumentId;
});
afterEach(() => vi.unstubAllGlobals());

describe('a page that is not a secure context', () => {
  it('is filled, inspected and given a document id', () => {
    document.body.innerHTML = `<form><label for="e">Email</label><input id="e" type="email"></form>`;
    expect(fillPage(request).filled).toBe(1);
    const inspected = fillPage({ ...request, mode: 'inspect' });
    expect(inspected.documentId).toMatch(/^[0-9a-f-]{36}$/);
    expect(inspected.fields?.[0].id).toMatch(/^[0-9a-f-]{36}$/);
  });
});
