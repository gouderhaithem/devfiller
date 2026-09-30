# Benchmark fixtures

Each file is a standalone, realistic HTML form. Every control the engine can see declares the
type a careful human would give it, in `data-expect`. The benchmark compares the engine's
classification with that answer, so **label the truth, not what the engine does today**.

```html
<label for="tel">Numéro de téléphone</label>
<input id="tel" name="field_7" data-expect="phone">
<input name="promo" data-expect="unknown">
<input name="card" data-expect="skip:card">
```

## Rules

- Every visible `<input>`, `<select>` and `<textarea>` needs `data-expect`, except
  `type="hidden|submit|button|reset|image|file"`, which the engine never classifies.
- Every radio button in a group carries the group's type (a gender radio group is `gender` on
  each radio).
- A fixture is one self-contained file: `<!doctype html>`, `<meta charset="utf-8">`, a `<title>`,
  no external scripts, styles, fonts or images. Inline `<style>` is fine. Inline `<script>` is only
  for custom widgets (below) or app-style validation that sets `aria-invalid`, and must not
  submit, fetch or change fields on its own.
- **Custom widgets** built from ARIA roles need `data-expect` too, on the element that carries the
  role: `role="checkbox"`, `role="switch"`, each `role="radio"` in a `role="radiogroup"`, a
  `role="combobox"` that opens a `role="listbox"`, and rich-text editors (`contenteditable="true"`
  or `role="textbox"` on a non-input element). Their inline script behaves like the real thing:
  clicking a checkbox toggles `aria-checked`, clicking a combobox shows its options, clicking an
  option selects it.
- Keep every field visible (no `display:none`, no collapsed sections). Disabled or read-only
  fields are fine and still need `data-expect`.
- Names are `NN-topic.html`. Regression fixtures for reported bugs go in `regressions/`.

## Types

Use one of the 48 generator types:

| Type | Meaning |
| --- | --- |
| `username` | Login name, identifiant, اسم المستخدم |
| `fullName` | One field for the whole name |
| `firstName`, `middleName`, `lastName` | Name parts. French "Nom" alone is the last name; Arabic "الاسم" alone is the first name and "اللقب" the last name |
| `email` | Email, including "confirm email" |
| `phone` | Phone, mobile, telephone. A fax number is `unknown` |
| `password` | Every password box: current, new and confirmation |
| `birthDate`, `age`, `gender`, `nationality` | |
| `year` | A year on its own: graduation year, year of manufacture, start or end year |
| `experience` | Years of experience |
| `company`, `jobTitle`, `department`, `industry`, `employeeCount` | |
| `address` | Street address or address line 1 |
| `address2` | Apartment, suite, address line 2 |
| `city`, `district`, `state`, `postalCode`, `country` | `city` covers towns and communes (municipalities); `district` covers dairas, arrondissements and boroughs; `state` covers state, province, region and wilaya |
| `website` | Website, homepage, portfolio or profile URL |
| `bio`, `description`, `message`, `subject`, `notes` | Free text |
| `quantity`, `price`, `amount`, `salary`, `percentage`, `rating` | Numbers |
| `material` | A material or grade: steel grade (S235JR), stainless (304L), alloy, raw material |
| `measurement` | A physical quantity: length, width, height, thickness, weight, diameter, surface, volume |
| `reference` | An identifier of a record: order, invoice, reference, SKU, purchase order, ticket, part, lot or serial number. Personal and legal IDs (passport, national ID, VAT, tax, licence or registration numbers) and promo or referral codes are `unknown` |
| `date` | A date with no more specific role |
| `startDate`, `endDate` | Start/end, departure/return, check-in/check-out |
| `time`, `color`, `search` | |
| `title` | The title of a thing (article, ticket, job post). A civility title (Mr, Mrs) is `unknown` |

Two more kinds of answer:

- `unknown`: the page doesn't give enough evidence, or the field means something with no
  generator (promo code, national ID, captcha, fax, "how did you hear about us",
  an interests checkbox list).
- `skip:<kind>`: a sensitive field that must never be filled.
  - `skip:card`: card number, expiry, CVV/CVC, cardholder name
  - `skip:otp`: one-time, verification, SMS or 2FA codes
  - `skip:iban`: IBAN, BIC/SWIFT, RIB, bank account number
  - `skip:consent`: terms, privacy, newsletter, marketing or permission checkboxes, and declarations ("I certify…")
  - `skip:session`: "Remember me", "Keep me signed in" and similar session choices (skipped, but not counted as a leak)

## Relationships

These are checked after a fill with passwords on:

- `data-form-type` on a `<form>`: `login`, `signup`, `checkout`, `booking`, `contact`, `search` or `other`
- `data-same-as="<selector>"`: the field must end up with the same value as that field (confirmations)
- `data-after="<selector>"`: a date that must come after that field's date (end dates)
- `data-differs-from="<selector>"`: a value that must differ from that field's (a new password and the current one)
- `data-phone-region="dz|fr|us"`: a phone number that must be written in that country's format
- `data-phone-follows="<selector>"`: a phone number that must match the country chosen in that field
- `data-value-pattern="<regex>"`: the value written must match (a number, a code, a decimal comma)

Every fixture is also filled twice with the same seed, and must come out identical.
