import type { Control, ControlRun, FillContext } from './types';
import { CONSENT } from './dictionary';
import { composedText, isChoice, isInput } from './extract';
import { normalize } from './normalize';
import { setNativeChecked, setNativeValue } from './apply';

// Sensitive fields are filled with values that read as tests at a glance, like the test cards:
// a one-time code of 4s, a bank account of 4s, consent ticked, "Test" where a consent asks for text.
// Bank numbers keep their checksums (IBAN, US routing) so a form's own check lets them through.

// An IBAN's check digits: the number, country moved to the end, must be ≡ 1 (mod 97) (ISO 13616).
function iban(country: string, bban: string): string {
  const digits = (bban + country + '00').replace(/[A-Z]/g, ch => String(ch.charCodeAt(0) - 55));
  const rest = [...digits].reduce((sum, digit) => (sum * 10 + Number(digit)) % 97, 0);
  return `${country}${String(98 - rest).padStart(2, '0')}${bban}`;
}
export const TEST_IBAN = iban('DE', '4'.repeat(18));
export const TEST_BIC = 'TESTDE44';
// US routing numbers carry a checksum that no run of 4s passes: Stripe's documented test number.
export const TEST_ROUTING = '110000000';
export const TEST_ACCOUNT = '444444444444';
export const TEST_SORT_CODE = '44-44-44';
export const TEST_TEXT = 'Test';
const OTP_LENGTH = 6;

export type TestKind = 'otp' | 'iban' | 'consent' | 'session';
const BANK_VALUES = [TEST_IBAN, TEST_BIC, TEST_ROUTING, TEST_ACCOUNT, TEST_SORT_CODE].map(value => value.replace(/[\s-]/g, ''));
// Whether a filled value is the test value of its kind (the benchmark's check that nothing real
// lands in a sensitive field).
export function isTestValue(kind: TestKind, value: string): boolean {
  const plain = value.replace(/[\s-]/g, '');
  if (!plain) return true;
  if (kind === 'otp') return /^4+$/.test(plain);
  if (kind === 'iban') return BANK_VALUES.some(test => test === plain.toUpperCase() || (/^4+$/.test(plain)));
  // Consent and session fields take the page's own agreeing answer, or the word Test.
  return true;
}

const said = (el: Control) => normalize([el.getAttribute('name') || '', el.id, el.getAttribute('aria-label') || '', el.getAttribute('placeholder') || '', ...(isInput(el) || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement ? Array.from(el.labels || [], label => label.textContent || '') : [])].join(' '));
function bankValue(el: Control): string {
  const text = ` ${said(el)} `;
  if (/ iban | rib /.test(text) || text.includes('iban')) return TEST_IBAN;
  if (/ (?:bic|swift)/.test(text)) return TEST_BIC;
  if (/ (?:routing|aba|rtn|transit)/.test(text)) return TEST_ROUTING;
  if (/ sort code/.test(text)) return TEST_SORT_CODE;
  return TEST_ACCOUNT;
}
// The code's length: what the box holds, six by default; a one-character box takes one digit.
const otpValue = (el: Control) => {
  const max = 'maxLength' in el ? el.maxLength : -1;
  return '4'.repeat(max > 0 && max <= 12 ? max : OTP_LENGTH);
};
// A box too short for the value ("RIB", maxlength 20) gets 4s to its length: still a test value,
// never a cut-off IBAN.
const fit = (el: Control, value: string) => {
  const max = 'maxLength' in el ? el.maxLength : -1;
  return max > 0 && value.length > max ? '4'.repeat(max) : value;
};

// The answer that agrees: "Yes", "I agree", "Oui"; failing that, the first real answer.
const YES = /^(?:yes|y|oui|si|sí|ja|true|1|on|نعم)$|(?:^| )(?:yes|agree|accept|consent|allow|oui|j accepte|نعم|موافق)(?: |$)/u;
const NO = /^(?:no|n|non|nein|false|0|off|لا)$|(?:^| )(?:no|not|don t|do not|never|decline|non|ne pas|لا)(?: |$)/u;
function agreeing<T>(items: readonly T[], text: (item: T) => string): T | undefined {
  const texts = items.map(item => normalize(text(item)));
  const yes = items.find((_, i) => YES.test(texts[i]) && !NO.test(texts[i]));
  return yes ?? items.find((_, i) => texts[i] && !NO.test(texts[i])) ?? items[0];
}
export const agreeingOption = agreeing;

const run = (outcome: ControlRun['outcome'], reason: string): ControlRun => ({ outcome, source: reason.toLowerCase(), reason });
const KIND_NAME: Readonly<Record<TestKind, string>> = { otp: 'one-time code', iban: 'bank details', consent: 'consent', session: 'stay signed in' };

// Fills one sensitive field (not a card: those take a test card) with its test value.
export function fillSensitive(ctx: FillContext, el: Control, kind: TestKind): ControlRun {
  const { request } = ctx;
  const reason = `Test value (${KIND_NAME[kind]})`;
  if (isChoice(el)) {
    if (el.type === 'radio') {
      const group = el.name ? Array.from((el.form ?? el.ownerDocument).querySelectorAll<HTMLInputElement>('input[type="radio"]')).filter(radio => radio.name === el.name && radio.form === el.form) : [el];
      if (!request.overwrite && group.some(radio => radio.checked)) return run('preserved', reason);
      const target = agreeing(group.filter(radio => !radio.disabled), radio => [radio.value, ...Array.from(radio.labels || [], composedText)].join(' '));
      if (!target) return run('none', reason);
      if (!target.checked) setNativeChecked(target, true);
      for (const radio of group) ctx.touched.add(radio);
      return run('filled', reason);
    }
    if (el.checked) return run('preserved', reason);
    setNativeChecked(el, true);
    ctx.touched.add(el);
    return run('filled', reason);
  }
  if (el instanceof HTMLSelectElement) {
    if (!request.overwrite && el.value) return run('preserved', reason);
    const options = Array.from(el.options).filter((option, i) => !option.disabled && (i > 0 || option.value !== ''));
    const target = kind === 'consent' || kind === 'session' ? agreeing(options, option => `${option.textContent || ''} ${option.value}`) : options[0];
    if (!target) return run('none', reason);
    setNativeValue(el, target.value);
    ctx.touched.add(el);
    return run('filled', reason);
  }
  if (!request.overwrite && el.value) return run('preserved', reason);
  const value = kind === 'otp' ? otpValue(el) : kind === 'iban' ? fit(el, bankValue(el)) : TEST_TEXT;
  setNativeValue(el, value);
  ctx.touched.add(el);
  return run('filled', reason);
}

export const testKind = (type: string): TestKind | undefined =>
  type === 'skip:otp' ? 'otp' : type === 'skip:iban' ? 'iban' : type === 'skip:consent' ? 'consent' : type === 'skip:session' ? 'session' : undefined;

// A checkbox whose words ask permission though the rules typed it otherwise: ticked as consent.
export const looksLikeConsent = (signals: readonly string[], legend: string) => signals.some(s => CONSENT.test(s)) || CONSENT.test(legend);
