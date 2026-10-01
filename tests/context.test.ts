// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { analyzePage } from '../src/fill/context';
import { listControls } from '../src/fill/extract';
import { fillPage, type FillRequest } from '../src/fill';
import { generateIdentities, generateValues } from '../src/data';
import { generateSamples } from '../src/samples';

const values = generateValues('en');
const request: FillRequest = { values, identities: generateIdentities('en'), samples: generateSamples('en'), custom: [], overwrite: true, fillUnknown: true, passwords: true, exclusions: { skipSearch: false, skipHeader: false, rules: [] } };
beforeEach(() => {
  document.body.replaceChildren();
  vi.spyOn(Element.prototype, 'getClientRects').mockReturnValue([{}] as unknown as DOMRectList);
});
const el = <T extends Element = HTMLInputElement>(id: string) => document.getElementById(id) as unknown as T;
function analyze(html: string) {
  document.body.innerHTML = html;
  return analyzePage(listControls());
}
const typeOf = (html: string, id: string) => analyze(html).fields.get(el(id))!.type;
const options = (list: string[]) => list.map(text => `<option>${text}</option>`).join('');

describe('options', () => {
  it('recognizes unlabelled selects from their options', () => {
    expect(typeOf(`<select id="s">${options(['Algérie', 'Maroc', 'Tunisie', 'France'])}</select>`, 's')).toBe('country');
    expect(typeOf('<select id="s"><option value="">—</option><option value="16">16 - Alger</option><option value="31">31 - Oran</option><option value="09">09 - Blida</option></select>', 's')).toBe('state');
    expect(typeOf('<select id="s"><option value="">—</option><option>Homme</option><option>Femme</option></select>', 's')).toBe('gender');
    expect(typeOf(`<select id="s">${options(['Algérienne', 'Française', 'Marocaine'])}</select>`, 's')).toBe('nationality');
    expect(typeOf(`<select id="s">${options(['Option A', 'Option B', 'Option C'])}</select>`, 's')).toBe('unknown');
  });
  it('recognizes a radio group from its answers and picks the one matching the generated value', () => {
    const html = '<form><label><input type="radio" name="r" id="m"> Masculin</label><label><input type="radio" name="r" id="f"> Féminin</label></form>';
    expect(typeOf(html, 'm')).toBe('gender');
    fillPage({ ...request, values: { ...values, gender: 'Female' } });
    expect(el('f').checked).toBe(true);
    fillPage({ ...request, values: { ...values, gender: 'Male' } });
    expect(el('m').checked).toBe(true);
  });
  it('picks the matching wilaya even when the option carries its code', () => {
    document.body.innerHTML = '<label for="w">Wilaya</label><select id="w"><option value="">Choisir</option><option value="31">31 - Oran</option><option value="16">16 - Alger</option></select>';
    fillPage({ ...request, values: { ...values, state: 'Algiers' } });
    expect(el<HTMLSelectElement>('w').value).toBe('16');
  });
  it('fills split day, month and year selects with one date', () => {
    const days = Array.from({ length: 31 }, (_, i) => `<option>${i + 1}</option>`).join('');
    const months = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'].map((m, i) => `<option value="${i + 1}">${m}</option>`).join('');
    const years = Array.from({ length: 80 }, (_, i) => `<option>${2008 - i}</option>`).join('');
    document.body.innerHTML = `<form><fieldset><legend>Date de naissance</legend><select id="d"><option value="">Jour</option>${days}</select><select id="m"><option value="">Mois</option>${months}</select><select id="y"><option value="">Année</option>${years}</select></fieldset></form>`;
    expect(analyzePage(listControls()).fields.get(el('m'))!.type).toBe('birthDate');
    fillPage({ ...request, values: { ...values, birthDate: '1990-07-14' } });
    expect([el<HTMLSelectElement>('d').value, el<HTMLSelectElement>('m').value, el<HTMLSelectElement>('y').value]).toEqual(['14', '7', '1990']);
  });
});

