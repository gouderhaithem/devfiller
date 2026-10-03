// @vitest-environment jsdom
// French and Arabic wording the rules missed on real forms collected from French, Algerian, Moroccan,
// Tunisian and Gulf websites (2 October 2026).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { analyzePage } from '../src/fill/context';
import { listControls } from '../src/fill/extract';

beforeEach(() => {
  document.body.replaceChildren();
  vi.spyOn(Element.prototype, 'getClientRects').mockReturnValue([{}] as unknown as DOMRectList);
});
const typeOf = (selector: string) => analyzePage(listControls(), undefined, [], false).fields.get(document.querySelector<HTMLInputElement>(selector)!)?.type;
const select = (prompt: string, options: readonly string[]) => `<select id="s" name="f_574"><option value="">${prompt}</option>${options.map(o => `<option>${o}</option>`).join('')}</select>`;

describe('a select named only by its prompt', () => {
  it.each([
    ['Choisir Fonction', ['Achat', 'Commercial', 'Comptabilité'], 'jobTitle'],
    ['Sélectionnez votre pays', ['Algérie', 'Maroc', 'Tunisie'], 'country'],
    ['اختر الخبرة', ['خريج', 'أقل من سنة', 'سنتان'], 'experience'],
    ['حدد الراتب', ['250 - 499', '500 - 749', '750 - 999'], 'salary'],
  ])('reads "%s" as its type', (prompt, options, type) => {
    document.body.innerHTML = `<form>${select(prompt, options)}</form>`;
    expect(typeOf('#s')).toBe(type);
  });
});

describe('French and Arabic words', () => {
  it.each([
    ['<input id="f" name="kw" placeholder="Mots clés">', 'search'],
    ['<label for="f">Gare de départ</label><input id="f" name="gd">', 'city'],
    ['<label for="f">خبرتك</label><input id="f" name="exp" type="number">', 'experience'],
    ['<label for="f">راتبك المتوقع</label><input id="f" name="sal" type="number">', 'salary'],
  ])('reads %s', (field, type) => {
    document.body.innerHTML = `<form>${field}</form>`;
    expect(typeOf('#f')).toBe(type);
  });
});

describe('"الاسم" and "Name"', () => {
  it('reads "الاسم" as the full name when it is the only name field', () => {
    document.body.innerHTML = `<form><label for="n">الاسم*</label><input id="n" name="name"><label for="e">البريد الإلكتروني</label><input id="e" type="email"></form>`;
    expect(typeOf('#n')).toBe('fullName');
  });
  it('reads "الاسم" beside "اللقب" as the first name', () => {
    document.body.innerHTML = `<form><label for="l">اللقب</label><input id="l" name="nom"><label for="n">الاسم</label><input id="n" name="prenom"></form>`;
    expect([typeOf('#l'), typeOf('#n')]).toEqual(['lastName', 'firstName']);
  });
  it('reads "Name" beside "Last name" as the first name', () => {
    document.body.innerHTML = `<form><label for="n">Name</label><input id="n" name="name"><label for="l">Last name</label><input id="l" name="last"></form>`;
    expect([typeOf('#n'), typeOf('#l')]).toEqual(['firstName', 'lastName']);
  });
  it('keeps "Full name" beside a last name as the full name', () => {
    document.body.innerHTML = `<form><label for="n">Full name</label><input id="n"><label for="l">Last name</label><input id="l"></form>`;
    expect(typeOf('#n')).toBe('fullName');
  });
});

// From the second collection of French and Arabic forms (3 October 2026).
describe('more French and Arabic wording', () => {
  const choices = (label: string) => `<label for="f">${label}</label><select id="f" name="f_9"><option value="">--</option><option>Facturation</option><option>Livraison</option><option>Autre</option></select>`;
  it.each(['Thématique', 'Motif de votre réclamation', 'Nature de la réclamation', 'Votre demande concerne', 'نوع الرسالة', 'نوع الاقتراح'])('reads a select labelled "%s" as the subject', label => {
    document.body.innerHTML = `<form>${choices(label)}</form>`;
    expect(typeOf('#f')).toBe('subject');
  });
  it('reads "عنوان الرسالة" (the message\'s title) as the subject', () => {
    document.body.innerHTML = `<form><label for="f">عنوان الرسالة</label><input id="f" name="msg_title"></form>`;
    expect(typeOf('#f')).toBe('subject');
  });
  it.each(['Numéro de client', 'Numéro de colis', "Votre numéro d'abonné", 'N° Contrat', 'Numéro de donateur', 'رقم العميل', 'رقم الاشتراك'])('reads "%s" as a reference', label => {
    document.body.innerHTML = `<form><label for="f">${label}</label><input id="f" name="ref_9"></form>`;
    expect(typeOf('#f')).toBe('reference');
  });
  it.each([
    ['<select id="f" name="dialcode"><option>+966</option><option>+973</option><option>+213</option><option>+212</option><option>+33</option></select>', 'a dial-code select'],
    ['<label for="f">رمز الاتصال</label><select id="f" name="code"><option>+966</option><option>+971</option><option>+20</option><option>+962</option></select>', '"رمز الاتصال"'],
  ])('reads %s as the country', field => {
    document.body.innerHTML = `<form>${field}</form>`;
    expect(typeOf('#f')).toBe('country');
  });
  it('keeps a typed "Indicatif" box away from a country name, which the site would reject', () => {
    document.body.innerHTML = `<form><label for="f">Indicatif</label><input id="f" name="ind" placeholder="+213"></form>`;
    expect(typeOf('#f')).not.toBe('country');
  });
  it('reads a visible "Nom de famille" over name="Name" as the last name', () => {
    document.body.innerHTML = `<form><input id="f" type="text" name="Name" placeholder="Nom de famille"></form>`;
    expect(typeOf('#f')).toBe('lastName');
  });
  it.each(['<label for="f">Code d\'activation</label><input id="f" name="act">', '<input id="f" type="password" name="QATextActivationCode">', '<label for="f">رمز التفعيل</label><input id="f" name="code">'])('reads %s as a one-time code', field => {
    document.body.innerHTML = `<form>${field}</form>`;
    expect(typeOf('#f')).toBe('skip:otp');
  });
  it('keeps a field named "client" the client\'s company, not a client number', () => {
    document.body.innerHTML = `<form><label for="f">Client</label><input id="f" name="client"></form>`;
    expect(typeOf('#f')).not.toBe('reference');
  });
  it('keeps the reason for a medical appointment, and a reason typed at length, out of topics', () => {
    document.body.innerHTML = `<form><label for="f">Motif</label><select id="f" name="motif"><option>Consultation</option><option>Renouvellement d'ordonnance</option><option>Vaccination</option></select><label for="t">Motif de la demande</label><textarea id="t" name="field_17"></textarea></form>`;
    expect(typeOf('#f')).not.toBe('subject');
    expect(typeOf('#t')).not.toBe('subject');
  });
  it.each(['Catégorie de produit', 'Code postal'])('leaves "%s" to its own reading', label => {
    document.body.innerHTML = `<form>${choices(label)}</form>`;
    expect(typeOf('#f')).not.toBe('subject');
  });
});
