import type { FieldKey } from './data';

// Invalid and boundary values for negative tests. Built for the planned `devfiller` npm package;
// the extension doesn't use them, and only will if users ask for it.

// Values an application's validation should reject. Some pass the browser's own checks
// (`user@example` is a valid type="email" value) or are cleaned up by it (type="color" turns
// "red" into #000000, and type="date" empties an impossible date): test them against the app.
export const INVALID_VALUES: Readonly<Partial<Record<FieldKey, readonly string[]>>> = {
  email: ['plainaddress', 'user@', '@example.com', 'user@@example.com', 'user@example', 'user name@example.com', 'user@exa mple.com', 'user@.example.com'],
  phone: ['123', 'phone', '+', '+213 12', '00000000000000000000', '+33 6 12 34 56 7a'],
  website: ['example', 'example.com', 'http//example.com', 'https://', 'https://exa mple.com'],
  postalCode: ['', 'ABCDE', '1', '1234567', '12 34'],
  birthDate: ['2026-02-30', '1990-13-01', '31/12/1990', 'yesterday', '2999-01-01'],
  date: ['2026-02-30', '2026-00-10', '10/10/2026', 'soon'],
  startDate: ['2026-02-30', 'soon'],
  endDate: ['2026-02-30', 'later'],
  time: ['25:00', '12:60', 'noon', '7'],
  age: ['-1', 'abc', '200', '12.5'],
  quantity: ['-1', '0.5', 'abc', '1e309'],
  price: ['-0.01', 'abc', '1,2,3', '1e309'],
  amount: ['-1', 'abc', '1e309'],
  salary: ['-1', 'abc'],
  percentage: ['-1', '101', 'abc'],
  rating: ['0', '6', '-1', 'abc'],
  employeeCount: ['-1', '0.5', 'abc'],
  color: ['red', '#12345', '#GGGGGG', '123456'],
  password: ['', 'a', '12345678', 'password'],
  username: ['', ' ', 'a', 'user name', 'user@name'],
};

export const invalidValues = (key: FieldKey): readonly string[] => INVALID_VALUES[key] ?? [''];

export interface Constraints { required?: boolean; minLength?: number; maxLength?: number; min?: number; max?: number; step?: number }
export interface BoundaryCase { label: string; value: string; valid: boolean }

const text = (length: number, fill: string) => fill.repeat(Math.ceil(Math.max(length, 0) / Math.max(fill.length, 1))).slice(0, Math.max(length, 0));

// The values on and just past each limit: the empty value, the shortest and longest allowed text
// and one character beyond, the smallest and largest allowed number on the step grid and one step
// beyond. `valid` follows the HTML rules. Browsers only report minlength and maxlength for text a
// person typed, and they stop typing at maxlength, so test the length cases by typing or pasting.
export function boundaryValues(constraints: Constraints, fill = 'a'): BoundaryCase[] {
  const cases: BoundaryCase[] = [{ label: 'empty', value: '', valid: !constraints.required }];
  const { minLength, maxLength, min, max } = constraints;
  const step = constraints.step && constraints.step > 0 ? constraints.step : 1;
  // minlength doesn't apply to an empty value, so "too short" starts at one character.
  if (minLength !== undefined && minLength > 0) cases.push({ label: 'shortest allowed', value: text(minLength, fill), valid: true });
  if (minLength !== undefined && minLength > 1) cases.push({ label: 'one character too short', value: text(minLength - 1, fill), valid: false });
  if (maxLength !== undefined && maxLength > 0) cases.push({ label: 'longest allowed', value: text(maxLength, fill), valid: true });
  if (maxLength !== undefined && maxLength >= 0) cases.push({ label: 'one character too long', value: text(maxLength + 1, fill), valid: false });
  const round = (n: number) => String(Number(n.toFixed(10)));
  // Allowed numbers sit on the grid min, min + step, …; without a min the grid starts at 0.
  const origin = min ?? 0;
  const onGrid = (n: number, down: boolean) => origin + (down ? Math.floor : Math.ceil)(Number(((n - origin) / step).toFixed(10))) * step;
  if (min !== undefined) cases.push({ label: 'smallest allowed', value: round(min), valid: true }, { label: 'one step below', value: round(min - step), valid: false });
  if (max !== undefined) {
    const largest = onGrid(max, true);
    cases.push({ label: 'largest allowed', value: round(largest), valid: true }, { label: 'one step above', value: round(largest + step), valid: false });
  }
  return cases;
}

// A confirmation that doesn't match: the value with its last character changed.
export function mismatchedConfirmation(value: string): string {
  if (!value) return 'x';
  const last = value.at(-1)!;
  return `${value.slice(0, -1)}${last === 'x' ? 'y' : 'x'}`;
}
