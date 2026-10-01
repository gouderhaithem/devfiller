# Benchmark results

Numbers from `npm run benchmark`, run in headless Chromium on 30 September 2026. The full
report for any run is written to `benchmark/results/latest.md`. See the [benchmark README](README.md)
for what each metric means and the [roadmap](../docs/ENGINE_ROADMAP.md) for the phases.

## Main fixtures

The 30 original fixtures (396 fields), plus one regression fixture (10 fields) from Phase C on.
Precision and recall count typed answers, including the `skip:*` sensitive types. The unknown
rate includes fields whose right answer is `unknown` (14% of the fixtures).

| | Phase A: baseline (1.0.0) | Phase B: modules | Phase C: scoring |
| --- | --- | --- | --- |
| Fields | 396 | 396 | 406 |
| Precision | 99.6% | 99.6% | 100.0% |
| Recall | 70.6% | 70.6% | 100.0% |
| F1 | 82.6% | 82.6% | 100.0% |
| Unknown rate | 39.1% | 39.1% | 14.5% |
| False-positive rate | 0.0% | 0.0% | 0.0% |
| Wrong-type rate | 0.3% | 0.3% | 0.0% |
| **Sensitive-field leaks** | **11** | **11** | **0** |
| Form submissions / network requests | 0 / 0 | 0 / 0 | 0 / 0 |
| Spelling variants correct | 186 / 299 | 186 / 299 | 299 / 299 |

Phase B changed no answer: the summary, every per-type number and the list of individual
mistakes were identical to Phase A.

**Read the Phase C column with care.** The dictionary and weights were tuned while looking at
these fixtures, so 100% is an upper bound, not an estimate of real-world accuracy. Many types
also appear only once or twice (`age`, `bio`, `color`, `price` and others), so their per-type
numbers carry little weight. The held-out fixtures below are the honest estimate.

### The Phase A leaks

Today's 1.0.0 engine fills these, which the store listing promises it never does:

- IBAN, BIC, RIB and bank-account-holder fields (6): there was no bank detection at all.
- Marketing opt-ins worded without "consent", "newsletter" or "terms" (5): "Yes, send me special
  offers", "I would like to receive marketing emails", "Share my details with event sponsors", a
  research follow-up opt-in, and an unlabelled "I agree" checkbox whose text sits beside it.

## Held-out fixtures

12 more forms (239 fields), written without access to the engine or the other fixtures, in
`fixtures/holdout/`: car rental, medical appointment, school enrolment, real-estate enquiry,
Algerian insurance and tax forms, account preferences, restaurant booking and library card in
Arabic, a French freelance invoice, a gym membership and a bilingual volunteer form.

| Engine | Precision | Recall | F1 | Unknown rate | Wrong-type rate | Leaks |
| --- | --- | --- | --- | --- | --- | --- |
| Phase A (1.0.0) | 98.8% | 46.9% | 63.6% | 64.9% | 0.4% | 15 |
| Phase C, first run | 97.3% | 80.2% | 87.9% | 38.9% | 1.7% | 5 |
| Phase C, after the consent fix | 97.4% | 83.1% | 89.6% | 36.8% | 1.7% | 0 |
| Phase C, final (after code review) | 96.7% | 83.1% | 89.4% | 36.4% | 2.1% | 0 |

On these forms 1.0.0 fills 15 sensitive fields: 10 consent checkboxes, 3 bank fields and 2 card fields that have no `autocomplete` token.

