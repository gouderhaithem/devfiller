// @vitest-environment jsdom
// Findings from the second set of Form Lab pages (31–60, 30 September 2026). Each block is one
// mechanism, written as generic markup, not a copy of the page that exposed it.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fillPage, type FillRequest } from '../src/fill';
import { generateIdentities, generatePhones, generateValues } from '../src/data';
import { generateSamples } from '../src/samples';

const values = { ...generateValues('en'), country: 'United States' };
const request: FillRequest = { values, identities: generateIdentities('en'), samples: generateSamples('en'), phones: generatePhones(), custom: [], overwrite: true, fillUnknown: true, passwords: false };
beforeEach(() => {
  document.body.replaceChildren();
  document.documentElement.removeAttribute('lang');
  vi.spyOn(Element.prototype, 'getClientRects').mockReturnValue([{}] as unknown as DOMRectList);
});
const field = (id: string) => document.getElementById(id) as HTMLInputElement;
function types(html: string): Record<string, string> {
  document.body.innerHTML = html;
  const controls = Array.from(document.querySelectorAll<HTMLInputElement>('input, select, textarea'));
  const result = fillPage({ ...request, mode: 'classify' });
  return Object.fromEntries((result.classified ?? []).map(({ index, type }) => [controls[index].id || controls[index].name, type]));
}

describe('date inputs', () => {
  it('reads a date input with no words as a date, and a From/To pair as start and end', () => {
    const found = types(`<form>
      <label for="when">When did it happen?</label><input id="when" type="date">
      <fieldset><legend>Period</legend><label for="from">From</label><input id="from" type="date"><label for="to">To</label><input id="to" type="date"></fieldset>
      <label for="pf">Period from</label><input id="pf" type="date"><label for="pt">Period to</label><input id="pt" type="date">
    </form>`);
    expect(found).toMatchObject({ when: 'date', from: 'startDate', to: 'endDate', pf: 'startDate', pt: 'endDate' });
    fillPage(request);
    expect(field('to').value > field('from').value).toBe(true);
    expect(field('pt').value > field('pf').value).toBe(true);
  });
  it('reads "date of arrival" and "date of departure" as a stay', () => {
    const found = types(`<form><label for="a">Intended date of arrival</label><input id="a" type="date"><label for="d">Intended date of departure</label><input id="d" type="date"></form>`);
    expect(found).toMatchObject({ a: 'startDate', d: 'endDate' });
  });
  it('lets split birth-date selects be a birth date, not a tie between birth date and date', () => {
    const days = Array.from({ length: 31 }, (_, i) => `<option>${i + 1}</option>`).join('');
    const found = types(`<form><select name="dob_day" aria-label="Day"><option value="">Day</option>${days}</select></form>`);
    expect(found.dob_day).toBe('birthDate');
  });
  it('does not read a select of durations as a date', () => {
    const found = types(`<form><label for="exp">Expiration</label><select id="exp"><option value="7">7 days</option><option value="30">30 days</option><option value="90">90 days</option><option value="0">No expiration</option></select></form>`);
    expect(found.exp).not.toMatch(/date/i);
  });
});

describe('time options', () => {
  it('reads a select or radio group of clock times as a time', () => {
    const found = types(`<form><label for="t">Return by</label><select id="t"><option value="">--:--</option><option>08:00</option><option>09:00</option><option>10:00</option><option>11:00</option></select>
      <fieldset><legend>Choose a slot</legend>${['08:30', '09:15', '10:45', '14:00'].map(t => `<label><input type="radio" name="slot" value="${t}"> ${t}</label>`).join('')}</fieldset></form>`);
    expect(found).toMatchObject({ t: 'time', slot: 'time' });
  });
});

