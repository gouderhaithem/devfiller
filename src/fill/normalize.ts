// One text pipeline for every signal and alias: camelCase (userEmail, DUtilisateur), accents,
// Arabic diacritics and alif/ya variants, case, a trailing number (line2 → line 2) and punctuation.
export function normalize(text: string): string {
  return text.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/([A-Z])([A-Z][a-z])/g, '$1 $2').normalize('NFD').replace(/[\u0300-\u036f\u064b-\u065f]/g, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').toLowerCase().replace(/(\p{L}{3,})(\d)/gu, '$1 $2').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}
