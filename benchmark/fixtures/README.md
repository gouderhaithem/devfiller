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
  no external scripts, styles, fonts or images. Inline `<style>` is fine.
- Keep every field visible (no `display:none`, no collapsed sections). Disabled or read-only
  fields are fine and still need `data-expect`.
- Names are `NN-topic.html`. Regression fixtures for reported bugs go in `regressions/`.

## Types

Use one of the 42 generator types:

| Type | Meaning |
| --- | --- |
| `username` | Login name, identifiant, اسم المستخدم |
| `fullName` | One field for the whole name |
| `firstName`, `middleName`, `lastName` | Name parts. French "Nom" alone is the last name; Arabic "الاسم" alone is the first name and "اللقب" the last name |
| `email` | Email, including "confirm email" |
| `phone` | Phone, mobile, telephone. A fax number is `unknown` |
| `password` | Every password box: current, new and confirmation |
| `birthDate`, `age`, `gender`, `nationality` | |
| `company`, `jobTitle`, `department`, `industry`, `employeeCount` | |
| `address` | Street address or address line 1 |
| `address2` | Apartment, suite, address line 2 |
| `city`, `state`, `postalCode`, `country` | `state` covers state, province, region and wilaya |
| `website` | Website, homepage, portfolio or profile URL |
| `bio`, `description`, `message`, `subject`, `notes` | Free text |
| `quantity`, `price`, `amount`, `salary`, `percentage`, `rating` | Numbers |
| `date` | A date with no more specific role |
| `startDate`, `endDate` | Start/end, departure/return, check-in/check-out |
| `time`, `color`, `search` | |
| `title` | The title of a thing (article, ticket, job post). A civility title (Mr, Mrs) is `unknown` |

Two more kinds of answer:

- `unknown`: the page doesn't give enough evidence, or the field means something with no
  generator (promo code, reference number, national ID, captcha, fax, "how did you hear about us",
  a "remember me" checkbox, an interests checkbox list).
- `skip:<kind>`: a sensitive field that must never be filled.
  - `skip:card`: card number, expiry, CVV/CVC, cardholder name
  - `skip:otp`: one-time, verification, SMS or 2FA codes
  - `skip:iban`: IBAN, BIC/SWIFT, RIB, bank account number
  - `skip:consent`: terms, privacy, newsletter or marketing consent checkboxes