describe('names of other people', () => {
  it('reads a role followed by "name" as a person\'s full name', () => {
    const found = types(`<form><label for="m">Manager's name</label><input id="m" name="r_manager"><label for="h">Name of host person</label><input id="h" name="host"><label for="c">Colleague covering for you (name)</label><input id="c" name="cover"></form>`);
    expect(found).toMatchObject({ m: 'fullName', h: 'fullName', c: 'fullName' });
  });
  it('gives an emergency contact and a manager their own phone and email, not the applicant\'s', () => {
    document.body.innerHTML = `<form>
      <label for="name">Full name</label><input id="name" autocomplete="name"><label for="em">Email</label><input id="em" type="email"><label for="ph">Mobile</label><input id="ph" type="tel">
      <fieldset><legend>Emergency contact</legend><label for="en">Name</label><input id="en" name="emergency_name"><label for="ep">Phone</label><input id="ep" name="emergency_phone" type="tel"></fieldset>
      <label for="me">Manager's email</label><input id="me" name="manager_email" type="email">
    </form>`;
    fillPage(request);
    expect(field('ep').value).not.toBe('');
    expect(field('ep').value).not.toBe(field('ph').value);
    expect(field('me').value).not.toBe(field('em').value);
    expect(field('en').value).not.toBe(field('name').value);
  });
});

describe('radio groups', () => {
  it('never gives a radio group a free-text type from its section heading', () => {
    const found = types(`<form><fieldset><legend>About you</legend><p>Mortgage in principle?</p>
      ${['yes', 'no', 'in_progress'].map(v => `<label><input type="radio" name="mortgage" value="${v}"> ${v}</label>`).join('')}</fieldset></form>`);
    expect(found.mortgage).not.toBe('bio');
  });
  it('does not read third-person "accepts" or "accepted" as consent, and still reads "I accept"', () => {
    const found = types(`<form>
      <fieldset><legend>Will you attend?</legend><label><input type="radio" name="rsvp" value="yes"> Joyfully accepts</label><label><input type="radio" name="rsvp" value="no"> Regretfully declines</label></fieldset>
      <fieldset><legend>Returns accepted?</legend><label><input type="radio" name="returns" value="0"> No returns</label><label><input type="radio" name="returns" value="30"> 30 days</label></fieldset>
      <label><input type="checkbox" id="terms"> I accept the terms of sale</label>
    </form>`);
    expect(found.rsvp).not.toBe('skip:consent');
    expect(found.returns).not.toBe('skip:consent');
    expect(found.terms).toBe('skip:consent');
  });
  it('reads an answer as consent only when it agrees to something', () => {
    const found = types(`<form><p>Êtes-vous boursier ?</p><div class="choices">
      <label><input type="radio" name="bourse" value="oui"> Oui, notification reçue</label><label><input type="radio" name="bourse" value="non"> Non</label></div>
      <fieldset><legend>Privacy policy</legend><label><input type="radio" name="pp" value="y"> Yes, I agree</label><label><input type="radio" name="pp" value="n"> No</label></fieldset></form>`);
    expect(found.bourse).not.toBe('skip:consent');
    expect(found.pp).toBe('skip:consent');
  });
  it('reads an opt-in asked only by its answers as consent, and answers yes', () => {
    document.body.innerHTML = `<form><fieldset><legend>Preferences</legend>
      <label><input type="radio" id="y" name="offers" value="y"> Yes, please send me offers</label><label><input type="radio" id="n" name="offers" value="n"> No thanks</label></fieldset>
      <fieldset><legend>Follow-up</legend><label><input type="radio" id="c" name="call" value="y"> Yes, contact me</label><label><input type="radio" name="call" value="n"> No</label></fieldset>
      <label><input type="checkbox" id="acc"> Accepted</label></form>`;
    fillPage(request);
    expect(Array.from(document.querySelectorAll<HTMLInputElement>('input:checked'), el => el.id)).toEqual(['y', 'c', 'acc']);
  });
  it('gives another person a different number wherever the digits end', async () => {
    const { otherNumber } = await import('../src/fill/phones');
    expect(otherNumber('+44 7700 900123 (mobile)')).not.toBe('+44 7700 900123 (mobile)');
    expect(otherNumber('+1 (555) 010-0123')).toMatch(/^\+1 \(555\) 010-01\d\d$/);
  });
  it('treats email notification settings as consent', () => {
    const found = types(`<form><fieldset><legend>Email notifications</legend>
      <label><input type="checkbox" id="n1"> When someone mentions me</label><label><input type="checkbox" id="n2"> Security alerts</label></fieldset></form>`);
    expect(found).toMatchObject({ n1: 'skip:consent', n2: 'skip:consent' });
  });
  it('reads bedroom and bathroom counts as quantities, not a rating scale', () => {
    const found = types(`<form><select name="beds" aria-label="Bedrooms, at least"><option value="">Any</option><option>1</option><option>2</option><option>3</option><option>4</option><option>5+</option></select>
      <select name="baths" aria-label="Bathrooms"><option value="">Any</option><option>1</option><option>2</option><option>3</option></select></form>`);
    expect(found).toMatchObject({ beds: 'quantity', baths: 'quantity' });
  });
});

