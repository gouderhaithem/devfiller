// Collects French and Arabic web forms for labelling, the languages the UCI crawl hardly has. For each
// website of a list: its home page and up to four of its contact, sign-up, account, job or booking
// pages; up to two forms of three or more visible fields per website, in French or Arabic. Nothing is
// typed or submitted, a website that turns automated browsers away is skipped, and pages are written
// inert like sample-round.mjs (no scripts, styles, SVG or links), with the page's language kept.
// Data stays in $OUT, outside the repository.
//
//   OUT=~/datasets/web-forms-fr-ar node scripts/uci-sealed/crawl-forms.mjs sites.txt
import { chromium } from 'playwright';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const [listArg] = process.argv.slice(2);
if (!listArg) { console.error('usage: crawl-forms.mjs <file of websites, one per line>'); process.exit(2); }
const OUT = resolve(process.env.OUT || resolve(process.env.HOME, 'datasets/web-forms-fr-ar'));
const PAGES = resolve(OUT, 'pages');
const CONCURRENCY = Number(process.env.CONCURRENCY || 4);
const PAGE_TIMEOUT = 20_000, SITE_TIMEOUT = 90_000;
const MAX_LINKS = 4, MAX_FORMS = 2, MIN_FIELDS = 3, MAX_BYTES = 200_000;
const LINK = /contact|nous-contacter|contactez|inscri|register|sign-?up|cr[ée]er-?un-?compte|mon-?compte|account|candidat|recrutement|carri[eè]re|emploi|devis|r[ée]servation|reserv|abonn|newsletter|اتصل|تواصل|تسجيل|حساب|انضم|توظيف|حجز/i;
const GUESSES = ['/contact', '/contact-us', '/nous-contacter', '/contactez-nous', '/fr/contact', '/ar/contact', '/ar/contact-us', '/inscription', '/register', '/signup'];
const BLOCKED = /just a moment|access denied|attention required|captcha|forbidden|are you a robot/i;
const ARABIC = /[؀-ۿ]{3,}/;
const FRENCH = /\b(prénom|nom|courriel|e-?mail|adresse|téléphone|mot de passe|ville|pays|envoyer|message|société|entreprise|code postal|civilité)\b/i;

