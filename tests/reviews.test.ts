import { describe, expect, it, vi } from 'vitest';
import { REVIEW_LIMITS, avatarTone, displayName, distribution, initials, summarize, validateReview } from '../website/src/lib/reviews';
import { createReviewHandler, type ReviewDeps } from '../website/src/lib/review-handler';

const valid = { name: 'Amina Test', role: 'QA engineer', rating: 5, comment: 'Filled our whole sign-up form in one click.', leave_empty: '', elapsedMs: 8000 };

describe('review validation', () => {
  it('accepts a complete review and trims it', () => {
    expect(validateReview({ ...valid, name: '  Amina Test  ', comment: `  ${valid.comment}  ` })).toEqual({ ok: true, value: { name: 'Amina Test', role: 'QA engineer', rating: 5, comment: valid.comment } });
  });
  it('keeps the role optional', () => {
    expect(validateReview({ ...valid, role: '' })).toMatchObject({ ok: true, value: { role: undefined } });
  });
  it('names every field that is missing or wrong', () => {
    const result = validateReview({ name: '', rating: 7, comment: 'ok' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(Object.keys(result.errors).sort()).toEqual(['comment', 'name', 'rating']);
  });
  it.each([0, 6, 3.5, '5', null])('accepts only a whole rating from 1 to 5, not %s', rating => {
    expect(validateReview({ ...valid, rating }).ok).toBe(false);
  });
  it('rejects values over the limits and never trusts a non-object body', () => {
    const long = validateReview({ ...valid, name: 'n'.repeat(REVIEW_LIMITS.name + 1), role: 'r'.repeat(REVIEW_LIMITS.role + 1), comment: 'c'.repeat(REVIEW_LIMITS.comment + 1) });
    expect(long.ok).toBe(false);
    if (!long.ok) expect(Object.keys(long.errors).sort()).toEqual(['comment', 'name', 'role']);
    expect(validateReview(null).ok).toBe(false);
    expect(validateReview('text').ok).toBe(false);
  });
  it('removes invisible control and text-direction characters from the name and role', () => {
    const result = validateReview({ ...valid, name: 'Amina‮​ Test', role: 'QA\r\nlead' });
    expect(result.ok && [result.value.name, result.value.role]).toEqual(['Amina Test', 'QA lead']);
  });
});

describe('review presentation', () => {
  it('shows names with capitals, without changing what was typed otherwise', () => {
    expect(displayName('islam mohamed')).toBe('Islam Mohamed');
    expect(displayName('Jean-luc O\'neil')).toBe('Jean-luc O\'neil');
    expect(displayName('محمد أمين')).toBe('محمد أمين');
  });
  it('makes initials from the first and last word, in any script', () => {
    expect(initials('islam mohamed')).toBe('IM');
    expect(initials('Amina')).toBe('A');
    expect(initials('Jean Paul de la Tour')).toBe('JT');
    expect(initials('محمد أمين')).toBe('مأ');
    expect(initials('  ')).toBe('?');
  });
  it('gives the same name the same avatar colour every time', () => {
    expect(avatarTone('Islam Mohamed')).toBe(avatarTone('islam mohamed'));
    expect(new Set(['Amina', 'Yacine', 'Lea', 'Omar', 'Sara', 'Karim'].map(avatarTone)).size).toBeGreaterThan(2);
  });
  it('counts reviews per star, five first', () => {
    expect(distribution([{ rating: 5 }, { rating: 5 }, { rating: 3 }])).toEqual([{ stars: 5, count: 2 }, { stars: 4, count: 0 }, { stars: 3, count: 1 }, { stars: 2, count: 0 }, { stars: 1, count: 0 }]);
  });
});

describe('review summary', () => {
  it('averages the ratings to one decimal and counts them', () => {
    expect(summarize([{ rating: 5 }, { rating: 4 }, { rating: 4 }])).toEqual({ count: 3, average: 4.3 });
  });
  it('has no average when there are no reviews', () => {
    expect(summarize([])).toEqual({ count: 0, average: null });
  });
});

const deps = (over: Partial<ReviewDeps> = {}): ReviewDeps => ({
  insert: vi.fn(async () => {}), published: vi.fn(), allow: () => true, now: () => 1_000_000, log: vi.fn(), ...over,
});
const post = (body: unknown, headers: Record<string, string> = {}) => new Request('https://www.devfiller.com/api/reviews/', {
  method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body),
  headers: { origin: 'https://www.devfiller.com', host: 'www.devfiller.com', 'content-type': 'application/json', ...headers },
});

describe('review endpoint', () => {
  it('publishes a valid review and refreshes the pages that show it', async () => {
    const d = deps();
    const response = await createReviewHandler(d)(post(valid));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, data: { received: true }, error: null });
    expect(d.insert).toHaveBeenCalledWith({ name: 'Amina Test', role: 'QA engineer', rating: 5, comment: valid.comment });
    expect(d.published).toHaveBeenCalledTimes(1);
  });
  it('refreshes nothing when the review was not stored', async () => {
    const d = deps({ insert: vi.fn(async () => { throw new Error('down'); }) });
    await createReviewHandler(d)(post(valid));
    await createReviewHandler(d)(post({ ...valid, leave_empty: 'bot' }));
    expect(d.published).not.toHaveBeenCalled();
  });
  it('explains what to fix when fields are invalid, without storing', async () => {
    const d = deps();
    const response = await createReviewHandler(d)(post({ ...valid, rating: 9 }));
    expect(response.status).toBe(400);
    expect((await response.json()).errors).toHaveProperty('rating');
    expect(d.insert).not.toHaveBeenCalled();
  });
  it('pretends to accept bots (filled honeypot or instant submit) but stores nothing', async () => {
    const d = deps();
    for (const bot of [{ ...valid, leave_empty: 'http://spam.example' }, { ...valid, elapsedMs: 300 }]) expect((await createReviewHandler(d)(post(bot))).status).toBe(200);
    expect(d.insert).not.toHaveBeenCalled();
  });
  it('refuses other sites, other content types and broken JSON', async () => {
    const handler = createReviewHandler(deps());
    expect((await handler(post(valid, { origin: 'https://evil.example' }))).status).toBe(403);
    expect((await handler(post(valid, { 'content-type': 'text/plain' }))).status).toBe(415);
    expect((await handler(post('{not json'))).status).toBe(400);
  });
  it('limits each address and says when to try again', async () => {
    const response = await createReviewHandler(deps({ allow: () => false }))(post(valid));
    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBeTruthy();
  });
  it('fails politely when the database is missing or down, and never leaks its error', async () => {
    const down = deps({ insert: vi.fn(async () => { throw new Error('password authentication failed for user app_owner'); }) });
    const response = await createReviewHandler(down)(post(valid));
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(JSON.stringify(body)).not.toContain('app_owner');
    expect(down.log).toHaveBeenCalled();
  });
});
