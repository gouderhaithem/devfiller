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



Typed answers on the main fixtures, by confidence band. Sensitive skips and unknowns are left out.

| Band | Answers | Precision |
| --- | --- | --- |
| High (≥ 0.9) | 225 | 100.0% |
| Medium (0.7–0.89) | 60 | 100.0% |
| Low (0.5–0.69) | 15 | 100.0% |

The main fixtures can't separate the bands, since every answer is right. The thresholds stay at
the roadmap's starting values until real-world fixtures give the low band something to measure.

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
