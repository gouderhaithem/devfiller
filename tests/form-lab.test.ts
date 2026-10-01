// @vitest-environment jsdom
// Findings from the Form Lab held-out pages (30 September 2026): 30 forms the engine had never
// seen, labelled blind. Each block reproduces one kind of mistake the evaluation found.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fillPage, type FillRequest } from '../src/fill';
import { generateIdentities, generateValues } from '../src/data';
import { generateSamples } from '../src/samples';

const values = { ...generateValues('en'), country: 'United States' };
const request: FillRequest = { values, identities: generateIdentities('en'), samples: generateSamples('en'), custom: [], overwrite: true, fillUnknown: true, passwords: false };
beforeEach(() => {
  document.body.replaceChildren();
  vi.spyOn(Element.prototype, 'getClientRects').mockReturnValue([{}] as unknown as DOMRectList);
});
const field = (id: string) => document.getElementById(id) as HTMLInputElement;
// The type of every control, after the form-level pass, by id (or name for unnamed radios).
function types(html: string): Record<string, string> {
  document.body.innerHTML = html;
  const controls = Array.from(document.querySelectorAll<HTMLInputElement>('input, select, textarea'));
  const result = fillPage({ ...request, mode: 'classify' });
  return Object.fromEntries((result.classified ?? []).map(({ index, type }) => [controls[index].id || controls[index].name, type]));
}

describe('card fields', () => {
  it('reads "Passport expiry" as a date, and keeps the passenger beside it', () => {
    const found = types(`<form><div class="passenger"><div class="grid">
      <div><label for="fn">First name</label><input id="fn" name="passengers[0][first_name]" autocomplete="given-name"></div>
      <div><label for="ln">Last name</label><input id="ln" name="passengers[0][last_name]" autocomplete="family-name"></div>
      <div><label for="dob">Date of birth</label><input id="dob" type="date" autocomplete="bday"></div>
      <div><label for="pp">Passport number</label><input id="pp" name="passport_number"></div>
      <div><label for="pexp">Passport expiry</label><input id="pexp" type="date"></div>
    </div></div></form>`);
    expect(found).toMatchObject({ fn: 'firstName', ln: 'lastName', dob: 'birthDate', pexp: 'date' });
    expect(found.pp).not.toBe('skip:card');
  });
  it('does not read an identity card, a certificate expiry or an account PIN as a payment card', () => {
    const found = types(`<form>
      <label for="cni">Numéro de carte d'identité</label><input id="cni" name="numero_carte_identite" inputmode="numeric">
      <label for="deliv">Date de délivrance</label><input id="deliv" type="date">
      <label for="cert">Certification expiry</label><input id="cert" type="date">
      <label for="pin">Choose a 4-digit PIN</label><input id="pin" inputmode="numeric" maxlength="4">
    </form>`);
    expect(found.cni).not.toBe('skip:card');
    expect(found).toMatchObject({ deliv: 'date', cert: 'date' });
    expect(found.pin).not.toBe('skip:card');
  });
  it('still skips a real card, its bare "Expiry" and the name beside it', () => {
    const found = types(`<form><fieldset><legend>Payment</legend>
      <label for="num">Card number</label><input id="num">
      <label for="exp">Expiry</label><input id="exp" placeholder="MM/YY">
      <label for="cvc">CVC</label><input id="cvc">
      <label for="holder">Name</label><input id="holder">
    </fieldset></form>`);
    expect(found).toMatchObject({ num: 'skip:card', exp: 'skip:card', cvc: 'skip:card', holder: 'skip:card' });
  });
  it('never lets a brand or a purpose hide a real card number', () => {
    const found = types(`<form>
      <label for="a">Credit card number (Visa / Mastercard)</label><input id="a" name="f1">
      <label for="b">Card number – insurance payment</label><input id="b" name="f2">
      <label for="c">ID card number</label><input id="c" name="f3">
    </form>`);
    expect(found).toMatchObject({ a: 'skip:card', b: 'skip:card' });
    expect(found.c).not.toBe('skip:card');
  });
  it('skips a bare "Expiry" when the card number sits in another form on the page', () => {
    const found = types(`<form id="card"><label for="num">Card number</label><input id="num"></form>
      <form id="rest"><label for="exp">Expiry</label><input id="exp" placeholder="MM/YY"><label for="pin">PIN</label><input id="pin"></form>`);
    expect(found).toMatchObject({ num: 'skip:card', exp: 'skip:card', pin: 'skip:card' });
  });
  it('keeps a birthday or a named start date beside a card expiry', () => {
    const found = types(`<form><div class="grid">
      <label for="cexp">Card expiry month</label><input id="cexp" type="month">
      <label for="bday">Birthday</label><input id="bday" type="date">
      <label for="start">Meeting start</label><input id="start" type="datetime-local">
    </div></form>`);
    expect(found).toMatchObject({ cexp: 'skip:card', bday: 'birthDate' });
    expect(found.start).not.toBe('skip:card');
  });
});

