// How the UCI web form dataset's labels line up with ours. Their PI type classifier names 19 kinds
// of personal information; each maps to the field types of ours it covers. Labels we have no type
// for are set aside, and our types outside their taxonomy (message, quantity…) are never compared.
import type { FormType } from '../../src/fill/context';

export const UCI_LABELS: Readonly<Record<string, readonly string[]>> = {
  EmailAddress: ['email'],
  PersonName: ['fullName', 'firstName', 'middleName', 'lastName'],
  Password: ['password'],
  UsernameOrOtherId: ['username'],
  PhoneNumber: ['phone'],
  PostalCode: ['postalCode'],
  Address: ['address', 'address2'],
  LocationCityOrCoarser: ['city', 'district', 'state', 'country'],
  BusinessInfo: ['company', 'jobTitle', 'department', 'industry', 'employeeCount'],
  // Split birth dates are often a year or a plain date select.
  DateOfBirth: ['birthDate', 'year', 'date'],
  AgeOrAgeGroup: ['age'],
  Gender: ['gender'],
  CitizenshipOrImmigrationStatus: ['nationality', 'country'],
  BankAccountNumber: ['skip:iban', 'skip:card'],
  TaxId: [],
  GovernmentId: [],
  Ethnicity: [],
  MilitaryStatus: [],
  Fingerprints: [],
};

// Our types their taxonomy would label: answering one where they see no PI is worth a look.
const COVERED: ReadonlySet<string> = new Set(Object.values(UCI_LABELS).flat());

export type FieldVerdict = 'agree' | 'missed' | 'conflict' | 'extra' | 'out-of-scope' | 'none';

export function compareField(labels: readonly string[], ours: string): FieldVerdict {
  const inScope = labels.filter(label => UCI_LABELS[label]?.length);
  if (!inScope.length) return labels.length ? 'out-of-scope' : COVERED.has(ours) ? 'extra' : 'none';
  if (inScope.some(label => UCI_LABELS[label].includes(ours))) return 'agree';
  return ours === 'unknown' ? 'missed' : 'conflict';
}

export const UCI_FORM_TYPES: Readonly<Record<string, FormType>> = {
  'Account Login Form': 'login',
  'Account Registration Form': 'signup',
  'Payment Form': 'checkout',
  'Reservation Form': 'booking',
  'Contact Form': 'contact',
  'Search Form': 'search',
};

export type FormVerdict = 'agree' | 'conflict' | 'none';

// No verdict when either side has no type to compare: theirs unmapped, or the engine read no form.
export function compareFormType(theirs: string | undefined, ours: string | undefined): FormVerdict {
  const expected = theirs && UCI_FORM_TYPES[theirs];
  if (!expected || !ours) return 'none';
  return expected === ours ? 'agree' : 'conflict';
}