The first Phase C run is the only measurement on forms the engine had never seen. It found five
more consent checkboxes worded as permission ("J'autorise l'établissement à publier des photos")
or as a request for messages ("Email me new listings", "Send me the weekly digest", "Tick to hear
about… deals", "Je souhaite recevoir les actualités"). They became
[`regressions/r01-consent-wording.html`](fixtures/regressions/r01-consent-wording.html) before the
fix, which covers each kind of wording rather than the exact sentences. The held-out consent
numbers are no longer independent; the other types are, and nothing else was tuned on them.

The code review widened card, bank and declaration detection ("Card PIN", `ccnum`, "Account no", "I certify…", "I am over 18"). On the held-out forms that turned two ordinary checkboxes into skipped consent fields, the safe direction, which is the drop from 97.4% to 96.7%. Nothing was tuned on the held-out results.

What this says about the scoring engine on unseen forms: it recognizes about 33 more fields in
every 100 than 1.0.0 did, at the cost of about 1.5 points of precision (1.7% of fields get a
wrong type, against 0.4% before, and two of the five are sensitive-side skips). The main held-out misses are fields with no alias at all
(amounts, quantities and cities worded unusually) and date roles that only context reveals, which
is Phase D work.

## Phase D: form context and relationships

Five fixtures were added for Phase D (unlabelled selects and radio groups, confirmation pairs,
password roles, date roles and a cardholder name), and every `<form>` was labelled with its type.
The Phase C engine was measured on them before any Phase D code was written.

| | Phase C | Phase D |
| --- | --- | --- |
| Fields (36 fixtures) | 453 | 453 |
| Precision | 99.5% | 100.0% |
| Recall | 94.1% | 100.0% |
| Sensitive-field leaks | 1 (a cardholder name) | 0 |
| Confirmation fields hold the same value | 11 / 11 | 11 / 11 |
| End dates after start dates | 3 / 8 | 8 / 8 |
| New password differs from the current one | 0 / 2 | 2 / 2 |
| Form types | 19 / 44 (all "other") | 38 / 44 |
| Held-out precision / recall | 96.7% / 82.6% | 96.8% / 83.7% |
| Held-out form types / relationship checks | — | 9 / 12, 5 / 5 |

The same caveat as Phase C applies: the main fixtures were used while building Phase D, so their
100% is an upper bound. On the held-out forms Phase D fixed one date role and added no new
mistakes. The six remaining form-type misses on the main fixtures are judgement calls (an SMS
verification step read as sign-in, a newsletter box as sign-up, an event registration as a
booking, and three name-and-password forms labelled "other" read as sign-ups); the labels were
left as they were rather than changed to match the engine.

The Phase D code review found two more ways to fill a sensitive field (a card-expiry date retyped
as an end date, and expiry month and year selects beside a card number) and a crash on dates in
another format. All three are fixed and covered by tests.

## Phase E: data

Phase E changed how values are generated, not how fields are recognized. Three things are
measured on every fixture:

| Check | Result |
| --- | --- |
| Seeded repeat: two page loads and a refill with the same seed give identical values | 37 / 37 fixtures |
| Phone follows the form (a country field or a dial code on the field) | 3 / 3 |
| Precision / recall on the main fixtures (464 fields) | 100% / 100% |
| Held-out recall | 83.7% → 85.4%, because communes are now recognized as cities |

Two fixtures were relabelled for Phase E's spec change: a commune is now `city` (it was
`unknown`), matching what the held-out fixtures' author had already chosen independently.

The Phase E code review found that a fixed region made every second fresh fill pick a different
country or wilaya option, that seeded generic text shifted when a field was added, and that
phone hints misread French landlines and compact numbers. All are fixed and tested. Its data
checks confirmed the wilaya codes, names and chef-lieu postal codes.

## Measurements, references and units

Added after a real production-planning form filled "N° de commande", "Longueur (mm)" and
"Poids unitaire (kg)" with words. Two fixtures rebuild that kind of form (French, and an English
work order with imperial units), and `data-value-pattern` checks the shape of each value.

| | Before | After |
| --- | --- | --- |
| Values with the right shape (a number, a code, a decimal comma) | 2 / 20 | 20 / 20 |
| Measurement fields recognized | 0 / 8 | 8 / 8 |
| Reference fields recognized | 0 / 10 | 10 / 10 |
| Precision / recall on the main fixtures (496 fields) | 99.8% / 94.9% | 100% / 100% |
| Form types | 41 / 49 | 45 / 49 |
| Held-out precision / recall | 96.8% / 84.4% | 96.4% / 88.3% |