describe('consent is about permission, not every question', () => {
  it('reads a Likert agreement scale as a rating', () => {
    const rows = ['navigation', 'pricing'].map(row => `<tr><th>${row}</th>${['Strongly disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly agree'].map((answer, i) => `<td><input type="radio" name="likert_${row}" value="${i + 1}" aria-label="${row}: ${answer}"></td>`).join('')}</tr>`).join('');
    const found = types(`<form><fieldset><legend>How much do you agree with these statements?</legend><table>${rows}</table></fieldset></form>`);
    expect(found.likert_navigation).toBe('rating');
    expect(found.likert_pricing).toBe('rating');
    fillPage(request);
    expect(document.querySelectorAll('input:checked')).toHaveLength(2);
  });
  it('reads a 0 to 10 recommendation question as a rating', () => {
    const found = types(`<form><p class="label">How likely are you to recommend us to a friend? (0 = not at all likely, 10 = extremely likely)</p>
      <div class="choices">${Array.from({ length: 11 }, (_, i) => `<label><input type="radio" name="nps" value="${i}"> ${i}</label>`).join('')}</div></form>`);
    expect(found.nps).toBe('rating');
  });
  it('leaves questions about the person alone: work authorization, sponsorship, medical conditions', () => {
    const found = types(`<form>
      <p class="label">Are you legally authorized to work in the country of this position?</p>
      <div class="choices"><label><input type="radio" name="work_authorization" value="citizen"> Yes, citizen</label><label><input type="radio" name="work_authorization" value="sponsorship"> No, I will need sponsorship</label></div>
      <span class="label">Have you ever been diagnosed with any of the following?</span>
      <div class="choices"><label><input type="checkbox" name="conditions[]" value="diabetes"> Diabetes</label><label><input type="checkbox" name="conditions[]" value="asthma"> Asthma</label></div>
    </form>`);
    expect(found.work_authorization).not.toBe('skip:consent');
    expect(found['conditions[]']).not.toBe('skip:consent');
  });
  it('never takes a consent question with agree answers for a scale', () => {
    const found = types(`<form><fieldset><legend>Cookies</legend>
      <label><input type="radio" id="all" name="cookies" value="all"> I agree to all</label>
      <label><input type="radio" name="cookies" value="essential"> I agree to essential only</label>
      <label><input type="radio" name="cookies" value="no"> I disagree</label>
      <label><input type="radio" name="cookies" value="later"> Ask me later</label></fieldset></form>`);
    expect(found.cookies).toBe('skip:consent');
    fillPage(request);
    expect(document.querySelectorAll('input:checked')).toHaveLength(0);
  });
  it('reads numbered answers as a count when the question asks for one', () => {
    const found = types(`<form><fieldset><legend>Adults</legend>${[1, 2, 3, 4].map(n => `<label><input type="radio" name="adults" value="${n}"> ${n}</label>`).join('')}</fieldset></form>`);
    expect(found.adults).toBe('quantity');
  });
  it('still protects permission, terms and sponsor opt-ins', () => {
    const found = types(`<form>
      <label><input type="checkbox" id="a"> I authorize the school to publish photos of my child</label>
      <label><input type="checkbox" id="b"> J'autorise l'établissement à publier des photos</label>
      <label><input type="checkbox" id="c"> I have read the terms and conditions</label>
      <label><input type="checkbox" id="d"> J'accepte les conditions générales</label>
      <label><input type="checkbox" id="e"> Share my details with event sponsors</label>
      <fieldset><legend>Do you agree to our privacy policy?</legend><label><input type="radio" id="f" name="policy" value="y"> Yes</label><label><input type="radio" name="policy" value="n"> No</label></fieldset>
    </form>`);
    for (const id of ['a', 'b', 'c', 'd', 'e', 'f']) expect(found[id], id).toBe('skip:consent');
  });
});