describe('pairs and roles', () => {
  it('ties a field labelled only "Confirm" to the email before it, and copies what was written', () => {
    const html = '<form><label for="e">Email</label><input id="e" type="email" maxlength="12"><label for="c">Confirm</label><input id="c"></form>';
    const found = analyze(html).fields.get(el('c'))!;
    expect(found).toMatchObject({ type: 'email', role: 'confirm', pairOf: el('e') });
    fillPage(request);
    expect(el('e').value).toHaveLength(12);
    expect(el('c').value).toBe(el('e').value);
  });
  it('gives the current password a different value from the new one and its confirmation', () => {
    document.body.innerHTML = '<form><label for="o">Mot de passe actuel</label><input id="o" type="password"><label for="n">Nouveau mot de passe</label><input id="n" type="password"><label for="c">Confirmer le nouveau mot de passe</label><input id="c" type="password"></form>';
    const fields = analyzePage(listControls()).fields;
    expect([fields.get(el('o'))!.role, fields.get(el('n'))!.role, fields.get(el('c'))!.role]).toEqual(['current', 'new', 'confirm']);
    fillPage(request);
    expect(el('n').value).not.toBe(el('o').value);
    expect(el('c').value).toBe(el('n').value);
  });
  it('fills a login password normally', () => {
    document.body.innerHTML = '<form><input id="u" name="username"><input id="p" type="password" autocomplete="current-password"></form>';
    fillPage(request);
    expect(el('p').value).toBe(values.password);
  });
});

describe('dates', () => {
  it.each([
    ['Arrival / Departure', '<label for="a">Arrival</label><input type="date" id="a"><label for="b">Departure</label><input type="date" id="b">'],
    ['From / To', '<label for="a">From</label><input type="date" id="a"><label for="b">To</label><input type="date" id="b">'],
    ['Du / Au', '<label for="a">Du</label><input type="date" id="a"><label for="b">Au</label><input type="date" id="b">'],
    ['من / إلى', '<label for="a">من</label><input type="date" id="a"><label for="b">إلى</label><input type="date" id="b">'],
    ['an unlabelled date after a departure date', '<label for="a">Departure date</label><input type="date" id="a"><input type="date" id="b">'],
  ])('reads %s as a start and an end', (_, html) => {
    const fields = analyze(`<form>${html}</form>`).fields;
    expect(fields.get(el('a'))!.type).toBe('startDate');
    expect(fields.get(el('b'))).toMatchObject({ type: 'endDate', role: 'end', after: el('a') });
  });
  it('keeps the end date after the start date when the start has a later minimum', () => {
    document.body.innerHTML = '<form><label for="a">From</label><input type="date" id="a" min="2030-01-01"><label for="b">To</label><input type="date" id="b"></form>';
    for (let i = 0; i < 5; i++) {
      fillPage(request);
      expect(el('b').value > el('a').value).toBe(true);
    }
  });
});

describe('form context', () => {
  it('skips a name field beside card fields but fills the shipping name', () => {
    document.body.innerHTML = '<form><section><label for="s">Name</label><input id="s"><label for="c">City</label><input id="c"></section><section><label for="p">Name</label><input id="p"><label for="n">Card number</label><input id="n"></section></form>';
    const result = fillPage(request);
    expect(el('s').value).toBe(values.fullName);
    expect(el('p').value).toBe('');
    expect(result.fields!.filter(f => f.label === 'Name').map(f => f.detected?.type)).toEqual(['fullName', 'skip:card']);
  });
  it.each([
    ['login', '<input type="email" name="email"><input type="password" name="pw">'],
    ['signup', '<input name="first_name"><input type="email" name="email"><input type="password" name="pw"><input type="password" name="pw2">'],
    ['checkout', '<input name="address"><input name="city"><input autocomplete="cc-number">'],
    ['booking', '<label for="a">Check-in</label><input type="date" id="a"><label for="b">Check-out</label><input type="date" id="b">'],
    ['contact', '<input type="email" name="email"><textarea name="message"></textarea>'],
    ['other', '<input name="company"><input name="industry">'],
  ])('recognizes a %s form', (type, fields) => {
    const { forms } = analyze(`<form>${fields}</form>`);
    expect(forms[0].type).toBe(type);
  });
  it('recognizes a search form from its role', () => {
    expect(analyze('<form role="search"><input name="q"></form>').forms[0].type).toBe('search');
  });
  it('leaves "remember me" as the user set it', () => {
    document.body.innerHTML = '<form><label><input type="checkbox" id="r"> Remember me</label></form>';
    const result = fillPage(request);
    expect(el('r').checked).toBe(false);
    expect(result.fields![0].reason).toBe('Session choice stays untouched');
  });
  it('raises a weak guess that fits the field before it', () => {
    const plain = analyze('<form><input id="x" placeholder="Surname please"></form>').fields.get(el('x'))!;
    const after = analyze('<form><label for="f">First name</label><input id="f"><input id="x" placeholder="Surname please"></form>').fields.get(el('x'))!;
    expect(after.type).toBe('lastName');
    expect(after.confidence).toBeGreaterThanOrEqual(plain.confidence);
  });
});

