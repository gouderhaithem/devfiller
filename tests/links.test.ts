// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { classifyField } from '../src/fill/classify';
import { fillPage, type FillRequest } from '../src/fill';
import { generateIdentities, generateValues } from '../src/data';
import { generateSamples } from '../src/samples';

const values = generateValues('en');
const request: FillRequest = { values, identities: generateIdentities('en'), samples: generateSamples('en'), custom: [], overwrite: true, fillUnknown: true, passwords: false };
beforeEach(() => {
  document.body.replaceChildren();
  vi.spyOn(Element.prototype, 'getClientRects').mockReturnValue([{}] as unknown as DOMRectList);
});
const typeOf = (html: string) => {
  document.body.innerHTML = `<form>${html}</form>`;
  return classifyField(document.querySelector('input, select, textarea') as HTMLInputElement).type;
};
const labelled = (text: string) => typeOf(`<label for="f">${text}</label><input id="f">`);
const fill = (text: string) => {
  document.body.innerHTML = `<form><label for="f">${text}</label><input id="f"></form>`;
  fillPage(request);
  return (document.getElementById('f') as HTMLInputElement).value;
};
const handle = values.username.replace(/[._]+/g, '-');

describe('link fields', () => {
  it('reads links and profiles in English, French and Arabic', () => {
    for (const text of [
      'LinkedIn profile', 'GitHub', 'GitHub profile URL', 'Portfolio URL', 'Personal website', 'Company website', 'Facebook page', 'Instagram',
      'Twitter / X', 'YouTube channel', 'Behance', 'Dribbble', 'Link to your work', 'Social media link',
      'Profil LinkedIn', 'Lien vers votre portfolio', "Site de l'entreprise", 'Site personnel', 'Adresse du site web', 'URL du profil', 'Page Facebook', 'Lien de votre profil',
      'رابط الموقع', 'رابط حساب لينكدإن', 'الموقع الشخصي', 'حساب فيسبوك', 'رابط الملف الشخصي', 'حساب جيت هب', 'انستغرام', 'الرابط',
    ]) expect(labelled(text), text).toBe('website');
  });

  it('keeps words that only look like links away from them', () => {
    expect(labelled('Lien de parenté')).not.toBe('website');
    expect(labelled('صلة القرابة')).not.toBe('website');
    // "موقع" is a place as well as a website: the company's location here.
    expect(typeOf('<input name="location" placeholder="موقع الشركة">')).not.toBe('website');
    expect(typeOf('<label for="h">How did you hear about us?</label><select id="h"><option>Facebook</option><option>Google</option><option>LinkedIn</option></select>')).not.toBe('website');
    expect(typeOf('<label><input type="checkbox" id="s"> Share on Facebook</label>')).not.toBe('website');
  });

  it('gives a social profile a link on that network, for the same person', () => {
    expect(fill('LinkedIn profile')).toBe(`https://www.linkedin.com/in/${handle}`);
    expect(fill('Profil LinkedIn')).toBe(`https://www.linkedin.com/in/${handle}`);
    expect(fill('GitHub')).toBe(`https://github.com/${handle}`);
    expect(fill('حساب فيسبوك')).toBe(`https://www.facebook.com/${handle}`);
    expect(fill('Instagram')).toBe(`https://www.instagram.com/${handle}`);
    expect(fill('Twitter / X')).toBe(`https://x.com/${handle}`);
    expect(fill('YouTube channel')).toBe(`https://www.youtube.com/@${handle}`);
  });

  it('gives any other link a reserved example address', () => {
    for (const text of ['Personal website', 'Portfolio URL', "Site de l'entreprise", 'رابط الموقع']) expect(fill(text), text).toMatch(/^https:\/\/[a-z]+\.example\.com$/);
  });
});
