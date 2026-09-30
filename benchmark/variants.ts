// Spelling variants: the same meaning written the ways developers name fields.
// Each variant becomes the only signal on a bare input, `name="..."`.

export interface VariantBase { phrase: string; expect: string }

export const VARIANT_BASES: readonly VariantBase[] = [
  { phrase: 'first name', expect: 'firstName' },
  { phrase: 'last name', expect: 'lastName' },
  { phrase: 'full name', expect: 'fullName' },
  { phrase: 'user name', expect: 'username' },
  { phrase: 'email address', expect: 'email' },
  { phrase: 'user email', expect: 'email' },
  { phrase: 'contact email', expect: 'email' },
  { phrase: 'phone number', expect: 'phone' },
  { phrase: 'mobile phone', expect: 'phone' },
  { phrase: 'contact phone', expect: 'phone' },
  { phrase: 'date of birth', expect: 'birthDate' },
  { phrase: 'company name', expect: 'company' },
  { phrase: 'job title', expect: 'jobTitle' },
  { phrase: 'street address', expect: 'address' },
  { phrase: 'address line 2', expect: 'address2' },
  { phrase: 'billing city', expect: 'city' },
  { phrase: 'postal code', expect: 'postalCode' },
  { phrase: 'zip code', expect: 'postalCode' },
  { phrase: 'shipping country', expect: 'country' },
  { phrase: 'website url', expect: 'website' },
  { phrase: 'start date', expect: 'startDate' },
  { phrase: 'end date', expect: 'endDate' },
  { phrase: 'order quantity', expect: 'quantity' },
  { phrase: 'unit price', expect: 'price' },
  { phrase: 'numéro de téléphone', expect: 'phone' },
  { phrase: 'numero telephone', expect: 'phone' },
  { phrase: 'nom de famille', expect: 'lastName' },
  { phrase: 'date de naissance', expect: 'birthDate' },
  { phrase: 'adresse électronique', expect: 'email' },
  { phrase: 'code postal', expect: 'postalCode' },
  { phrase: "nom d'utilisateur", expect: 'username' },
  { phrase: 'رقم الهاتف', expect: 'phone' },
  { phrase: 'البريد الإلكتروني', expect: 'email' },
  { phrase: 'تاريخ الميلاد', expect: 'birthDate' },
  { phrase: 'اسم المستخدم', expect: 'username' },
  { phrase: 'الرمز البريدي', expect: 'postalCode' },
  { phrase: 'اسم الشركة', expect: 'company' },
];

const stripAccents = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const capitalize = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);

// phone_number, phone-number, phoneNumber, PhoneNumber, PHONE_NUMBER, phone.number, phonenumber, …
export function spellings(phrase: string): string[] {
  const results = new Set<string>();
  for (const text of new Set([phrase, stripAccents(phrase)])) {
    const words = text.split(/[\s']+/).filter(Boolean);
    const lower = words.map(word => word.toLowerCase());
    results.add(lower.join(' '));
    results.add(lower.join('_'));
    results.add(lower.join('-'));
    results.add(lower.join('.'));
    results.add(lower.join(''));
    results.add(lower.map((word, i) => i ? capitalize(word) : word).join(''));
    results.add(lower.map(capitalize).join(''));
    results.add(lower.join('_').toUpperCase());
  }
  return [...results];
}

export function variantCases() {
  return VARIANT_BASES.flatMap(base => spellings(base.phrase).map(name => ({ base: base.phrase, name, expect: base.expect })));
}