Six fixture fields were relabelled `reference` under the new definition (an order, invoice, SKU,
purchase-order, reference or property-reference number), four in the main set and two held out;
personal and legal numbers and promo codes stay `unknown`. On the held-out set one more field
is now called a reference that the labels call unknown, which is the small precision drop. Rules
that came out of this work, all general: generic words alone can't reach the threshold however
many there are, a currency means an amount unless the label says price or it's a rate, and a
form's words only confirm a type its fields suggest (which also fixed a sign-up and a sign-in
misread).

## Real-world accuracy work: rotation, validation, widgets, data

The first held-out set had been measured against several times, so its 12 forms joined the main
fixtures, and a fresh held-out set of 14 forms (`fixtures/holdout/`) was written without access to
the engine before any of the following was built: exporting forms as fixtures, per-site type
rules, fitting values to the page's validation, custom ARIA widgets, 1,490 Algerian communes and a
material type.

| Fresh held-out set | Precision | Recall | Unknown rate | Wrong-type rate | Leaks |
| --- | --- | --- | --- | --- | --- |
| Before (native fields only, 248) | 96.3% | 88.0% | 23.4% | 2.8% | 2 |
| After (native fields and 20 widgets, 268) | 95.5% | 89.4% | 24.6% | 3.4% | 0 |

The two numbers aren't strictly comparable: the second also scores custom widgets, which the
engine ignored before. Two widget checkboxes the labels call ordinary are now skipped as consent,
the safe direction. The held-out set found three more kinds of consent the engine missed (an
Arabic declaration, "Opt me in to … communications" and a switch sharing usage data); each became
a regression fixture before the fix, so the held-out consent numbers are no longer independent.

On the main fixtures (770 fields, including the rotated forms, which carry their misses with them):

| Check | Result |
| --- | --- |
| Precision / recall | 99.0% / 96.7% |
| Filled values the page accepts (its own rules and aria-invalid) | 509 / 509 |
| Values with the expected shape | 29 / 29 |
| Seeded repeats, confirmations, end dates, new passwords, phones | all pass |
| Sensitive-field leaks, native and widget | 0 |

The baseline was reset to these numbers, since the main set changed.

## Form Lab: 30 held-out pages

On 30 September 2026 the engine was run on Form Lab, a separate site of 30 test pages written
without access to the engine, and labelled blind from the [labelling guide](fixtures/README.md):
779 fields covering logins, checkouts, bookings, surveys, French, Arabic and Algerian forms,
ARIA widgets, shadow DOM, iframes, controlled inputs, honeypots and a 122-field enterprise form.
Each page was classified, then filled with the extension's default settings.

| | Before | After |
| --- | --- | --- |
| Precision | 79.4% | 90.6% |
| Recall | 77.5% | 89.9% |
| F1 | 78.4% | 90.3% |
| Fields left empty because they looked sensitive but weren't | 69 | 12 |
| Sensitive fields filled | 2 | 0 |
| Honeypots filled | 3 | 0 |
| Values the page rejected | 2 | 0 |
| Fields filled, as the page counts them | 79.0% | 84.1% |

What it found, now fixed, with a fixture for each in `fixtures/regressions/r04`–`r06`:

- **Card words that other documents use.** "Expiry", "PIN" and "carte" made "Passport expiry",
  an account PIN and "Numéro de carte d'identité" card fields, and the card section then skipped
  every name and date beside them. These words now need a card field in the same form, and a
  field with its own autocomplete token or a confident date keeps its type.
- **Consent read into questions.** "How much do you *agree*" made a Likert scale consent,
  "authorized to work", "sponsorship" and medical "conditions" did too. A scale is never consent,
  and those words now match only as whole words or phrases. A yes/no newsletter select and
  declarations under a plain heading (not a `<legend>`) were filled; both are skipped now.
