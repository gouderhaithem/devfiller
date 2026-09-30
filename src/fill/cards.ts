import type { CardScenario } from '../data';
import type { Classification } from './classify';
import type { Control, ControlRun, FillContext } from './types';
import { SOURCE_GROUP, classificationOf, datePart } from './classify';
import { autocompleteToken, isChoice, optionTexts } from './extract';
import { ID_NUMBER_PHRASES } from './dictionary';
import { normalize } from './normalize';
import { setNativeValue } from './apply';
import { firstValid, rememberAlternatives } from './validation';

// Card fields get test cards: the numbers payment sandboxes (Stripe and others) document for
// testing, which no bank ever charges. Each one simulates an outcome; any future expiry and any
// CVC work with all of them.
export const TEST_CARDS: Readonly<Record<CardScenario, { label: string; number: string }>> = {
  success: { label: 'Successful payment', number: '4242 4242 4242 4242' },
  declined: { label: 'Declined card', number: '4000 0000 0000 0002' },
  insufficient: { label: 'Insufficient funds', number: '4000 0000 0000 9995' },
  expired: { label: 'Expired card', number: '4000 0000 0000 0069' },
  cvc: { label: 'Incorrect CVC', number: '4000 0000 0000 0127' },
};
const CVC = '123';
const BRAND = /visa/i;

type CardRole = 'number' | 'expiry' | 'month' | 'year' | 'cvc' | 'name' | 'brand';
const AUTOCOMPLETE_ROLES: Readonly<Record<string, CardRole>> = {
  'cc-number': 'number', 'cc-exp': 'expiry', 'cc-exp-month': 'month', 'cc-exp-year': 'year', 'cc-csc': 'cvc',
  'cc-name': 'name', 'cc-given-name': 'name', 'cc-family-name': 'name', 'cc-additional-name': 'name', 'cc-type': 'brand',
};
// Things near a card that aren't its number, expiry, CVC or holder: a coupon, a gift card, a PIN, a
// 3-D Secure password, an SMS code, a token, the holder's email or address, "last 4 digits".
const NOT_CARD_DATA = /(?:^| )(?:code promo|promo|coupon|voucher|discount|gift|cadeau|reduction|pin|password|passcode|mot de passe|otp|sms|3ds|3d secure|token|email|mail|phone|telephone|address|adresse|nickname|alias|reference|issuer|bank|banque|brand|type|network|last)(?= |$)/;
const CVC_WORDS = /(?:^| )(?:cvc2?|cvv2?|ccv|csc|cid|security code|card verification|cryptogramme|code de securite|رمز الامان)(?= |$)/;
const MONTH_WORDS = /(?:^| )(?:month|mois|mm|شهر)(?= |$)/;
const YEAR_WORDS = /(?:^| )(?:year|annee|yy|yyyy|aa|aaaa|سنة)(?= |$)/;
const EXPIRY_WORDS = /(?:^| )(?:exp|expiry|expiration|expires|expire|valid|validity|validite|thru|date d expiration|انتهاء)(?= |$)/;
const NAME_WORDS = /(?:^| )(?:name|holder|cardholder|titulaire|nom|الاسم|اسم)(?= |$)/;
const NUMBER_WORDS = /(?:^| )(?:number|numero|no|num|card|carte|cc|pan|رقم|البطاقة)(?= |$)/;
// Words that name the card itself: a field only placed beside the card needs them to be its number.
const CARD_WORDS = /(?:^| )(?:card|carte|cc|pan|cb|البطاقة)(?= |$)/;
const OWN_WORDS: ReadonlySet<string> = new Set(['visible', 'attribute']);

const ownText = (found: Classification) => (found.signals ?? []).filter(signal => OWN_WORDS.has(SOURCE_GROUP[signal.source])).map(signal => signal.text).join(' | ');

function cardRole(el: Control, found: Classification): CardRole | undefined {
  if (isChoice(el)) return undefined;
  const declared = AUTOCOMPLETE_ROLES[autocompleteToken(el).toLowerCase()];
  if (declared) return declared;
  // "Card type: Visa / Mastercard" is a choice of brand.
  if (el instanceof HTMLSelectElement && optionTexts(el).some(option => BRAND.test(option))) return 'brand';
  const text = ownText(found);
  if (NOT_CARD_DATA.test(text) || ID_NUMBER_PHRASES.some(phrase => ` ${text} `.includes(` ${phrase} `))) return undefined;
  if (found.role === 'cardholder') return 'name';
  // Marked as card data only for sitting beside the card: its own words must say which part it is.
  const beside = found.evidence.some(item => item.source === 'form' && item.match === 'sensitive');
  if (el instanceof HTMLInputElement && el.type === 'month') return 'expiry';
  if (CVC_WORDS.test(text)) return 'cvc';
  const part = el instanceof HTMLSelectElement ? datePart(optionTexts(el)) : undefined;
  const month = part === 'month' || MONTH_WORDS.test(text), year = part === 'year' || YEAR_WORDS.test(text);
  if (month && year) return 'expiry';
  if (month) return 'month';
  if (year) return 'year';
  if (EXPIRY_WORDS.test(text)) return 'expiry';
  if (NAME_WORDS.test(text)) return 'name';
  return NUMBER_WORDS.test(text) && (!beside || CARD_WORDS.test(text)) ? 'number' : undefined;
}