describe('consent leaks', () => {
  it('never answers a Yes/No newsletter select', () => {
    document.body.innerHTML = `<form><label for="nl">Subscribe to newsletter?</label><select id="nl"><option value="">-- Choose --</option><option value="yes">Yes</option><option value="no">No</option></select>
      <label for="pref">Preferred contact time</label><select id="pref"><option value="">-- Choose --</option><option value="am">Morning</option><option value="pm">Afternoon</option></select></form>`;
    fillPage(request);
    expect(field('nl').value).toBe('');
    expect(field('pref').value).not.toBe('');
  });
  it('never ticks a declaration whose heading is not a legend', () => {
    document.body.innerHTML = `<form><div class="field"><span class="label">Declarations</span><div class="choices">
      <label><input type="checkbox" id="bribery"> Anti-bribery policy in place</label>
      <label><input type="checkbox" id="sanctions"> Not on any sanctions list</label>
      <label><input type="checkbox" id="gdpr"> GDPR compliant</label></div></div></form>`;
    fillPage(request);
    for (const id of ['bribery', 'sanctions', 'gdpr']) expect(field(id).checked, id).toBe(false);
  });
  it('reads the heading over a group even inside a larger fieldset', () => {
    document.body.innerHTML = `<form><fieldset><legend>Tax &amp; compliance</legend><div class="field"><span class="label">Declarations</span><div class="choices">
      <label><input type="checkbox" id="sanctions"> Not on any sanctions list</label></div></div></fieldset></form>`;
    fillPage(request);
    expect(field('sanctions').checked).toBe(false);
  });
});

describe('honeypots', () => {
  it('leaves trap fields empty and fills the real ones', () => {
    document.body.innerHTML = `<form>
      <div aria-hidden="true"><label for="hp1">Website</label><input id="hp1" name="website" tabindex="-1" autocomplete="off"></div>
      <div class="offscreen"><label for="hp2">Full name</label><input id="hp2" name="fullname_confirm" tabindex="-1"></div>
      <label for="hp3">Company</label><input id="hp3" placeholder="Leave this empty">
      <label for="name">Full name</label><input id="name" autocomplete="name">
      <label for="email">Email</label><input id="email" type="email">
    </form>`;
    const offscreen = document.querySelector('.offscreen')!;
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      return (offscreen.contains(this) ? { left: -10000, right: -9800, top: 0, bottom: 20, width: 200, height: 20 } : { left: 0, right: 200, top: 0, bottom: 20, width: 200, height: 20 }) as DOMRect;
    });
    fillPage(request);
    expect([field('hp1').value, field('hp2').value, field('hp3').value]).toEqual(['', '', '']);
    expect(field('name').value).not.toBe('');
    expect(field('email').value).toBe(values.email);
  });
});

describe('Gravity Forms honeypots', () => {
  it("leaves them empty even when the form builder's stylesheet that hides them is missing", () => {
    // From the UCI real-world set (scripts/uci): Gravity Forms marks its honeypot with
    // autocomplete="new-password" and a "Name" or "Email" label, and hides it with its own CSS.
    document.body.innerHTML = `<form><div class="gfield gfield--type-honeypot gform_validation_container"><label class="gfield_label" for="input_2_21">Name</label>
      <div class="ginput_container"><input name="input_21" id="input_2_21" type="text" value="" autocomplete="new-password"></div>
      <div class="gfield_description">This field is for validation purposes and should be left unchanged.</div></div>
      <label for="real">Name</label><input id="real" name="input_1">
    </form>`;
    fillPage({ ...request, passwords: true });
    expect(field('input_2_21').value).toBe('');
    expect(field('real').value).not.toBe('');
  });
});

describe('real fields that mention leaving something empty', () => {
  it('fills them, and fields behind an open dialog', () => {
    document.body.innerHTML = `<form>
      <label for="a">Leave blank if same as billing</label><input id="a" name="shipping_address" autocomplete="shipping street-address">
      <label for="b">Phone (do not enter spaces)</label><input id="b" type="tel">
      <label for="c">Laisser vide si identique</label><input id="c" name="adresse_livraison">
      <div aria-hidden="true"><label for="d">Email</label><input id="d" type="email"></div>
    </form>`;
    fillPage(request);
    for (const id of ['a', 'b', 'c', 'd']) expect(field(id).value, id).not.toBe('');
  });
});

describe('numbers', () => {
  it('reads guests, rooms and tickets as quantities, and income and expenses as amounts', () => {
    const found = types(`<form>
      <label for="adults">Adults</label><input id="adults" type="number" min="1">
      <label for="children">Children</label><input id="children" type="number" min="0">
      <label for="rooms">Rooms</label><input id="rooms" type="number">
      <label for="tickets">Number of tickets</label><input id="tickets" type="number">
      <label for="income">Monthly income</label><input id="income" type="number">
      <label for="expenses">Monthly expenses</label><input id="expenses" type="number">
      <label for="down">Down payment</label><input id="down" type="number">
    </form>`);
    expect(found).toMatchObject({ adults: 'quantity', children: 'quantity', rooms: 'quantity', tickets: 'quantity', income: 'amount', expenses: 'amount', down: 'amount' });
  });
});

