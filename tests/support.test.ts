import { describe, expect, it, vi } from 'vitest';
import { buildSupportEmail, validateSupport, LIMITS } from '../website/src/lib/support';
import { createRateLimiter } from '../website/src/lib/rate-limit';
import { createSupportHandler, type SupportDeps } from '../website/src/lib/support-handler';

const valid = { name: 'Amina Test', email: 'amina@example.com', topic: 'bug', message: 'The phone field stayed empty on my form.', page: 'https://app.example.com/signup', leave_empty: '', elapsedMs: 8000 };

describe('support validation', () => {
  it('accepts a complete message and trims it', () => {
    const result = validateSupport({ ...valid, name: '  Amina Test  ', message: `  ${valid.message}  ` });
    expect(result).toEqual({ ok: true, value: { name: 'Amina Test', email: 'amina@example.com', topic: 'bug', message: valid.message, page: valid.page } });
  });
  it('names every field that is missing or wrong', () => {
    const result = validateSupport({ name: '', email: 'not-an-email', topic: 'lottery', message: 'hi' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(Object.keys(result.errors).sort()).toEqual(['email', 'message', 'name', 'topic']);
  });
  it('rejects values over the limits and pages that are not web addresses', () => {
    const long = validateSupport({ ...valid, message: 'x'.repeat(LIMITS.message + 1), name: 'n'.repeat(LIMITS.name + 1), page: 'javascript:alert(1)' });
    expect(long.ok).toBe(false);
    if (!long.ok) expect(Object.keys(long.errors).sort()).toEqual(['message', 'name', 'page']);
  });
  it('keeps the page optional and never trusts a non-object body', () => {
    expect(validateSupport({ ...valid, page: '' })).toMatchObject({ ok: true, value: { page: undefined } });
    expect(validateSupport(null).ok).toBe(false);
    expect(validateSupport('text').ok).toBe(false);
  });
  it('checks huge or malformed email addresses quickly and rejects angle brackets', () => {
    const started = performance.now();
    expect(validateSupport({ ...valid, email: `a@${'.'.repeat(31_000)}@` }).ok).toBe(false);
    expect(validateSupport({ ...valid, email: 'a@' + 'b.'.repeat(15_000) }).ok).toBe(false);
    expect(performance.now() - started).toBeLessThan(50);
    expect(validateSupport({ ...valid, email: 'evil<a@b.co>' }).ok).toBe(false);
    expect(validateSupport({ ...valid, email: 'a..b@example.com' }).ok).toBe(true);
  });
  it('removes invisible control and text-direction characters from single-line fields', () => {
    const result = validateSupport({ ...valid, name: 'Amina\u202E moc.live\u200B' });
    expect(result.ok && result.value.name).toBe('Amina moc.live');
  });
  it('strips line breaks from the name so it cannot break the subject line', () => {
    const result = validateSupport({ ...valid, name: 'Amina\r\nBcc: someone@example.com' });
    expect(result.ok && result.value.name).toBe('Amina Bcc: someone@example.com');
  });
});

describe('support email', () => {
  it('replies to the sender, escapes their text and never puts it in the subject raw', () => {
    const email = buildSupportEmail({ ...valid, message: '<script>alert(1)</script> & more', page: undefined }, { to: 'owner@example.com', from: 'DevFiller <support@example.com>' });
    expect(email).toMatchObject({ to: ['owner@example.com'], from: 'DevFiller <support@example.com>', reply_to: 'amina@example.com' });
    expect(email.subject).toBe('[DevFiller support] Something doesn’t work: Amina Test');
    expect(email.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt; &amp; more');
    expect(email.html).not.toContain('<script>');
    expect(email.text).toContain('<script>alert(1)</script> & more');
  });
});

describe('rate limit keys', () => {
  it('prefers the address the platform sets and groups IPv6 by its /64 network', async () => {
    const { clientKey } = await import('../website/src/lib/support-handler');
    const request = (headers: Record<string, string>) => new Request('https://x.example/', { headers });
    expect(clientKey(request({ 'x-real-ip': '198.51.100.4', 'x-forwarded-for': '203.0.113.7' }))).toBe('198.51.100.4');
    expect(clientKey(request({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1' }))).toBe('203.0.113.7');
    expect(clientKey(request({ 'x-real-ip': '2001:db8:1:2:aaaa::1' }))).toBe(clientKey(request({ 'x-real-ip': '2001:db8:1:2:bbbb::9' })));
    expect(clientKey(request({ 'x-real-ip': '2001:db8:1:2::1' }))).not.toBe(clientKey(request({ 'x-real-ip': '2001:db8:1:3::1' })));
  });
});

describe('rate limit', () => {
  it('allows a few messages per window, then blocks until the window passes', () => {
    const allow = createRateLimiter({ limit: 2, windowMs: 1000 });
    expect([allow('a', 0), allow('a', 10), allow('a', 20), allow('b', 20)]).toEqual([true, true, false, true]);
    expect(allow('a', 1011)).toBe(true);
  });
});

function setup(overrides: Partial<SupportDeps> = {}) {
  const send = vi.fn(async () => ({ ok: true as const, id: 'email-1' }));
  const deps: SupportDeps = { apiKey: 're_test', to: 'owner@example.com', from: 'DevFiller <onboarding@resend.dev>', send, allow: () => true, now: () => 10_000, log: () => {}, ...overrides };
  return { handler: createSupportHandler(deps), send };
}
const post = (body: unknown, headers: Record<string, string> = {}) => new Request('https://www.devfiller.com/api/support/', {
  method: 'POST',
  headers: { 'content-type': 'application/json', origin: 'https://www.devfiller.com', 'x-forwarded-for': '203.0.113.7, 10.0.0.1', ...headers },
  body: typeof body === 'string' ? body : JSON.stringify(body),
});

describe('support endpoint', () => {
  it('sends a valid message and answers with the success envelope', async () => {
    const { handler, send } = setup();
    const response = await handler(post(valid));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, data: { sent: true }, error: null });
    expect(send).toHaveBeenCalledOnce();
    expect(send.mock.calls[0]).toMatchObject([{ reply_to: 'amina@example.com', to: ['owner@example.com'] }, 're_test']);
  });
  it('explains what to fix when fields are invalid, without sending', async () => {
    const { handler, send } = setup();
    const response = await handler(post({ ...valid, email: 'nope' }));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ success: false, errors: { email: expect.any(String) } });
    expect(send).not.toHaveBeenCalled();
  });
  it('never drops a person whose elapsed time is missing or odd', async () => {
    const { handler, send } = setup();
    for (const elapsedMs of [undefined, -5, 'soon']) await handler(post({ ...valid, elapsedMs }));
    expect(send).toHaveBeenCalledTimes(3);
  });
  it('pretends to accept bots (filled honeypot or instant submit) but sends nothing', async () => {
    const { handler, send } = setup();
    expect((await handler(post({ ...valid, leave_empty: 'http://spam.example' }))).status).toBe(200);
    expect((await handler(post({ ...valid, elapsedMs: 900 }))).status).toBe(200);
    expect(send).not.toHaveBeenCalled();
  });
  it('refuses other sites, other content types, huge bodies and broken JSON', async () => {
    const { handler, send } = setup();
    expect((await handler(post(valid, { origin: 'https://evil.example' }))).status).toBe(403);
    expect((await handler(post(valid, { origin: '' }))).status).toBe(403);
    expect((await handler(post(valid, { 'content-type': 'text/plain' }))).status).toBe(415);
    expect((await handler(post({ ...valid, message: 'x'.repeat(40_000) }))).status).toBe(413);
    expect((await handler(post('{broken'))).status).toBe(400);
    expect(send).not.toHaveBeenCalled();
  });
  it('compares the origin with the host the browser reached, not the server\'s internal address', async () => {
    const { handler, send } = setup();
    const behindProxy = (headers: Record<string, string>) => new Request('http://localhost:3000/api/support/', {
      method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://www.devfiller.com', ...headers }, body: JSON.stringify(valid),
    });
    expect((await handler(behindProxy({ 'x-forwarded-host': 'www.devfiller.com' }))).status).toBe(200);
    expect((await handler(behindProxy({ host: 'www.devfiller.com' }))).status).toBe(200);
    expect((await handler(behindProxy({ 'x-forwarded-host': 'evil.example' }))).status).toBe(403);
    expect(send).toHaveBeenCalledTimes(2);
  });
  it('limits each address and says when to try again', async () => {
    const { handler } = setup({ allow: key => key !== '203.0.113.7' });
    const response = await handler(post(valid));
    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBeTruthy();
  });
  it('fails politely without a key or when Resend fails, and never leaks the provider error', async () => {
    const log = vi.fn();
    const noKey = await setup({ apiKey: undefined, log }).handler(post(valid));
    expect(noKey.status).toBe(503);
    expect((await setup({ to: undefined, log }).handler(post(valid))).status).toBe(503);
    const failing = setup({ send: async () => ({ ok: false as const, status: 422, detail: 'secret provider detail' }), log });
    const response = await failing.handler(post(valid));
    expect(response.status).toBe(502);
    expect(JSON.stringify(await response.json())).not.toContain('secret provider detail');
    expect(log).toHaveBeenCalled();
  });
});