describe('money, counts and measurements', () => {
  it('reads totals, subtotals and declared values as amounts', () => {
    const found = types(`<form>
      <label for="sub">Subtotal</label><input id="sub" type="number" step="0.01">
      <input id="lt" type="number" step="0.01" aria-label="Line total, line 1">
      <label for="dv">Declared value</label><input id="dv" inputmode="decimal">
      <label for="adv">Advance received</label><input id="adv" inputmode="decimal">
    </form>`);
    expect(found).toMatchObject({ sub: 'amount', lt: 'amount', dv: 'amount', adv: 'amount' });
  });
  it('reads years, hours and days as counts, and miles as a measurement', () => {
    const found = types(`<form>
      <label for="yl">Years with a full licence</label><input id="yl" type="number">
      <label for="hr">Hours per month</label><input id="hr" type="number">
      <label for="hd">Handling time (days)</label><input id="hd" type="number">
      <label for="mi">Annual mileage (miles)</label><input id="mi" type="number">
    </form>`);
    expect(found).toMatchObject({ yl: 'quantity', hr: 'quantity', hd: 'quantity', mi: 'measurement' });
  });
});

describe('free text and titles', () => {
  it('reads summaries and headlines as titles, and steps, symptoms and reasons as descriptions', () => {
    const found = types(`<form>
      <label for="s">Summary</label><input id="s" maxlength="120">
      <label for="lt">Listing title</label><input id="lt">
      <label for="st">Steps to reproduce</label><textarea id="st"></textarea>
      <label for="sy">Symptoms</label><textarea id="sy"></textarea>
      <label for="rs">Reason</label><textarea id="rs"></textarea>
    </form>`);
    expect(found).toMatchObject({ s: 'title', lt: 'title', st: 'description', sy: 'description', rs: 'description' });
  });
  it('reads a select of the person\'s email addresses as an email', () => {
    const found = types(`<form><label for="pe">Public email</label><select id="pe"><option value="">Don't show</option><option>maya@example.com</option><option>maya.chen@work.example</option></select></form>`);
    expect(found.pe).toBe('email');
  });
});

describe('things that only look like a type', () => {
  it('does not read a version number as a phone, or "Employee ID" as an employer', () => {
    const found = types(`<form><label for="v">Version</label><input id="v" placeholder="e.g. 2026.3.1"><label for="e">Employee ID</label><input id="e" placeholder="E-10482"></form>`);
    expect(found.v).not.toBe('phone');
    expect(found.e).not.toBe('company');
  });
  it('does not give promo or offer codes a type', () => {
    const found = types(`<form><label for="p">رمز العرض</label><input id="p"><label for="c">Coupon code</label><input id="c"><label for="v">Voucher</label><input id="v"></form>`);
    expect(found).toMatchObject({ p: 'unknown', c: 'unknown', v: 'unknown' });
  });
});

describe('phone numbers follow the page', () => {
  it('writes a French number on a French page with no country field', () => {
    document.documentElement.lang = 'fr';
    document.body.innerHTML = `<form><label for="t">Téléphone</label><input id="t" type="tel"></form>`;
    fillPage(request);
    expect(field('t').value).toMatch(/^(\+33|0)/);
  });
  it('writes a US number when the form asks for a US state', () => {
    document.body.innerHTML = `<form><label for="st">State</label><select id="st"><option value="">Choose</option>${['Alabama', 'Alaska', 'Arizona', 'California', 'Colorado', 'Florida', 'Georgia', 'Texas', 'New York', 'Ohio'].map(s => `<option>${s}</option>`).join('')}</select><label for="p">Phone</label><input id="p" type="tel"></form>`;
    fillPage({ ...request, values: { ...values, country: 'Algeria' } });
    expect(field('p').value).toMatch(/^(\+1|\()/);
  });
});
