# Fill engine accuracy roadmap

_Written 30 September 2026, against DevFiller 1.0.0. Phases A to D were implemented the same day; see [the benchmark results](../benchmark/RESULTS.md)._

## Goal

Recognize the right field type whenever the page gives enough evidence, and **say "unknown" instead of guessing** when it doesn't. Detection stays deterministic, works offline and never calls an API. AI stays an optional extra for fields the engine can't classify, never a requirement.

The engine should prefer:

```text
unknown  over  a wrong classification
```

especially for sensitive fields.

## Principles

- **No AI, no network, no page data leaving the browser** for detection.
- **Every decision is explainable**: a type, a confidence, and the evidence behind it.
- **Measured, not guessed**: no engine change ships without benchmark numbers.
- **Detect sensitive fields, never fill them.** Card numbers, CVV, one-time codes, IBAN and consent boxes are recognized so they can be skipped reliably. The extension's privacy policy and store listing promise this.
- **Never submit a form.**
- **English, French and Arabic are first-class**, including Algerian vocabulary.
- **One engine** shared by the extension and the planned `devfiller` npm package.

## Where the engine is today

After phases A to D, the engine lives in `src/fill/` and ships as `dist/fill-engine.js`. For each control it:

1. Applies a custom rule if one matches (a side panel selector rule, then an exact label rule)
2. Detects sensitive fields (card, one-time code, bank, consent) and skips them
3. Scores candidate types from every signal: `autocomplete`, input type and `inputmode`, label, accessible name, `name`/`id`, placeholder, nearby text and legend, with negative evidence from the control's kind
4. Reads each form as a whole: select and radio answers, confirmation pairs, password roles, start and end dates, cardholder names, field order and the form's type
5. Uses the winning type at medium confidence and up, or at low confidence when **Fill unknown fields** is on
6. Otherwise treats the field as unknown: generic readable words, or an AI suggestion when AI is on

The benchmark in `benchmark/` measures every change, and the side panel shows each field's type, confidence and evidence.

### Remaining gaps

| Gap | Example that goes wrong | Phase |
| --- | --- | --- |
| Form types are guessed from fields and words | A newsletter box with a "Sign up" button reads as a sign-up form | D follow-up |
| Communes and dairas aren't in the vocabulary | A commune select is still unknown | E |
| No shadow DOM or iframe support | Web-component forms and embedded forms are skipped | F |
| Filling very large forms | 1,000 fields classify in about 70 ms and fill in about 0.33 s | F |

## Phases

The phases are ordered by dependency. Each one ends with the benchmark numbers the same as or better than before.

### Phase A: Benchmark (do this first)

**Status: done.** `npm run benchmark` runs 36 fixtures (453 fields, one of them a regression fixture), 12 held-out fixtures, relationship and form-type checks, spelling variants and performance, and fails CI on leaks, submissions, network requests or any drop in precision or recall.

Without a benchmark, every other phase is guesswork.

- `benchmark/fixtures/*.html`: realistic forms, where every field declares its expected type:

  ```html
  <label for="tel">Numéro de téléphone</label>
  <input id="tel" name="field_7" data-expect="phone">
  <input name="promo" data-expect="unknown">
  <input name="card" data-expect="skip:card">
  ```

- **Initial set, about 30 forms:** login, signup, profile, checkout, booking, contact, admin/CRUD, job application, French, Arabic (right-to-left), Algerian administrative forms, and adversarial forms (misleading names, missing labels, typos, duplicated fields, `name="field1"`).
- **Runner:** Playwright loads each fixture, runs the engine in scan mode, and compares each result with `data-expect`.
- **Report, per field type and overall:** precision, recall, F1, unknown rate, false-positive rate, and **sensitive-field leaks** (sensitive fields that got filled). Leaks must stay at zero.
- **Baseline:** record today's numbers in `benchmark/RESULTS.md`.
- **Regression rule:** every reported bug becomes a fixture before it's fixed.
- **Variant tests:** generate spellings of each alias (`phone_number`, `PhoneNumber`, `phone-number`, `رقم-الهاتف`, `numero telephone`) and check the result stays the same.

**Done when:** `npm run benchmark` prints the table, runs in CI, and fails if sensitive fields leak or precision drops.

### Phase B: Split the engine into modules (no behaviour change)

**Status: done.** Every benchmark answer was identical before and after the split. `panelPageAction` moved into the bundle too.

Build `src/fill/` as a bundled content script (`dist/fill-engine.js`), injected with `files:`, that exposes the same entry point.

```text
extract → normalize → classify → generate → apply → report
```

| Module | Responsibility |
| --- | --- |
| `extract.ts` | Controls and all their signals: attributes, labels, ARIA, `inputmode`, `pattern`, limits, options, legend, section heading, nearby text, form attributes |
| `normalize.ts` | One text pipeline: Unicode, lowercase, accents, Arabic normalization, camelCase, separators, whitespace, tokens, plural forms, abbreviations |
| `dictionary.ts` | Aliases per field type and language, as data, not strings scattered through code |
| `classify.ts` | The first-match cascade from today, moved over unchanged |
| `generate.ts` | Values from `data.ts` / `samples.ts`, fitted to the field's limits |
| `apply.ts` | Native setters, events, undo snapshot |

**Done when:** the benchmark numbers and all unit and browser tests are unchanged, and `background.ts` and `panel-page.ts` inject the file instead of the serialized function.

### Phase C: Scoring, confidence and evidence