// A future expiry: December, three years from now.
function expiry(): { month: string; year: string } {
  return { month: '12', year: String(new Date().getFullYear() + 3) };
}

const isSmall = (el: Control) => 'maxLength' in el && el.maxLength > 0 && el.maxLength <= 5;

// "4242 4242 4242 4242", or the digits alone for a field that takes sixteen characters. A number
// split over small boxes side by side gets one group of four per box; a lone small box gets nothing.
function numberCandidates(ctx: FillContext, el: Control, number: string): string[] {
  const digits = number.replace(/\D/g, '');
  if (!isSmall(el)) return 'maxLength' in el && el.maxLength > 0 && el.maxLength < 19 ? [digits, number] : [number, digits];
  const boxes = ctx.controls.filter(other => other.parentElement === el.parentElement && isSmall(other)
    && classificationOf(ctx.classifications, other).type === 'skip:card' && cardRole(other, classificationOf(ctx.classifications, other)) === 'number');
  const index = boxes.indexOf(el);
  const group = boxes.length >= 3 ? digits.slice(index * 4, index * 4 + 4) : '';
  return group ? [group] : [];
}

// "MM/YY", "MM / YY", "MM/YYYY", "MM-YY", "MMYY" or a month input's "YYYY-MM", as the placeholder or
// the label shows it.
function expiryCandidates(el: Control, found: Classification): string[] {
  const { month, year } = expiry();
  const yy = year.slice(2);
  if (el instanceof HTMLInputElement && el.type === 'month') return [`${year}-${month}`];
  const hint = `${el.getAttribute('placeholder') || ''} ${(found.signals ?? []).filter(signal => SOURCE_GROUP[signal.source] === 'visible').map(signal => signal.raw).join(' ')}`.toLowerCase();
  const long = /yyyy|aaaa/.test(hint);
  const separator = / \/ /.test(hint) ? ' / ' : /-/.test(hint) ? '-' : '/';
  return [`${month}${separator}${long ? year : yy}`, `${month}/${yy}`, `${month} / ${yy}`, `${month}/${year}`, `${month}${yy}`];
}

function optionFor(el: HTMLSelectElement, wanted: readonly string[]): string | undefined {
  const options = Array.from(el.options).filter(option => option.value && !option.disabled);
  // "12", "December", or "09" for 9: the whole option, never a number inside it.
  const match = (raw: string) => { const text = normalize(raw); return wanted.includes(text) || (/^\d+$/.test(text) && wanted.includes(String(Number(text)))); };
  return (options.find(option => match(option.value)) ?? options.find(option => match(option.textContent || '')))?.value;
}

function candidates(ctx: FillContext, el: Control, found: Classification, role: CardRole, number: string): string[] {
  const { month, year } = expiry();
  const short = 'maxLength' in el && el.maxLength === 2 || /(?:^|[^y])yy(?!y)/i.test(el.getAttribute('placeholder') || '');
  switch (role) {
    case 'number': return numberCandidates(ctx, el, number);
    case 'expiry': return expiryCandidates(el, found);
    case 'month': return [month, String(Number(month))];
    case 'year': return short ? [year.slice(2), year] : [year, year.slice(2)];
    case 'cvc': return [CVC];
    case 'name': return [ctx.values.fullName];
    case 'brand': return ['visa'];
  }
}

const run = (outcome: ControlRun['outcome'], reason?: string): ControlRun => ({ outcome, source: 'test card', ...(reason ? { reason } : {}) });
export const PROTECTED_CARD = 'Protected payment field';

// Which part of the chosen test card this field takes, or undefined when it stays empty: test
// cards are off, or the field doesn't say which part it is.
export function testCardRole(ctx: FillContext, el: Control): CardRole | undefined {
  const scenario = ctx.request.cards;
  return scenario && scenario !== 'off' ? cardRole(el, classificationOf(ctx.classifications, el)) : undefined;
}

function selectValue(el: HTMLSelectElement, role: CardRole, options: readonly string[]): string | undefined {
  const { month, year } = expiry();
  if (role === 'brand') return Array.from(el.options).find(option => BRAND.test(option.textContent || '') || BRAND.test(option.value))?.value;
  if (role === 'month') return optionFor(el, [month, String(Number(month)), 'december', 'decembre', 'dec']);
  if (role === 'year') return optionFor(el, [year, year.slice(2)]);
  return optionFor(el, options);
}

// Fills one card field with the chosen test card, when the field's part of the card is clear.
export function fillCard(ctx: FillContext, el: Control): ControlRun {
  const role = testCardRole(ctx, el);
  const scenario = ctx.request.cards;
  if (!role || !scenario || scenario === 'off') return run('none', PROTECTED_CARD);
  if (el.value.trim() && !ctx.request.overwrite) return run('preserved');
  const options = candidates(ctx, el, classificationOf(ctx.classifications, el), role, TEST_CARDS[scenario].number);
  const value = el instanceof HTMLSelectElement ? selectValue(el, role, options) : firstValid(el, options);
  if (value === undefined) return run('invalid');
  ctx.touched.add(el);
  setNativeValue(el, value);
  if (!(el instanceof HTMLSelectElement)) rememberAlternatives(el, options.filter(option => option !== value));
  return run(el.value === value ? 'filled' : 'invalid');
}
