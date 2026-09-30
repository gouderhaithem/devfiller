// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { classifyField, matchText, THRESHOLDS, usableKey } from '../src/fill/classify';
import { ALIAS_ENTRIES } from '../src/fill/dictionary';
import { isMeaningless, nearbyText } from '../src/fill/extract';
import { normalize } from '../src/fill/normalize';
import { fillPage, panelPageAction, type FillRequest } from '../src/fill';
import { generateIdentities, generateValues } from '../src/data';
import { generateSamples } from '../src/samples';

const values = generateValues('en');
const request: FillRequest = { values, identities: generateIdentities('en'), samples: generateSamples('en'), custom: [], overwrite: true, fillUnknown: true, passwords: false };
beforeEach(() => {
  document.body.replaceChildren();
  vi.spyOn(Element.prototype, 'getClientRects').mockReturnValue([{}] as unknown as DOMRectList);
});
function classify(html: string, selector = 'input, select, textarea') {
  document.body.innerHTML = `<form>${html}</form>`;
  return classifyField(document.querySelector(selector) as HTMLInputElement);
}
const typeOf = (html: string, selector?: string) => classify(html, selector).type;
const input = (id: string) => document.getElementById(id) as HTMLInputElement;

describe('dictionary', () => {
  it('never gives one alias to two types', () => {
    const owners = new Map<string, string>();
    for (const entry of ALIAS_ENTRIES) {
      expect(owners.get(entry.name) ?? entry.key, `"${entry.name}"`).toBe(entry.key);
      owners.set(entry.name, entry.key);
    }
  });
  it('splits camelCase, capitals and trailing numbers the way developers write names', () => {
    expect(normalize('userEmail')).toBe('user email');
    expect(normalize('nomDUtilisateur')).toBe('nom d utilisateur');
    expect(normalize('addressLine2')).toBe('address line 2');
    expect(normalize('q9')).toBe('q9');
  });
});

describe('matching', () => {
  it('lets a phrase consume its words, so "email address" never votes for address', () => {
    expect(matchText('billing email address').map(([entry, kind]) => [entry.key, kind])).toEqual([['email', 'phrase']]);
  });
  it('matches words inside longer names, glued words, plurals and typos', () => {
    expect(typeOf('<input name="userEmail">')).toBe('email');
    expect(typeOf('<input name="contact_phone">')).toBe('phone');
    expect(typeOf('<input name="useremail">')).toBe('email');
    expect(typeOf('<input name="billingcity">')).toBe('city');
    expect(typeOf('<input name="phonenumber">')).toBe('phone');
    expect(typeOf('<label for="c">Comments</label><textarea id="c"></textarea>')).toBe('message');
    expect(typeOf('<label for="e">Emial</label><input id="e">')).toBe('email');
    expect(typeOf('<label for="f">Frist name</label><input id="f">')).toBe('firstName');
  });
  it('keeps generic words from guessing: a project name is not a person', () => {
    expect(typeOf('<label for="p">Project name</label><input id="p">')).toBe('unknown');
    expect(typeOf('<label for="d">Delivery window date</label><input id="d">')).toBe('unknown');
    expect(typeOf('<label for="d">Release date</label><input id="d" type="date">')).toBe('date');
  });
  it('does not stretch typo matching across different words', () => {
    expect(typeOf("<label for='n'>Numéro d'identification nationale</label><input id='n'>")).toBe('unknown');
    expect(typeOf('<label for="p">Passport number</label><input id="p">')).toBe('unknown');
  });
});

