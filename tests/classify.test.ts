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

// Labels settled in benchmark/fixtures/README.md ("Settled cases").
describe('settled labels', () => {
  it.each([
    ['<label for="x">Account holder</label><input id="x">', 'fullName'],
    ['<label for="x">Account holder name</label><input id="x">', 'fullName'],
    ['<input name="bank_account_holder" aria-label="Holder">', 'fullName'],
    ['<label for="x">Titulaire du compte</label><input id="x">', 'fullName'],
    ['<fieldset><legend>Bank details</legend><label for="x">Account holder name</label><input id="x"></fieldset>', 'fullName'],
    ['<label for="x">Place of birth</label><input id="x">', 'city'],
    ['<label for="x">Lieu de naissance</label><input id="x">', 'city'],
    ['<input name="lieu_naissance">', 'city'],
    ['<label for="x">مكان الميلاد</label><input id="x">', 'city'],
  ])('recognizes %s as %s', (html, expected) => {
    expect(typeOf(html)).toBe(expected);
  });
});

// Consent questions from real forms (UCI sample, 1 October 2026): the box's words sit outside its label.
describe('consent text beside the box', () => {
  it.each([
    ['an empty label with the text a few wrappers away', '<p><span><span><span><label><input type="checkbox" name="checkbox-9[]"><span></span></label></span></span></span><span>I have read and accept the Privacy Notice</span></p>'],
    ['the next table cell', '<table><tr><td><input type="checkbox" name="approve"></td><td>I grant permission for changes to the text I have provided.</td></tr></table>'],
    ['a one-word aria-label', '<div><span><input type="checkbox" aria-label="controlled"></span><p>I agree to receive follow-up calls from company representatives</p></div>'],
    ['Gift Aid', '<label><input type="checkbox"> Yes, add Gift Aid to my donation</label>'],
    ['saving a payment method', '<label><input type="checkbox"> Save payment information to my account for future purchases</label>'],
  ])('treats %s as consent', (_, html) => {
    expect(typeOf(html)).toBe('skip:consent');
  });
  it('reads the question over a list, past a required mark', () => {
    expect(typeOf('<div><strong>Which newsletters would you like to receive?</strong> <span>*</span><ul><li><input type="checkbox" id="a"><label for="a">Student news</label></li><li><input type="checkbox" id="b"><label for="b">Staff news</label></li></ul></div>')).toBe('skip:consent');
  });
  it('reads the question past a "See more" link', () => {
    expect(typeOf('<div><div>Data sharing with our partners</div><div><a>See more</a></div><div><label>Yes <input type="radio" name="tp" value="y"></label><label>No <input type="radio" name="tp" value="n"></label></div></div>')).toBe('skip:consent');
  });
  it('leaves an ordinary choice in a table alone', () => {
    expect(typeOf('<table><tr><td><input type="checkbox" name="veg"></td><td>Vegetarian</td></tr></table>')).toBe('unknown');
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
    ['<label for="x">RIB du titulaire</label><input id="x">', 'skip:iban'],
    ['<fieldset><legend>Bank details</legend><label for="x">Account number</label><input id="x"></fieldset>', 'skip:iban'],
    ['<input aria-label="Beneficiary bank account">', 'skip:iban'],
    ['<input aria-label="Compte bancaire du bénéficiaire">', 'skip:iban'],
    ['<input aria-label="Bank account # of holder">', 'skip:iban'],
    ['<input aria-label="Compte bancaire" name="nom_titulaire">', 'skip:iban'],
    ['<input aria-label="Titulaire" name="compte_bancaire">', 'skip:iban'],
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
    'Allow support staff to sign in to my account for 7 days',
    'Grant access to my account while you investigate',
    'Je permets au support d’accéder à mon compte',
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
  it.each([['Page size', 'unknown'], ['Payment terms', 'unknown'], ['Bank statement', 'unknown'], ['Real estate', 'unknown'], ['Headphone model', 'unknown']])('does not stretch "%s" into a known type', (label, expected) => {
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

// Real fields from the UCI web form crawl (scripts/uci), where the engine and their classifier
// disagreed and the engine was wrong.
describe('real-world fields', () => {
  it('reads a postal code on a type="tel" input, which some sites use for the number pad', () => {
    expect(typeOf('<label for="z">ZIP Code</label><input type="tel" id="z" name="/atg/userprofiling/ProfileFormHandler.value.registrationPostalCode">')).toBe('postalCode');
    expect(typeOf('<input type="tel" name="PostalCode" title="Postal Code (required)" autocomplete="postal-code" pattern="^\\d{5}([\\-]\\d{4})?$">')).toBe('postalCode');
    expect(typeOf('<label for="p">Postcode:</label><input type="tel" id="p" name="bboxdonation$billing$billingAddress$txtAUPostCode" placeholder="postcode">')).toBe('postalCode');
  });

  it('still reads a type="tel" input as a phone when its words say little', () => {
    expect(typeOf('<input type="tel" name="field_7">')).toBe('phone');
    expect(typeOf('<label for="c">Contact</label><input type="tel" id="c">')).toBe('phone');
  });

  it('ignores autocomplete="new-password" on a text field, a common way to turn browser autofill off', () => {
    expect(typeOf('<label for="n">Name</label><input type="text" id="n" name="input_80" autocomplete="new-password">')).toBe('fullName');
    expect(typeOf('<label for="e">Email</label><input type="text" id="e" name="input_3" autocomplete="new-password">')).toBe('email');
  });

  it('fills such a field even with password filling off, and still leaves real passwords alone', () => {
    document.body.innerHTML = '<form><label for="n">Name</label><input type="text" id="n" name="input_80" autocomplete="new-password"><label for="p">Password</label><input type="text" id="p" name="input_81" autocomplete="new-password"><input type="text" id="f82" name="input_82" autocomplete="new-password"></form>';
    fillPage({ ...request, passwords: false, exclusions: { skipSearch: false, skipHeader: false, rules: [] } });
    expect(input('n').value).not.toBe('');
    expect(input('p').value).toBe('');
    expect(input('f82').value).toBe('');
  });

  it('still reads a password field by its type or its words', () => {
    expect(typeOf('<input type="password" name="input_9" autocomplete="new-password">')).toBe('password');
    expect(typeOf('<label for="p">Password</label><input type="text" id="p" autocomplete="current-password">')).toBe('password');
  });

  it("doesn't take the name of a thing for a person's name", () => {
    for (const html of [
      '<label for="f">Facility Name</label><input type="text" id="f" name="facilityName">',
      '<label for="a">What is the Agency\'s Name?</label><input type="text" id="a" name="fFBrokerAgencyName">',
      '<label for="t">Test Name</label><input type="text" id="t" name="input_31">',
      '<label for="e">Name of the event</label><input type="text" id="e">',
      '<label for="p">Nom du projet</label><input type="text" id="p">',
      '<label for="o">OS Name</label><input type="text" id="o" name="item_os_name_impacted1">',
    ]) expect(typeOf(html), html).not.toBe('fullName');
  });

  it("rules out every person-name type for a thing's name, not only the full name", () => {
    expect(classify('<label for="f">Facility Name</label><input type="text" id="f">').ruledOut).toEqual(expect.arrayContaining(['fullName', 'firstName', 'middleName', 'lastName']));
  });

  it('reads the people named after a thing: "Name of the project manager"', () => {
    for (const label of ['Name of the project manager', 'Name of your team lead', 'Name of the school principal', 'Name of the pet owner']) {
      const found = classify(`<label for="n">${label}</label><input type="text" id="n">`);
      expect(found.ruledOut ?? [], label).not.toContain('fullName');
    }
    expect(typeOf('<label for="n">Name of the project manager</label><input type="text" id="n">')).toBe('fullName');
  });

  it("goes by the visible label when only the field's name says it's a thing", () => {
    expect(typeOf('<label for="g">Full name</label><input type="text" id="g" name="group_name">')).toBe('fullName');
    expect(typeOf('<label for="c">Your name</label><input type="text" id="c" name="clinic_name">')).toBe('fullName');
  });

  it("still reads a person's name", () => {
    expect(typeOf('<label for="n">Name</label><input type="text" id="n">')).not.toBe('unknown');
    expect(typeOf('<label for="c">Contact Name *</label><input type="text" id="c">')).toBe('fullName');
    expect(typeOf('<label for="h">Account holder name</label><input type="text" id="h">')).toBe('fullName');
  });
});
