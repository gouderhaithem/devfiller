import type { Locale, Values } from '../data';
import type { Signal } from './extract';
import { SOURCE_GROUP } from './classify';

// The language a field is written in, so an Arabic label gets Arabic values whatever the
// extension's own language is. In order: the input's own lang or dir, a label that names the
// script ("Nom en arabe", "الاسم بالعربية"), then a label written in one script only (a bilingual
// "Nom / اللقب" says nothing), then the other words a person reads, then the page's lang.

const ARABIC_LETTERS = /[\u0600-\u06FF\u0750-\u077F]/u;
const LATIN_LETTERS = /[A-Za-z\u00C0-\u024F]/;
const SAYS_ARABIC = /\b(?:in arabic|arabic|en arabe|arabe)\b|بالعربية|بالعربي|باللغة العربية/iu;
const SAYS_LATIN = /\b(?:in latin|latin|en latin|en français|en francais|in french|in english)\b|بالفرنسية|بالحروف اللاتينية|باللاتينية/iu;
const NAMING: ReadonlySet<string> = new Set(['label', 'aria-label', 'aria-labelledby']);

type Script = 'ar' | 'latin' | 'mixed' | undefined;
function scriptOf(text: string): Script {
  if (SAYS_ARABIC.test(text)) return 'ar';
  if (SAYS_LATIN.test(text)) return 'latin';
  const arabic = ARABIC_LETTERS.test(text), latin = LATIN_LETTERS.test(text);
  return arabic && latin ? 'mixed' : arabic ? 'ar' : latin ? 'latin' : undefined;
}

export function fieldLocale(el: Element, signals: readonly Signal[] = []): Locale | undefined {
  const own = (el.getAttribute('lang') || '').toLowerCase();
  if (own) return own.startsWith('ar') ? 'ar' : undefined;
  // dir="rtl" alone may only align text, or be Hebrew or Persian: it settles a bilingual label.
  const rtl = (el.getAttribute('dir') || '').toLowerCase() === 'rtl';
  const visible = signals.filter(signal => SOURCE_GROUP[signal.source] === 'visible');
  for (const texts of [visible.filter(signal => NAMING.has(signal.source)), visible.filter(signal => !NAMING.has(signal.source))]) {
    const script = scriptOf(texts.map(signal => signal.raw).join(' '));
    if (script === 'ar' || (script === 'mixed' && rtl)) return 'ar';
    if (script) return undefined;
  }
  return /^ar\b/i.test(el.closest('[lang]')?.getAttribute('lang') || document.documentElement.lang || '') ? 'ar' : undefined;
}

// The values for a field: the ones in its own language when the fill brought them.
export function valuesIn(localized: Partial<Record<Locale, Values>>, fallback: Values, locale: Locale | undefined): Values {
  return (locale && localized[locale]) || fallback;
}