const inert = html => html
  .replace(/<(script|noscript|iframe|style|svg|template)\b[\s\S]*?<\/\1>/gi, '').replace(/<!--[\s\S]*?-->/g, '')
  .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '').replace(/\s(src|srcset|action|formaction|href)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
  .replace(/\sstyle\s*=\s*("[^"]*"|'[^']*')/gi, '');

// The forms of the open page with enough visible fields, with the page's language and direction.
// Pages that build a form without a <form> element count too: the smallest block holding three
// visible fields and a button.
async function formsOn(page) {
  return page.evaluate(min => {
    const shown = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'; };
    const fieldsOf = form => [...form.querySelectorAll('input, select, textarea')].filter(el => !(el instanceof HTMLInputElement && ['hidden', 'submit', 'button', 'reset', 'image', 'file'].includes(el.type)) && shown(el));
    const loose = [...new Set([...document.querySelectorAll('input, select, textarea')].filter(el => !el.form && shown(el)).map(el => {
      for (let node = el.parentElement; node && node !== document.body; node = node.parentElement) if (fieldsOf(node).length >= min && node.querySelector('button, [type=submit], [role=button]')) return node;
      return undefined;
    }).filter(Boolean))].filter((node, _, all) => !all.some(other => other !== node && node.contains(other)));
    return [...document.forms, ...loose].map(form => ({ html: form.outerHTML, fields: fieldsOf(form).length, text: form.innerText.slice(0, 3000), signature: fieldsOf(form).map(el => el.name || el.id || el.type).join('|') }))
      .filter(form => form.fields >= min)
      .map(form => ({ ...form, lang: document.documentElement.lang || '', dir: document.documentElement.dir || '' }));
  }, MIN_FIELDS);
}

async function linksOn(page, origin) {
  const links = await page.evaluate(() => [...document.querySelectorAll('a[href]')].map(a => ({ href: a.href, text: (a.textContent || '').trim().slice(0, 80) })));
  const seen = new Set();
  return links.filter(({ href, text }) => { try { const url = new URL(href); if (url.origin !== origin || seen.has(url.pathname)) return false; seen.add(url.pathname); return LINK.test(`${url.pathname} ${text}`); } catch { return false; } }).slice(0, MAX_LINKS).map(link => link.href);
}

const languageOf = form => ARABIC.test(form.text) || /^ar/i.test(form.lang) ? 'ar' : /^fr/i.test(form.lang) || FRENCH.test(form.text) ? 'fr' : undefined;

async function visit(context, site) {
  const page = await context.newPage();
  const kept = [];
  try {
    const home = await page.goto(`https://${site}/`, { timeout: PAGE_TIMEOUT, waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    if (!home || home.status() >= 400 || BLOCKED.test(await page.title())) return { site, status: `skipped (${home?.status() ?? 'no answer'})`, kept };
    const origin = new URL(page.url()).origin;
    const found = await linksOn(page, origin);
    // No such link on the home page: the usual addresses of those pages.
    const guesses = found.length ? [] : GUESSES.map(path => origin + path);
    const urls = [page.url(), ...found, ...guesses];
    const signatures = new Set();
    for (const [i, url] of urls.entries()) {
      if (kept.length >= MAX_FORMS) break;
      if (i > 0) {
        const answer = await page.goto(url, { timeout: PAGE_TIMEOUT, waitUntil: 'domcontentloaded' }).catch(() => undefined);
        await page.waitForTimeout(1500);
        if (!answer || answer.status() >= 400 || BLOCKED.test(await page.title())) continue;
      }
      for (const form of await formsOn(page)) {
        const lang = languageOf(form);
        if (!lang || signatures.has(form.signature) || kept.length >= MAX_FORMS) continue;
        const html = inert(form.html);
        if (html.length > MAX_BYTES) continue;
        signatures.add(form.signature);
        kept.push({ url: page.url(), lang, dir: form.dir || (lang === 'ar' ? 'rtl' : ''), fields: form.fields, html });
      }
    }
    return { site, status: 'ok', kept };
  } catch (error) {
    return { site, status: `error: ${String(error.message || error).split('\n')[0].slice(0, 80)}`, kept };
  } finally { await page.close().catch(() => {}); }
}

const sites = [...new Set(readFileSync(listArg, 'utf8').split('\n').map(line => line.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '')).filter(line => line && !line.startsWith('#')))];
mkdirSync(PAGES, { recursive: true });
const manifestPath = resolve(OUT, 'manifest.json');
const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : { note: 'French and Arabic forms from public websites, collected without typing or submitting anything.', sites: {}, forms: [] };
const browser = await chromium.launch();
const context = await browser.newContext({ locale: 'fr-FR' });
await context.route('**/*', route => ['image', 'media', 'font'].includes(route.request().resourceType()) ? route.abort() : route.continue());
// RETRY_EMPTY=1 visits again the websites that answered but gave no form.
const retry = site => process.env.RETRY_EMPTY && manifest.sites[site] === 'ok' && !manifest.forms.some(form => form.domain === site);
const queue = sites.filter(site => !manifest.sites[site] || retry(site));
async function worker() {
  for (let site = queue.shift(); site; site = queue.shift()) {
    // A page can hang inside the browser past every navigation timeout: a website gets 90 seconds.
    const { status, kept } = await Promise.race([visit(context, site), new Promise(done => setTimeout(() => done({ site, status: 'timed out', kept: [] }), SITE_TIMEOUT))]);
    manifest.sites[site] = status;
    for (const form of kept) {
      const file = `${String(manifest.forms.length + 1).padStart(4, '0')}-${form.lang}-${site.replace(/[^a-z0-9.-]/gi, '_')}.html`;
      writeFileSync(resolve(PAGES, file), `<!doctype html>\n<html lang="${form.lang}"${form.dir ? ` dir="${form.dir}"` : ''}>\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>${site}</title>\n</head>\n<body>\n${form.html}\n</body>\n</html>\n`);
      manifest.forms.push({ file, domain: site, url: form.url, lang: form.lang, fields: form.fields });
    }
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 1));
    console.log(`${site}: ${status}, ${kept.length} form${kept.length === 1 ? '' : 's'}`);
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));
await browser.close();
const byLang = manifest.forms.reduce((n, form) => ({ ...n, [form.lang]: (n[form.lang] ?? 0) + 1 }), {});
console.log(`${manifest.forms.length} forms from ${new Set(manifest.forms.map(form => form.domain)).size} websites`, byLang);
