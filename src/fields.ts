// The field types DevFiller recognizes and generates, with their display names. Kept apart from
// data.ts so the fill engine can use it without bundling the generators and regional data.
export const fields = [
  ['username','Username'], ['fullName','Full name'], ['firstName','First name'], ['middleName','Middle name'], ['lastName','Last name'],
  ['email','Email'], ['phone','Phone'], ['password','Password'], ['birthDate','Date of birth'], ['age','Age'], ['gender','Gender'], ['nationality','Nationality'],
  ['year','Year'], ['experience','Years of experience'],
  ['company','Company'], ['jobTitle','Job title'], ['department','Department'], ['industry','Industry'], ['employeeCount','Employee count'],
  ['address','Street address'], ['address2','Apartment / suite'], ['city','City / commune'], ['district','District / daira'], ['state','State / wilaya'], ['postalCode','Postal code'], ['country','Country'],
  ['website','Website'], ['reference','Reference / order number'], ['bio','Biography'], ['description','Description'], ['message','Message'], ['subject','Subject'], ['notes','Notes'],
  ['quantity','Quantity'], ['measurement','Measurement'], ['material','Material / grade'], ['price','Price'], ['amount','Amount'], ['salary','Salary'], ['percentage','Percentage'], ['rating','Rating'],
  ['date','Date'], ['startDate','Start date'], ['endDate','End date'], ['time','Time'], ['color','Color'], ['search','Search'], ['title','Title'],
] as const;
export type FieldKey = typeof fields[number][0];
