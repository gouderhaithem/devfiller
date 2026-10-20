// @vitest-environment jsdom
// Spam traps from real forms (UCI round 4, French and Arabic collections): fields a page hides from
// people, which a filled value marks as a bot.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fillPage, type FillRequest } from '../src/fill';
import { generateIdentities, generateValues } from '../src/data';
import { generateSamples } from '../src/samples';

const values = generateValues('en');
const request: FillRequest = { values, identities: generateIdentities('en'), samples: generateSamples('en'), custom: [], overwrite: true, fillUnknown: true, passwords: false };
beforeEach(() => {
  document.body.replaceChildren();
  vi.spyOn(Element.prototype, 'getClientRects').mockReturnValue([{}] as unknown as DOMRectList);
});
// The field after a real email field, so the form is filled.
const filled = (html: string) => {
  document.body.innerHTML = `<form><label for="e">Email</label><input id="e">${html}</form>`;
  fillPage(request);
  return (document.getElementById('f') as HTMLInputElement).value;
};

describe('spam traps', () => {
  it('leaves a trap empty whatever frames its wording', () => {
    for (const label of [
      'Leave this field blank (required)', 'If you are human, leave this field blank.', "Leave this field empty if you're human:",
      'leave this field blank to prove your humanity', "Don't fill this field", 'Please do not fill in this field',
      'Laisser ce champ vide', 'Veuillez laisser ce champ vide.', 'Ne rien saisir dans ce champ', 'اترك هذا الحقل فارغاً',
    ]) expect(filled(`<label for="f">${label}</label><input type="text" id="f" name="url">`), label).toBe('');
  });

  it('leaves the traps of known form plugins empty, whatever their label says', () => {
    expect(filled('<label for="f">Website</label><input type="text" id="f" name="wpforms[hp]">')).toBe('');
    expect(filled('<label for="f">Leave this field empty</label><input type="text" id="f" name="_mc4wp_honeypot">')).toBe('');
    expect(filled('<input type="text" id="f" name="_gotcha">')).toBe('');
  });

  it('leaves a website box that no one can tab to and the browser may not fill empty', () => {
    expect(filled('<input type="text" id="f" name="website" tabindex="-1" autocomplete="off">')).toBe('');
  });

  it('still fills real fields that mention leaving something blank', () => {
    expect(filled('<label for="f">Shipping address (leave blank if same as billing)</label><input type="text" id="f" name="ship">')).not.toBe('');
    expect(filled('<label for="f">Website</label><input type="url" id="f" name="website">')).not.toBe('');
    expect(filled('<label for="f">Website</label><input type="url" id="f" name="website" autocomplete="off">')).not.toBe('');
    expect(filled('<label for="f">Company</label><input type="text" id="f" name="company" tabindex="-1" autocomplete="off">')).not.toBe('');
  });
});