- **Honeypots.** Fields inside `aria-hidden`, placed off the page or saying "leave this empty"
  were filled, which is how pages spot bots.
- **A section heading treated as the field.** A "Search flights" legend pushed every field in the
  form down to unknown, and `q_a` read as a search box. Headings no longer penalize their fields,
  and a `title` is the field's name when it has no other.
- **Missing vocabulary.** Adults, children, rooms, tickets, income, expenses, down payment,
  "How likely are you to recommend", expiry and issue dates.
- **Values that don't fit.** A two-letter country field got "Un"; it now gets the country code.
  A URL slug got a website.
- **Page settings.** A checkbox outside the page's forms (a settings toggle) was flipped; when a
  page keeps its fields in forms, choices outside them are left alone.
- **Shadow DOM.** Fields inside open shadow roots were never seen; they are now classified and
  filled, and their input events leave the shadow root as typing does.

The main fixtures and the held-out set improved too: main F1 97.9% → 98.1% (817 fields, with the
three new regression fixtures), held-out F1 92.3% → 93.1%.

Not fixed here: forms inside iframes are still out of reach, because the extension injects the
engine into the top frame only; form types were right for 32 of 46 forms; and fields in hidden
wizard steps are filled only once their step is shown, which is by design.

## Form Lab, second round: 45 more pages

Every fix from the first round was tested on 30 new Form Lab pages (31–60), written blind, and
then on 15 more (61–75) written while this round's fixes were being made and not looked at until
they were done. The first round's gains didn't carry over: pages 1–30 went from 78.4% to 90.2%, but
the new pages 31–60 scored 87.3% before this round, the same as before the first round's fixes (87.1%).

| F1 | Before this round | After |
| --- | --- | --- |
| **Held-out pages 61–75** (345 fields, never tuned on) | **82.3%** | **83.1%** |
| Pages 31–60, which this round was tuned on | 87.3% | 92.9% |
| Pages 1–30 | 90.2% | 90.7% |
| All 75 pages (1,875 fields) | 87.6% | 90.2% |

On the held-out pages, recall rose from 76.1% to 79.5% and exact accuracy from 78.6% to 80.9%;
start and end dates now come out in order (12 of 15 relationship checks, from 4). Precision fell,
from 89.5% to 86.9%. Field by field, 10 answers got better and 2 worse, and both are years the engine reads as `year`, a type
the labelling guide didn't list yet. A code review also caught a consent leak in a first version
of the radio-answer rule ("Yes, please send me offers" under a neutral question); it was fixed
before these numbers were taken. No sensitive field or honeypot was filled on any of the 75
pages. **The 10-point gap between the tuned pages (92.9%) and the held-out ones (83.1%) is the number to watch.**

Fixed, each by mechanism rather than by page, with fixtures `r07` and `r08`:

- **Dates:** a date input with no recognizable words is a date, not unknown; a pair whose labels
  end in from/to ("Period from", "Period to") is a start and an end; "Departure" after an arrival
  ends the stay; split birth-date selects no longer tie between birth date and date; a select of
  durations ("7 days") is not a date.
- **Times:** selects and radio groups of clock times are times.
- **Other people:** "Manager's name", "Name of host person" are full names, and an emergency
  contact's, manager's or guardian's name, email and phone get a second identity instead of the
  applicant's.
