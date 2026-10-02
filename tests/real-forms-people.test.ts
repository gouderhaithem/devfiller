// @vitest-environment jsdom
// Names and job titles the rules misread on real forms (round 4, 2 October 2026): form builders that
// mark a name's part in the field's name, and lead forms whose "Title" is a job title.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { analyzePage } from '../src/fill/context';
import { listControls } from '../src/fill/extract';

beforeEach(() => {
  document.body.replaceChildren();
  vi.spyOn(Element.prototype, 'getClientRects').mockReturnValue([{}] as unknown as DOMRectList);
});
const typeOf = (selector: string) => analyzePage(listControls(), undefined, [], false).fields.get(document.querySelector<HTMLInputElement>(selector)!)?.type;

describe('name parts named by a form builder', () => {
  it('reads WPForms\' first and last boxes as first and last names', () => {
    document.body.innerHTML = `<form><label for="f">Name</label><input id="f" class="wpforms-field-name-first" name="wpforms[fields][0][first]"><input id="l" class="wpforms-field-name-last" name="wpforms[fields][0][last]"><input type="email" name="wpforms[fields][1]"></form>`;
    expect([typeOf('#f'), typeOf('#l')]).toEqual(['firstName', 'lastName']);
  });
  it('reads Gravity Forms\' numbered name parts', () => {
    document.body.innerHTML = `<form><fieldset><legend>Name</legend><input id="f" name="input_16.3"><input id="l" name="input_16.6"></fieldset><input type="email" name="input_2"></form>`;
    expect([typeOf('#f'), typeOf('#l')]).toEqual(['firstName', 'lastName']);
  });
  it('leaves other numbered fields alone', () => {
    document.body.innerHTML = `<form><label for="a">Address</label><input id="a" name="input_5.3"><input id="q" name="input_7.3"></form>`;
    expect(typeOf('#a')).not.toBe('firstName');
    expect(typeOf('#q')).not.toBe('firstName');
  });
});

describe('a lead form\'s title', () => {
  it('reads "Title" with a "Job Title" placeholder as the job title', () => {
    document.body.innerHTML = `<form><input name="Title" id="t" placeholder="Job Title"><input type="email" name="Email"></form>`;
    expect(typeOf('#t')).toBe('jobTitle');
  });
  it('reads a bare "Title" two fields from the company as the job title', () => {
    document.body.innerHTML = `<form><label for="c">Company</label><input id="c" name="company"><label for="p">Phone</label><input id="p" type="tel"><label for="t">Title</label><input id="t" name="title"><label for="e">Email</label><input id="e" type="email"></form>`;
    expect(typeOf('#t')).toBe('jobTitle');
  });
  it('keeps the title of a post as a title', () => {
    document.body.innerHTML = `<form><label for="t">Title</label><input id="t" name="title"><label for="b">Body</label><textarea id="b" name="body"></textarea></form>`;
    expect(typeOf('#t')).toBe('title');
  });
});