describe('Phase D review regressions', () => {
  const months = (list: string[], zeroBased = false) => list.map((m, i) => `<option value="${zeroBased ? i : i + 1}">${m}</option>`).join('');
  it('never retypes a card-expiry date as an end date', () => {
    document.body.innerHTML = '<form><label for="a">Start date</label><input type="date" id="a"><label for="b">End of validity</label><input type="date" id="b" autocomplete="cc-exp"></form>';
    fillPage(request);
    expect(el('b').value).toBe('');
  });
  it('survives a start date written in another format', () => {
    document.body.innerHTML = '<form><label for="a">Start date</label><input id="a" value="3/5/2026"><label for="b">End date</label><input type="date" id="b"><input id="c" name="email" type="email"></form>';
    expect(() => fillPage({ ...request, overwrite: false })).not.toThrow();
    expect(el('c').value).toBe(values.email);
  });
  it('pairs a confirmation with the field its words name', () => {
    document.body.innerHTML = '<form><label for="e">Email</label><input id="e"><label for="u">Username</label><input id="u"><label for="c">Re-enter email</label><input id="c"></form>';
    fillPage(request);
    expect(el('c').value).toBe(el('e').value);
  });
  it('repeats a prefilled or read-only first field, and never copies into a textarea or a code field', () => {
    document.body.innerHTML = '<form><label for="e">Email</label><input id="e" value="mine@x.com"><label for="c">Confirm email</label><input id="c"><label for="p">Phone</label><input id="p" type="tel"><label for="v">Verify</label><input id="v"><label for="m">Please confirm your message</label><textarea id="m"></textarea></form>';
    fillPage({ ...request, overwrite: false });
    expect(el('c').value).toBe('mine@x.com');
    expect(el('v').value).not.toBe(el('p').value);
    expect(el<HTMLTextAreaElement>('m').value).not.toContain('@');
  });
  it('keeps a custom end date and keeps generated end dates within max', () => {
    document.body.innerHTML = '<form><label for="a">From</label><input type="date" id="a" min="2030-06-10" max="2030-06-10"><label for="b">To</label><input type="date" id="b" max="2030-06-12"></form>';
    for (let i = 0; i < 20; i++) {
      fillPage(request);
      expect(el('b').value > el('a').value && el('b').value <= '2030-06-12').toBe(true);
    }
    fillPage({ ...request, custom: [{ id: '1', label: 'To', value: '2001-01-01' }] });
    expect(el('b').value).toBe('2001-01-01');
  });
  it('gives a datetime-local end date a time', () => {
    document.body.innerHTML = '<form><label for="a">From</label><input type="date" id="a" min="2031-01-01"><label for="b">To</label><input type="datetime-local" id="b"></form>';
    fillPage(request);
    expect(el('b').value).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
    expect(el('b').value.slice(0, 10) > el('a').value).toBe(true);
  });
  it('picks months by name, whatever their values count from', () => {
    document.body.innerHTML = `<form><fieldset><legend>Date of birth</legend><select id="m">${months(['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'], true)}</select></fieldset></form>`;
    fillPage({ ...request, values: { ...values, birthDate: '1990-07-14' } });
    expect(el<HTMLSelectElement>('m').selectedOptions[0].textContent).toBe('July');
    document.body.innerHTML = `<form><fieldset><legend>Date de naissance</legend><select id="m"><option value="">Mois</option>${months(['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'])}</select></fieldset></form>`;
    fillPage({ ...request, values: { ...values, birthDate: '1990-09-14' } });
    expect(el<HTMLSelectElement>('m').selectedOptions[0].textContent).toBe('sept.');
  });
  it('skips expiry month and year selects beside a card number', () => {
    const years = Array.from({ length: 10 }, (_, i) => `<option>${2026 + i}</option>`).join('');
    document.body.innerHTML = `<form><section><label for="n">Card number</label><input id="n"><select id="m"><option value="">MM</option>${months(['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'].map(String))}</select><select id="y"><option value="">YYYY</option>${years}</select></section></form>`;
    fillPage(request);
    expect([el<HTMLSelectElement>('m').value, el<HTMLSelectElement>('y').value]).toEqual(['', '']);
  });
  it('prefers the exact spelling of the generated answer', () => {
    document.body.innerHTML = '<form><label for="g">Gender</label><select id="g"><option>Other</option><option>Male</option><option>Female</option><option>Prefer not to say</option></select></form>';
    fillPage({ ...request, values: { ...values, gender: 'Prefer not to say' } });
    expect(el<HTMLSelectElement>('g').value).toBe('Prefer not to say');
  });
  it('names the visible form, not a hidden one', () => {
    document.body.innerHTML = '<form id="h"><input type="email" name="email"><input type="password" name="pw"></form><form><input type="email" name="email"><textarea name="message"></textarea></form>';
    vi.spyOn(Element.prototype, 'getClientRects').mockImplementation(function (this: Element) { return (this.closest('#h') ? [] : [{}]) as unknown as DOMRectList; });
    const { forms } = fillPage({ ...request, mode: 'inspect' });
    expect(forms!.map(form => form.type)).toEqual(['contact']);
  });
  it('does not read a language list as nationalities', () => {
    expect(typeOf('<label for="l">Preferred language</label><select id="l"><option>English</option><option>French</option><option>German</option><option>Spanish</option></select>', 'l')).not.toBe('nationality');
    expect(analyze('<select id="s"><option>Algérie</option><option>Maroc</option><option>Tunisie</option></select>').fields.get(el('s'))!.confidence).toBeLessThan(0.7);
  });
  it.each(['Remember this device', 'Trust this browser', 'Save my login info', 'Remember my password'])('leaves "%s" alone', label => {
    document.body.innerHTML = `<form><label><input type="checkbox" id="c" checked> ${label}</label></form>`;
    fillPage(request);
    expect(el('c').checked).toBe(true);
  });
  it('leaves session and consent radio groups alone', () => {
    document.body.innerHTML = '<form><fieldset><legend>Stay signed in?</legend><label><input type="radio" name="s" id="y" checked> Yes</label><label><input type="radio" name="s" id="n"> No</label></fieldset><label><input type="radio" name="c" id="a"> Yes, I agree</label><label><input type="radio" name="c" id="b"> No thanks</label></form>';
    fillPage(request);
    expect([el('y').checked, el('a').checked, el('b').checked]).toEqual([true, false, false]);
  });
});

describe('second opinion', () => {
  it('never guesses an identity number field (UCI real-world set: last 4 of an SSN read as a phone)', () => {
    expect(typeOf('<form><label id="l">Last 4 digits of Social Security Number</label><input id="f" aria-label="Last 4 digits of Social Security Number" maxlength="4" name="ssnUnmasked" type="tel"></form>', 'f')).toBe('unknown');
    expect(analyze('<form><input id="f" aria-label="Last 4 digits of Social Security Number" maxlength="4" name="ssnUnmasked" type="tel"></form>').fields.get(el('f'))?.ruledOut).toEqual(expect.arrayContaining(['phone', 'reference']));
  });

  it('never names a type the rules ruled out (UCI crawl: "Facility Name" was filled as a person)', () => {
    for (const html of ['<label for="f">Facility Name</label><input type="text" id="f" name="facilityName">', '<label for="f">Test Name</label><input type="text" id="f" name="input_31">', '<label for="f">Wiki page name</label><input type="text" id="f" name="ctl00$PlaceHolderMain$wikiPageNameEditTextBox">']) {
      expect(typeOf(`<form>${html}</form>`, 'f'), html).not.toBe('fullName');
    }
  });
});