- **Radio groups:** a section heading no longer gives radios a free-text type ("About you" → bio);
  third-person "accepts" and "accepted" aren't consent, and an answer makes its group consent only
  when it agrees to something ("Oui, notification reçue" doesn't). Notification settings are consent.
- **Vocabulary and units:** bedrooms, bathrooms, subtotals, declared values, durations ("(days)",
  "Years with…"), miles, summaries and headlines, symptoms, steps and reasons; a numbered select is no
  longer a rating scale on its own.
- **Look-alikes:** a version number isn't a phone, "Employee ID" isn't an employer, and promo,
  coupon and offer codes have no type.
- **Phones:** a French-language form gets a French number and a form with a US state select a US one.

## Form Lab, sealed pages 151–195

Pages 151–180 (631 fields: everyday forms, French and Arabic forms from seven countries, and the
markup of ten form builders) were written blind and opened once on 1 October 2026:

| F1 | `main` before | Rules only (default) | Rules + learned guesses |
| --- | --- | --- | --- |
| Pages 151–180 | 86.3% | 88.0% | 91.0% |
| Everyday forms (151–160) | 82.4% | 84.7% | 90.4% |
| French and Arabic (161–170) | 92.4% | 93.8% | 96.6% |
| Form-builder markup (171–180) | 84.3% | 85.6% | 86.3% |

They found two consent boxes that were ticked in every version (an "Email Opt Out" box and "Save
this address to my account for next time"), notification switches read without the heading above
them, a "…back by" deadline that came out equal to its start date, and US forms without a country
field whose phones followed the generated region instead of the form. All five are fixed, with
tests in `tests/form-lab-4.test.ts`. The guide now settles "save my details" and opt-out boxes as
`skip:consent`, and `04-checkout`'s "Save this information for next time" is relabelled to match.

Pages 181–195 (327 fields, checkouts, preference toggles, US and French/Arabic forms) were written
while these fixes were made and opened once afterwards:

| Pages 181–195 | F1 | Precision | Recall | Sensitive fields filled |
| --- | --- | --- | --- | --- |
| `main` | 79.3% | 85.6% | 73.9% | 3 |
| These fixes (default) | 79.6% | 85.6% | 74.3% | 2 |
| These fixes + learned guesses | 83.3% | 86.2% | 80.5% | 2 |

Field by field against `main`, one answer got better and none got worse. These pages lean on
consent toggles and preference checkboxes, and that is where most remaining mistakes are: 10
consent fields read as unknown (two of them were ticked, both email-preference checkboxes), and 5
fields beside a card read as card data. That is the next round's work. Both sets are now retired.

## Confidence calibration

Typed answers on the main fixtures, by confidence band. Sensitive skips and unknowns are left out.

| Band | Answers | Precision |
| --- | --- | --- |
| High (≥ 0.9) | 367 | 100.0% |
| Medium (0.7–0.89) | 105 | 99.0% |
| Low (0.5–0.69) | 51 | 94.1% |

Now that the main set includes forms the engine wasn't tuned on, the bands separate the way the
thresholds intend: high-confidence answers are always right, and low-confidence ones, which are
only filled when **Fill unknown fields** is on, are right 94% of the time.

## Performance

Median of several runs on generated forms, in a laptop's headless Chromium.

| Fields | Classify, Phase A | Classify, Phase B | Classify, Phase C | Full fill, Phase C | Target (classify) |
| --- | --- | --- | --- | --- | --- |
| 50 | 9.3 ms | 0.5 ms | 1.6 ms | 21.1 ms | < 50 ms |
| 100 | 16.7 ms | 1.8 ms | 4.2 ms | 36.4 ms | < 100 ms |
| 500 | 86.8 ms | 3.5 ms | 21.7 ms | 441.9 ms | < 200 ms |
| 1,000 | 156.6 ms | 6.7 ms | 46.2 ms | 1,504.7 ms | < 200 ms |

After the visibility fix, a full fill of 1,000 fields takes 0.3–0.6 s depending on machine load. In Phase D, classifying 1,000 fields takes about 70–100 ms, because it also measures which fields are visible so it can judge each form's type.

Phase B's speed-up comes from normalizing the aliases once instead of for every field. Before the visibility fix, filling
(not classifying) a 1,000-field form took about a second and a half, mostly because each value
written made the next visibility check recalculate styles.

## Known limits of these numbers

- Every fixture was written for this benchmark. Forms from real websites, added as regression
  fixtures when users report problems, will be a better test than anything written in advance.
- The held-out set is small. Rotate it into the main set once it has been tuned against, and
  write a fresh one.
