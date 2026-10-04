// @vitest-environment jsdom
// Forms embedded from another site (HubSpot, Typeform, Google Forms…), which an extension reaches
// only where the person has allowed that site: the main page lists them, so DevFiller can say which
// it could not fill.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { embeddedForms, frameAllowed } from '../src/fill/frames';

beforeEach(() => {
  document.body.replaceChildren();
  vi.spyOn(Element.prototype, 'getClientRects').mockReturnValue([{}] as unknown as DOMRectList);
});
const hosts = () => embeddedForms().map(form => form.host);

describe('embedded forms from another site', () => {
  it('finds the form services by their address', () => {
    document.body.innerHTML = ['https://share.hsforms.com/1abc', 'https://acme.typeform.com/to/xyz', 'https://form.jotform.com/123', 'https://docs.google.com/forms/d/e/1FAIpQ/viewform?embedded=true', 'https://tally.so/embed/w4', 'https://go.pardot.com/l/1/2']
      .map(src => `<iframe src="${src}"></iframe>`).join('');
    expect(hosts()).toEqual(['share.hsforms.com', 'acme.typeform.com', 'form.jotform.com', 'docs.google.com', 'tally.so', 'go.pardot.com']);
  });
  it('offers nothing for a frame that only names itself a form: the page would choose the site', () => {
    document.body.innerHTML = `<iframe id="hs-form-iframe-0" src="https://forms.example.net/x"></iframe><iframe title="Contact form" src="https://www.google.com/maps/embed"></iframe>`;
    expect(hosts()).toEqual([]);
  });
  it('names the service to allow, so its other addresses count too', () => {
    document.body.innerHTML = `<iframe src="https://share.hsforms.com/1"></iframe><iframe src="https://docs.google.com/forms/d/1/viewform"></iframe><iframe src="https://forms.office.com/r/1"></iframe>`;
    expect(embeddedForms().map(form => form.site)).toEqual(['hsforms.com', 'docs.google.com', 'forms.office.com']);
  });
  it('lists each site once', () => {
    document.body.innerHTML = `<iframe src="https://share.hsforms.com/1"></iframe><iframe src="https://share.hsforms.com/2"></iframe>`;
    expect(embeddedForms()).toEqual([{ origin: 'https://share.hsforms.com', host: 'share.hsforms.com', site: 'hsforms.com' }]);
  });
  it('leaves out videos, maps, ads, same-site frames and hidden frames', () => {
    document.body.innerHTML = `<iframe src="https://www.youtube.com/embed/abc"></iframe><iframe src="https://www.google.com/maps/embed?pb=1"></iframe><iframe src="https://googleads.g.doubleclick.net/x"></iframe>
      <iframe src="https://docs.google.com/document/d/1/preview"></iframe><iframe title="Contact form" src="${location.origin}/form.html"></iframe><iframe srcdoc="<form></form>"></iframe><iframe src="about:blank"></iframe><iframe id="hidden" src="https://share.hsforms.com/1"></iframe>`;
    vi.spyOn(Element.prototype, 'getClientRects').mockImplementation(function (this: Element) { return (this.id === 'hidden' ? [] : [{}]) as unknown as DOMRectList; });
    expect(hosts()).toEqual([]);
  });
});

describe('which frames a fill may write into', () => {
  it('fills frames of the page\'s own site, srcdoc frames included', () => {
    expect(frameAllowed('https://shop.example.com', 'https://shop.example.com', [])).toBe(true);
  });
  it('fills another site only where the person allowed that form service', () => {
    expect(frameAllowed('https://share-na1.hsforms.com', 'https://shop.example.com', ['hsforms.com'])).toBe(true);
    expect(frameAllowed('https://hsforms.com', 'https://shop.example.com', ['hsforms.com'])).toBe(true);
    expect(frameAllowed('https://js.stripe.com', 'https://shop.example.com', ['hsforms.com'])).toBe(false);
    expect(frameAllowed('https://evilhsforms.com', 'https://shop.example.com', ['hsforms.com'])).toBe(false);
  });
  it('never fills a sandboxed frame, whose origin is opaque', () => {
    expect(frameAllowed('null', 'null', [])).toBe(false);
  });
});