describe('scoring', () => {
  it('reports a confidence and the evidence behind it', () => {
    const result = classify('<label for="t">Téléphone</label><input id="t" type="tel" autocomplete="tel" inputmode="tel">');
    expect(result.type).toBe('phone');
    expect(result.confidence).toBeGreaterThanOrEqual(THRESHOLDS.high);
    expect(result.evidence.map(e => e.source)).toEqual(expect.arrayContaining(['autocomplete', 'label', 'type']));
  });
  it('lets the visible label outvote a misleading name', () => {
    expect(typeOf('<label for="x">Company</label><input id="x" name="firstName">')).toBe('company');
    expect(typeOf('<label for="x">Phone number</label><input id="x" name="email">')).toBe('phone');
  });
  it('treats close runners-up as ambiguous and says unknown', () => {
    const result = classify('<label for="x">Email or phone</label><input id="x">');
    expect(result.type).toBe('unknown');
    expect(result.candidates.map(c => c.type)).toEqual(expect.arrayContaining(['email', 'phone']));
  });
  it('pushes down types the control cannot hold', () => {
    expect(typeOf('<input type="password" name="email">')).toBe('password');
    expect(typeOf('<label for="s">Search city</label><input id="s">')).toBe('search');
    expect(typeOf('<label for="c">Confirm email</label><input id="c" type="email">')).toBe('email');
  });
  it('reads nearby text, table cells and a select placeholder when there is no label', () => {
    expect(typeOf('<div><span>Your name</span><input name="a1"></div>')).toBe('fullName');
    expect(typeOf('<table><tr><td>Job title</td><td><input name="t1"></td></tr></table>')).toBe('jobTitle');
    expect(typeOf('<select name="a8"><option value="">Select country</option><option>France</option></select>')).toBe('country');
    document.body.innerHTML = '<div><input type="checkbox" id="c"><span>I agree to the terms</span></div>';
    expect(nearbyText(input('c'))).toBe('I agree to the terms');
  });
  it('ignores generated names but still reads the label', () => {
    expect(isMeaningless('field_7')).toBe(true);
    expect(isMeaningless('mat-input-3')).toBe(true);
    expect(isMeaningless(':r5:')).toBe(true);
    expect(isMeaningless('3f2b8c1e-9a47-4d6e-b0c5-7e1a2d9f4b68')).toBe(true);
    expect(isMeaningless('user_email')).toBe(false);
    expect(typeOf('<label for="mat-input-3">Email address</label><input id="mat-input-3" name="field2">')).toBe('email');
  });
  it('classifies a radio group from its question, not from one answer', () => {
    expect(typeOf('<fieldset><legend>How satisfied are you?</legend><label><input type="radio" name="q6"> 1</label></fieldset>')).toBe('rating');
    expect(typeOf('<label><input type="radio" name="gender"> Male</label>')).toBe('gender');
  });
  it('only fills low-confidence guesses when the user allows guessing', () => {
    const guess = { type: 'phone' as const, confidence: 0.6, candidates: [], evidence: [] };
    expect(usableKey(guess, true)).toBe('phone');
    expect(usableKey(guess, false)).toBeUndefined();
    expect(usableKey({ ...guess, confidence: 0.8 }, false)).toBe('phone');
  });
});

describe('sensitive fields', () => {
  it.each([
    ['<input autocomplete="cc-number">', 'skip:card'],
    ['<label for="x">Name on card</label><input id="x">', 'skip:card'],
    ['<input name="cvv">', 'skip:card'],
    ['<input placeholder="MM / YY">', 'skip:card'],
    ['<label for="x">IBAN</label><input id="x">', 'skip:iban'],
    ['<input name="sepa_bic">', 'skip:iban'],
    ['<label for="x">Account holder</label><input id="x">', 'skip:iban'],
    ['<label for="x">Code de vérification</label><input id="x">', 'skip:otp'],
    ['<input autocomplete="one-time-code">', 'skip:otp'],
    ['<fieldset><legend>Card details</legend><input name="number"></fieldset>', 'skip:card'],
  ])('recognizes %s as %s', (html, expected) => {
    expect(typeOf(html)).toBe(expected);
  });
  it.each([
    'Yes, send me special offers',
    'I would like to receive marketing emails',
    'Share my details with event sponsors',
    "J'accepte les conditions générales",
    'أوافق على الشروط',
  ])('treats "%s" as consent', label => {
    expect(typeOf(`<label><input type="checkbox"> ${label}</label>`)).toBe('skip:consent');
  });
  it('leaves ordinary checkboxes and contact-method radios alone', () => {
    expect(typeOf('<label><input type="checkbox"> Remember me</label>')).toBe('skip:session');
    expect(typeOf('<label><input type="checkbox"> Same as billing address</label>')).toBe('unknown');
    expect(typeOf('<fieldset><legend>Preferred contact method</legend><label><input type="radio" name="via"> Email</label></fieldset>')).toBe('unknown');
  });
  it('never fills bank fields or marketing opt-ins, even with every filler switched on', () => {
    document.body.innerHTML = '<label for="iban">IBAN</label><input id="iban"><label><input type="checkbox" id="offers"> Send me special offers</label><input id="email" type="email">';
    const result = fillPage({ ...request, passwords: true, exclusions: { skipSearch: false, skipHeader: false, rules: [] } });
    expect(input('iban').value).toBe('');
    expect(input('offers').checked).toBe(false);
    expect(input('email').value).toBe(values.email);
    expect(result.fields?.find(f => f.label === 'IBAN')).toMatchObject({ status: 'skipped', reason: 'Protected bank account field' });
  });
});

