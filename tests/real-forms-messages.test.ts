// @vitest-environment jsdom
// Text areas the rules left empty on real forms (1,000 hand-labelled, 2 October 2026): a contact
// form's one text area with no clue of its own, and wording the dictionary didn't know.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { analyzePage } from '../src/fill/context';
import { listControls } from '../src/fill/extract';

beforeEach(() => {
  document.body.replaceChildren();
  vi.spyOn(Element.prototype, 'getClientRects').mockReturnValue([{}] as unknown as DOMRectList);
});
const typeOf = (selector: string) => analyzePage(listControls()).fields.get(document.querySelector<HTMLTextAreaElement>(selector)!)?.type;
const contact = (extra = '') => `<label for="n">Name</label><input id="n" autocomplete="name"><label for="e">Email</label><input id="e" type="email">${extra}`;

describe('a contact form\'s text area', () => {
  it('reads the one text area of a form that asks for an email as the message', () => {
    document.body.innerHTML = `<form>${contact()}<textarea id="t" name="input_10" rows="10"></textarea></form>`;
    expect(typeOf('#t')).toBe('message');
  });
  it('ignores captcha and spam-trap boxes when counting', () => {
    document.body.innerHTML = `<form>${contact()}<textarea id="t" name="wpforms[fields][2]"></textarea><textarea name="g-recaptcha-response"></textarea><textarea name="ak_hp_textarea"></textarea></form>`;
    expect(typeOf('#t')).toBe('message');
  });
  it('leaves text areas alone when there are several, or no email to answer', () => {
    document.body.innerHTML = `<form>${contact()}<textarea id="a" name="input_11"></textarea><textarea id="b" name="input_12"></textarea></form><form><input id="q" name="q"><textarea id="c" name="input_13"></textarea></form>`;
    expect([typeOf('#a'), typeOf('#b'), typeOf('#c')]).toEqual(['unknown', 'unknown', 'unknown']);
  });
  it('keeps a text area that says what it is', () => {
    document.body.innerHTML = `<form>${contact()}<label for="t">Allergies</label><textarea id="t" name="medical[allergies]"></textarea></form>`;
    expect(typeOf('#t')).not.toBe('message');
  });
});

describe('message wording', () => {
  it.each(['Questions or Comments', 'Tell us how we can help', 'Your query', 'Feedback', 'Your enquiry'])('reads "%s" as the message', label => {
    document.body.innerHTML = `<form><label for="t">${label}</label><textarea id="t"></textarea><textarea id="other" name="details"></textarea></form>`;
    expect(typeOf('#t')).toBe('message');
  });
});

describe('orders and bookings', () => {
  it('leaves the one text area of a checkout to its own clues', () => {
    document.body.innerHTML = `<form>${contact()}<label for="c">Card number</label><input id="c" autocomplete="cc-number"><label for="a">Address</label><input id="a" autocomplete="street-address"><label for="z">ZIP</label><input id="z" autocomplete="postal-code"><textarea id="t" name="remarks"></textarea><button>Place order</button></form>`;
    expect(typeOf('#t')).not.toBe('message');
  });
});

// Topics picked from a list (round 4 of the real forms, 2 October 2026): the guide's `subject`.
describe('a topic picked from a list', () => {
  const select = (label: string) => `<label for="s">${label}</label><select id="s" name="input_7"><option value="">Select…</option><option>Sales</option><option>Support</option><option>Billing</option><option>Other</option></select>`;
  it.each(['How can we help?', 'Type of enquiry', 'Reason for contacting us', 'What is your inquiry about?', 'Request type', 'Select a topic', "Objet de votre demande"])('reads a select labelled "%s" as the subject', label => {
    document.body.innerHTML = `<form>${contact(select(label))}<textarea id="t" name="msg"></textarea></form>`;
    expect(typeOf('#s')).toBe('subject');
  });
  it('reads a radio group asking for the nature of the query as the subject', () => {
    document.body.innerHTML = `<form>${contact()}<fieldset><legend>What is the nature of your query?</legend>${['Press', 'Partnerships', 'Careers'].map((t, i) => `<label><input type="radio" id="r${i}" name="nature" value="${t}"> ${t}</label>`).join('')}</fieldset></form>`;
    expect(typeOf('#r0')).toBe('subject');
  });
  it.each([['Department', 'department'], ['Area of interest', 'unknown'], ['Reason for cancellation', 'unknown']])('leaves a select labelled "%s" to its own type', (label, type) => {
    document.body.innerHTML = `<form>${contact(select(label))}</form>`;
    expect(typeOf('#s')).toBe(type);
  });
  it('keeps "How can we help?" over a text area as the message', () => {
    document.body.innerHTML = `<form>${contact()}<label for="t">How can we help?</label><textarea id="t"></textarea></form>`;
    expect(typeOf('#t')).toBe('message');
  });
});
