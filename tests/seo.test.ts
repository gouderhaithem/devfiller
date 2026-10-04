import { describe, expect, it } from 'vitest';
import { appJsonLd, breadcrumbJsonLd, faqJsonLd, jsonLdScript, pageMeta } from '../website/src/lib/seo';

describe('page metadata', () => {
  it('gives every page its own canonical and share URL, title and description', () => {
    const meta = pageMeta({ title: 'Install', description: 'Add DevFiller to Chrome.', path: '/docs/install/' });
    expect(meta.alternates?.canonical).toBe('/docs/install/');
    expect(meta.openGraph).toMatchObject({ url: '/docs/install/', title: 'Install', description: 'Add DevFiller to Chrome.' });
    expect(meta.twitter).toMatchObject({ card: 'summary_large_image', title: 'Install' });
  });
});

describe('structured data', () => {
  it('describes DevFiller as a free extension for Chrome, Firefox and Edge, by its author', () => {
    const app = appJsonLd({ count: 0, average: null });
    expect(app).toMatchObject({ '@type': 'SoftwareApplication', applicationCategory: 'DeveloperApplication', operatingSystem: 'Chrome, Firefox, Edge', offers: { price: '0' } });
    expect(app.sameAs).toEqual(expect.arrayContaining(['https://addons.mozilla.org/en-US/firefox/addon/devfiller/']));
    expect(app.author).toMatchObject({ '@type': 'Person', name: 'Haithem Gouder' });
    expect(app).not.toHaveProperty('aggregateRating');
  });
  it('adds a rating only when there are reviews', () => {
    expect(appJsonLd({ count: 3, average: 4.7 }).aggregateRating).toEqual({ '@type': 'AggregateRating', ratingValue: 4.7, reviewCount: 3, bestRating: 5, worstRating: 1 });
  });
  it('lists breadcrumbs with absolute URLs', () => {
    expect(breadcrumbJsonLd([{ name: 'Docs', path: '/docs/' }, { name: 'Install', path: '/docs/install/' }]).itemListElement[1]).toEqual({ '@type': 'ListItem', position: 2, name: 'Install', item: 'https://www.devfiller.com/docs/install/' });
  });
  it('turns questions and answers into an FAQ page', () => {
    expect(faqJsonLd([{ question: 'Is it free?', answer: 'Yes.' }]).mainEntity[0]).toEqual({ '@type': 'Question', name: 'Is it free?', acceptedAnswer: { '@type': 'Answer', text: 'Yes.' } });
  });
  it('escapes < so a value can never close the script tag', () => {
    const html = jsonLdScript({ name: '</script><script>alert(1)</script>' });
    expect(html).not.toContain('</script>');
    expect(html).toContain('\\u003c/script>');
  });
});