describe('review regressions', () => {
  it.each([
    ['<input name="ccnum">', 'skip:card'], ['<input name="cardnum">', 'skip:card'], ['<input name="cardcvc">', 'skip:card'], ['<input name="cc_exp">', 'skip:card'],
    ['<label for="x">Expiry date</label><input id="x">', 'skip:card'], ['<label for="x">Expiration</label><input id="x" type="month">', 'skip:card'],
    ['<label for="x">Expiration month</label><select id="x"><option>01</option></select>', 'skip:card'],
    ['<label for="x">Card PIN</label><input id="x">', 'skip:card'], ['<label for="x">Security PIN</label><input id="x">', 'skip:card'],
    ['<label for="x">Card</label><input id="x">', 'skip:card'], ['<input name="smscode">', 'skip:otp'],
    ['<label for="x">Account no</label><input id="x">', 'skip:iban'],
  ])('keeps %s out of the fill as %s', (html, expected) => {
    expect(typeOf(html)).toBe(expected);
  });
  it.each(['I have read and understood the cookie policy', 'I certify the above is true', 'I am over 18', 'I acknowledge the risks', "J'atteste sur l'honneur l'exactitude des informations"])('treats the declaration "%s" as consent', label => {
    expect(typeOf(`<label><input type="checkbox"> ${label}</label>`)).toBe('skip:consent');
  });
  it('keeps sensitive words from swallowing ordinary fields', () => {
    expect(typeOf('<label for="x">Mobile number</label><input id="x" name="sms_phone" type="tel">')).toBe('phone');
    expect(typeOf('<label for="x">Promo code</label><input id="x" placeholder="Enter code">')).toBe('unknown');
    expect(typeOf('<label for="x">Username</label><input id="acct-user">')).toBe('username');
  });
  it('does not treat a checkbox about a card as card data', () => {
    expect(typeOf('<label><input type="checkbox"> Mémoriser cette carte</label>')).toBe('unknown');
  });
  it.each([['Page size', 'unknown'], ['Down payment', 'unknown'], ['Bank statement', 'unknown'], ['Real estate', 'unknown'], ['Headphone model', 'unknown']])('does not stretch "%s" into a known type', (label, expected) => {
    expect(typeOf(`<label for="x">${label}</label><input id="x">`)).toBe(expected);
  });
  it('still reads glued names with a meaningful rest', () => {
    for (const [name, type] of [['orderquantity', 'quantity'], ['numerotelephone', 'phone'], ['mobilephone', 'phone'], ['shippingpostalcode', 'postalCode']]) expect(typeOf(`<input name="${name}">`), name).toBe(type);
  });
  it('never picks a sensitive radio in a group', () => {
    document.body.innerHTML = '<form><input type="radio" name="g" id="a" title="I agree to the terms"><input type="radio" name="g" id="b"></form>';
    for (let i = 0; i < 10; i++) { fillPage(request); expect(input('a').checked).toBe(false); }
  });
  it('says before a fill which fields guessing-off will leave alone, and keeps them editable', () => {
    document.body.innerHTML = '<input id="mystery"><label for="e">Email</label><input id="e">';
    const fields = fillPage({ ...request, fillUnknown: false, mode: 'inspect' }).fields!;
    expect(fields.find(f => f.label === 'mystery')).toMatchObject({ status: 'skipped', reason: 'No matching generator', editable: true });
    expect(fields.find(f => f.label === 'Email')).toMatchObject({ status: 'ready' });
  });
  it('names the real reason when a radio group is left alone', () => {
    document.body.innerHTML = '<form><input type="radio" name="size" id="s"><input type="radio" name="size" id="m"></form>';
    const result = fillPage({ ...request, exclusions: { skipSearch: false, skipHeader: false, rules: [{ id: '1', match: 'selector', value: '#m', site: '' }] } });
    expect(result.fields![0].reason).toBe('Another option in this group is excluded');
  });
});

describe('explainability', () => {
  it('reports each field\'s type, confidence and evidence to the side panel', () => {
    document.body.innerHTML = '<label for="t">Téléphone</label><input id="t" autocomplete="tel"><input id="mystery">';
    const result = fillPage({ ...request, mode: 'inspect' });
    const phone = result.fields!.find(f => f.label === 'Téléphone')!;
    expect(phone.detected).toMatchObject({ type: 'phone', label: 'Phone' });
    expect(phone.detected!.evidence).toEqual(expect.arrayContaining(['autocomplete=tel', 'label “Téléphone”']));
    expect(result.fields!.find(f => f.label === 'mystery')!.detected).toMatchObject({ type: 'unknown', label: 'Unknown' });
  });
  it('explains low-confidence skips when guessing is off', () => {
    document.body.innerHTML = '<input id="x" placeholder="Company (optional)">';
    const result = fillPage({ ...request, fillUnknown: false });
    expect(input('x').value).toBe('');
    expect(result.fields![0].reason).toMatch(/^Not sure this is company \(\d+%\)/);
  });
  it('draws and removes the on-page type overlay', () => {
    document.body.innerHTML = '<label for="e">Email</label><input id="e" type="email">';
    const { documentId } = fillPage({ ...request, mode: 'inspect' });
    const before = document.documentElement.childElementCount;
    expect(panelPageAction('overlay', documentId!, 'on')).toEqual({ overlay: true });
    expect(document.documentElement.childElementCount).toBe(before + 1);
    expect(panelPageAction('overlay', documentId!, 'off')).toEqual({ overlay: false });
    expect(document.documentElement.childElementCount).toBe(before);
  });
});
