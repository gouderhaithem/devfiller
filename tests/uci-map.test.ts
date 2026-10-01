import { describe, expect, it } from 'vitest';
import { compareField, compareFormType, UCI_LABELS } from '../scripts/uci/map';

describe('UCI label mapping', () => {
  it('covers every label of their classifier', () => {
    expect(Object.keys(UCI_LABELS).sort()).toEqual([
      'Address', 'AgeOrAgeGroup', 'BankAccountNumber', 'BusinessInfo', 'CitizenshipOrImmigrationStatus', 'DateOfBirth', 'EmailAddress', 'Ethnicity',
      'Fingerprints', 'Gender', 'GovernmentId', 'LocationCityOrCoarser', 'MilitaryStatus', 'Password', 'PersonName', 'PhoneNumber', 'PostalCode', 'TaxId', 'UsernameOrOtherId',
    ]);
  });

  it('agrees when our type is one their label covers', () => {
    expect(compareField(['PersonName'], 'firstName')).toBe('agree');
    expect(compareField(['LocationCityOrCoarser'], 'country')).toBe('agree');
    expect(compareField(['BankAccountNumber'], 'skip:iban')).toBe('agree');
  });

  it('agrees when any of several labels covers our type', () => {
    expect(compareField(['UsernameOrOtherId', 'EmailAddress'], 'email')).toBe('agree');
  });

  it('calls it a miss when they name a type we cover and we answer unknown', () => {
    expect(compareField(['PhoneNumber'], 'unknown')).toBe('missed');
  });

  it('calls it a conflict when we name a different type', () => {
    expect(compareField(['EmailAddress'], 'username')).toBe('conflict');
    expect(compareField(['PostalCode'], 'skip:card')).toBe('conflict');
  });

  it('calls it extra when they see no personal information and we name a type they would label', () => {
    expect(compareField([], 'email')).toBe('extra');
  });

  it('does not compare types outside their taxonomy', () => {
    expect(compareField([], 'message')).toBe('none');
    expect(compareField([], 'unknown')).toBe('none');
  });

  it('sets aside labels we have no type for', () => {
    expect(compareField(['GovernmentId'], 'unknown')).toBe('out-of-scope');
    expect(compareField(['TaxId'], 'reference')).toBe('out-of-scope');
  });

  it('still compares the in-scope label of a mixed answer', () => {
    expect(compareField(['GovernmentId', 'PersonName'], 'unknown')).toBe('missed');
  });
});

describe('UCI form type mapping', () => {
  it('compares the form types both sides know', () => {
    expect(compareFormType('Account Login Form', 'login')).toBe('agree');
    expect(compareFormType('Account Registration Form', 'login')).toBe('conflict');
    expect(compareFormType('Payment Form', 'checkout')).toBe('agree');
  });

  it('skips form types we have no equivalent for', () => {
    expect(compareFormType('Subscription Form', 'contact')).toBe('none');
    expect(compareFormType('Unknown', 'other')).toBe('none');
    expect(compareFormType(undefined, 'login')).toBe('none');
    expect(compareFormType('Account Login Form', undefined)).toBe('none');
  });
});
