// Forms embedded from another site: HubSpot, Typeform, Google Forms… A fill writes into a frame only
// when the frame is the page's own site, or a form service the person allowed from the panel. Having
// granted DevFiller every site doesn't count: a page's cookie banner, payment or chat frames are
// never filled unasked. The main page lists the embedded forms DevFiller leaves alone, so the panel
// can offer to allow their service.

// Form services, by the domain to allow: a frame from any of its subdomains belongs to it
// (HubSpot moves share.hsforms.com to share-na1.hsforms.com). Only these are offered: a frame that
// merely calls itself a form would let the page choose which site DevFiller asks for.
const FORM_SERVICES = /(?:^|\.)(hsforms\.com|hsforms\.net|typeform\.com|jotform\.com|jotform\.eu|formstack\.com|cognitoforms\.com|wufoo\.com|tally\.so|paperform\.co|forms\.office\.com|forms\.microsoft\.com|zohopublic\.com|zohopublic\.eu|pardot\.com|123formbuilder\.com|formsite\.com|surveymonkey\.com|fillout\.com|forms\.app)$/i;

export interface EmbeddedForm { origin: string; host: string; site: string }

const serviceOf = (url: URL): string | undefined =>
  url.hostname.match(FORM_SERVICES)?.[1]?.toLowerCase() ?? (url.hostname === 'docs.google.com' && url.pathname.startsWith('/forms/') ? 'docs.google.com' : undefined);

export function embeddedForms(): EmbeddedForm[] {
  const found = new Map<string, EmbeddedForm>();
  for (const frame of Array.from(document.querySelectorAll('iframe'))) {
    let url: URL;
    try { url = new URL(frame.getAttribute('src') || '', location.href); } catch { continue; }
    if (!/^https?:$/.test(url.protocol) || url.origin === location.origin || !frame.getClientRects().length) continue;
    const site = serviceOf(url);
    if (site && !found.has(url.origin)) found.set(url.origin, { origin: url.origin, host: url.host, site });
  }
  return [...found.values()];
}

// Whether a frame at `origin` is one a fill may write into: the page's own site (srcdoc frames
// share it), or a subdomain of a service in `sites`. A sandboxed frame's origin is opaque ("null").
export function frameAllowed(origin: string, topOrigin: string, sites: readonly string[]): boolean {
  if (origin === 'null') return false;
  if (origin === topOrigin) return true;
  let host: string;
  try { host = new URL(origin).hostname.toLowerCase(); } catch { return false; }
  return sites.some(site => host === site || host.endsWith(`.${site}`));
}

// The service an embed belongs to counts as reached when a frame of that service ran DevFiller.
export const servesSite = (origin: string, site: string) => frameAllowed(origin, '', [site]);