describe('a section heading is context, not the field', () => {
  it('reads a "Search flights" form as a booking, not a search box', () => {
    const found = types(`<form><fieldset><legend>Search flights</legend>
      <label for="depart">Departure date</label><input id="depart" type="date">
      <label for="ret">Return date</label><input id="ret" type="date">
      <label for="pax">Passengers</label><input id="pax" type="number" min="1">
    </fieldset></form>`);
    expect(found).toMatchObject({ depart: 'startDate', ret: 'endDate', pax: 'quantity' });
    fillPage(request);
    expect(field('ret').value > field('depart').value).toBe(true);
  });
  it('uses the title as the name of a field that has nothing else, and "q" only on its own', () => {
    const found = types(`<form><input name="q_a" id="qa" title="Full name"><input name="q_d" id="qd" title="Birth date (DD/MM/YYYY)"><input name="q" id="q"></form>`);
    expect(found).toMatchObject({ qa: 'fullName', qd: 'birthDate', q: 'search' });
  });
});

describe('values that fit the field', () => {
  it('writes a country code where only two or three letters fit', () => {
    document.body.innerHTML = `<form><label for="cc">Country code</label><input id="cc" pattern="^[A-Z]{2}$" maxlength="2">
      <label for="c3">Country</label><input id="c3" maxlength="3"></form>`;
    fillPage(request);
    expect(field('cc').value).toBe('US');
    expect(field('c3').value).toBe('USA');
  });
  it('fills a URL slug with a value its pattern accepts', () => {
    document.body.innerHTML = `<form><label for="slug">URL slug</label><input id="slug" pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="insulated-water-bottle"></form>`;
    fillPage(request);
    expect(field('slug').value).not.toBe('');
    expect(field('slug').checkValidity()).toBe(true);
  });
});

describe('controls outside the forms', () => {
  it('leaves a settings toggle outside the page\'s forms alone', () => {
    document.body.innerHTML = `<form><label for="name">Full name</label><input id="name" autocomplete="name"></form>
      <aside><label><input type="checkbox" id="auto"> Go to the next page after submit</label></aside>`;
    fillPage(request);
    expect(field('name').value).not.toBe('');
    expect(field('auto').checked).toBe(false);
  });
  it('still fills choices on a page that has no form element', () => {
    document.body.innerHTML = `<div><label><input type="checkbox" id="gift"> This is a gift</label></div>`;
    fillPage(request);
    expect(field('gift').checked).toBe(true);
  });
});

describe('shadow DOM radio groups', () => {
  it('keeps a shadow root\'s group apart from the page\'s group of the same name', () => {
    document.body.innerHTML = `<div><label><input type="radio" id="p1" name="size" value="s"> Small</label><label><input type="radio" id="p2" name="size" value="l"> Large</label></div><fl-sizes id="host"></fl-sizes>`;
    const root = document.getElementById('host')!.attachShadow({ mode: 'open' });
    root.innerHTML = `<label><input type="radio" name="size" value="s"> Small</label><label><input type="radio" name="size" value="l"> Large</label>`;
    fillPage(request);
    expect(document.querySelectorAll('input:checked')).toHaveLength(1);
    expect(root.querySelectorAll('input:checked')).toHaveLength(1);
  });
});

describe('shadow DOM', () => {
  it('fills and classifies fields inside open shadow roots, and lets their events out', () => {
    document.body.innerHTML = `<form id="f"><fl-field id="host"></fl-field><label for="light">Email</label><input id="light" type="email"></form>`;
    const root = document.getElementById('host')!.attachShadow({ mode: 'open' });
    root.innerHTML = `<label for="inner">First name</label><input id="inner">`;
    const inner = root.getElementById('inner') as HTMLInputElement;
    const heard: EventTarget[] = [];
    const listen = (event: Event) => heard.push(event.composedPath()[0]);
    document.addEventListener('input', listen);
    const result = fillPage({ ...request, mode: 'classify' });
    expect(result.classified?.map(field => field.type)).toEqual(['email', 'firstName']);
    fillPage(request);
    expect(inner.value).toBe(values.firstName);
    expect(field('light').value).toBe(values.email);
    expect(heard).toContain(inner);
    document.removeEventListener('input', listen);
  });
});