**Status: done.** One deviation from the plan below: the visible label weighs slightly more than `name`/`id`, and sources that repeat each other (label and placeholder, name and id) count once. The misleading-names fixtures show why.

Replace the cascade with scored candidates.

```ts
interface Evidence { source: SignalSource; signal: string; weight: number }
interface Candidate { type: FieldType; score: number; evidence: Evidence[] }
interface Classification {
  type: FieldType | "unknown";
  confidence: number;          // 0..1, after the margin adjustment
  candidates: Candidate[];     // top alternatives, for the side panel
}
```

- **Candidates first:** tokens from the signals select a short list of likely types, and only those are scored. This keeps large forms fast.
- **Positive weights,** as a starting point to calibrate against the benchmark: `autocomplete` > input type > name/id tokens > label > placeholder > nearby text > CSS class. The label counts more when the name is meaningless (`field1`, a generated ID).
- **Negative weights:** `type=password` or `autocomplete=*-password` against email and name; the tokens "confirm", "repeat" and "re-enter" against the primary field; "search" against everything; `cc-*` forces a sensitive skip.
- **Token matching:** single-word aliases match whole words inside names (`userEmail` → `email`, `contact_phone` → `phone`), and a whole-signal match scores higher than a partial one.
- **Margin rule:** if the top two candidates are close (for example phone 87 and fax 84), lower the confidence and treat the field as ambiguous.
- **Thresholds** (calibrate on the benchmark): high ≥ 0.90, medium 0.70–0.89, low 0.50–0.69, and below 0.50 is unknown. Low-confidence fields fall back to generic text only when **Fill unknown fields** is on; sensitive types are never filled.
- **Explainability in the side panel:** each field shows its type, confidence and evidence, for example "Phone, 96%: autocomplete=tel, label 'téléphone', inputmode=tel".
- **Debug view:** an optional overlay on the page with the type and confidence on each field.

**Done when:** precision is the same or better on every field type, overall recall rises, and the unknown rate is reported and within an agreed limit.

### Phase D: Form context and relationships

**Status: done.** Decisions made along the way: "remember me" checkboxes are a `skip:session` kind (skipped, not counted as leaks); a name field in the same section as card fields is the cardholder and is skipped, while a shipping name in its own section is filled; a current password gets a different sample from the new one; radio groups and selects pick the answer matching the generated value ("Femme" for a female identity).

- **`<select>` options:** country lists, gender, wilayas and months each identify their field type.
- **Radio groups** classified as a whole: gender, payment method, contact preference.
- **Checkbox meaning:** terms, newsletter, "remember me" (skip) versus ordinary options (fill).
- **Pairs:** email/confirm email and password/confirm password share a value; a new password and its confirmation differ from the current password.
- **Date roles:** birth, start/end, departure/arrival, check-in/check-out and appointment dates, worked out from labels, order, neighbouring fields and `min`/`max`. End dates come after start dates.
- **Form type:** login, signup, checkout, booking, contact or search, based on all its fields. The form type adjusts the scores (for example "Name" on a checkout form means the cardholder name, which is skipped).
- **Field order:** common sequences (first name → last name → email → phone → address) raise confidence.

### Phase E: Data

- **Seeded generation:** `seed` → the same identity and values on every run, for reproducible tests. Default fills stay random.
- **Algeria profile:** wilaya, daira, commune, postal code, +213 mobile numbers, and names in French and Arabic, kept in a separate data module. Use an official administrative source, and record which version of the wilaya list it follows.
- **Phone numbers follow the form:** a country chosen in the form wins over the data language.
- **Invalid and boundary data** (invalid email, too long, below `min`, mismatched confirmation): built for the npm package first, and only exposed in the extension if users ask for it.

### Phase F: More of the page

- Open shadow roots, walked recursively. Closed shadow roots are skipped and reported.
- Same-origin iframes. For cross-origin frames: inject only where the extension already has permission, never get around browser security, and pass results by messaging.
- Incremental scanning: cache a classification per element, and rescan only new controls or changed attributes and labels. Never rescan the whole page on every change.
- Framework test fixtures: React controlled inputs, Vue, Angular, Svelte and server-rendered forms.

### Phase G: `devfiller` on npm

- Extract the Phase B modules as the `devfiller` package: `generate()`, `classify()` and `fill(page)` adapters for Playwright and Cypress, with the draft API on devfiller.com/docs/npm-package.
- The extension consumes the same package, so there's one engine.
- Publish the benchmark results with each release.
- Reserve the npm name before the first public mention, if it's still free.

## Performance targets

| Form size | Scan and classify |
| --- | --- |
| 10–50 fields | < 50 ms |
| 100 fields | < 100 ms |
| 500–1000 fields | < 200 ms, without noticeable UI blocking |

Measure these in the benchmark runner alongside accuracy.

## Release quality gate

Before each release that touches the engine:

- [ ] Benchmark: no drop in precision or recall for any field type, and zero sensitive-field leaks
- [ ] All regression fixtures pass
- [ ] Unit and browser tests pass
- [ ] Performance targets met
- [ ] React controlled inputs and dynamic forms tested
- [ ] English, French and Arabic fixtures pass
- [ ] The side panel explains every classification
- [ ] Still no network requests for detection

## Out of scope for the extension

- Filling card numbers, CVV, one-time codes, bank details or consent boxes, even when detected
- Submitting forms
- Sending page content anywhere for classification
- Splitting into many `@devfiller/*` packages before there's demand for it
