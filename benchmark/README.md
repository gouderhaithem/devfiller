# Fill engine benchmark

Measures how accurately the fill engine recognizes fields, and proves it never fills a
sensitive field. It runs the engine bundle in real Chromium against the forms in
[`fixtures/`](fixtures/README.md), where every control declares its expected type.

```sh
npm run benchmark                       # run, print the report, fail on any regression
BENCHMARK_UPDATE=1 npm run benchmark    # accept the current numbers as the new baseline
```

The full report is written to `benchmark/results/latest.md`, and every wrong answer with the
control's markup to `benchmark/results/latest.json`.

## What it measures

- **Classification**, per type and overall: precision, recall, F1, the unknown rate, the
  false-positive rate (fields that expect `unknown` but got a type) and the wrong-type rate.
  The engine's `classify` mode supplies the answers.
- **Sensitive-field leaks**: each fixture is filled twice, with the default settings and with
  every optional filler on (passwords, search and header fields). A `skip:*` field whose value
  or checked state changes is a leak.
- **Safety**: form submissions (events, `submit()` and `requestSubmit()`) and network requests
  during the run. Both must stay at zero.
- **Spelling variants**: each phrase in [`variants.ts`](variants.ts) is written as
  `phone_number`, `phoneNumber`, `PHONE_NUMBER`, `phonenumber` and so on, and used as the only
  signal on a bare input.
- **Performance**: classify and full-fill time on generated 50 to 1,000 field forms, against the
  roadmap targets. Reported, not gated, because CI machines vary.

## Measuring without fooling ourselves

Every fix is tuned on the forms that exposed it, so those forms stop being a fair test the moment
they're fixed. The first Form Lab round showed it: 78% → 90% on the pages it was tuned on, and no
change on 30 new pages. So:

- **Keep a sealed set.** Write new held-out forms before a round of fixes starts, and don't open
  them or their results until the fixes are done. Report the sealed number first.
- **Retire a set once it has been tuned on.** It becomes regression fixtures; write a fresh sealed
  set for the next round.
- **Fix mechanisms, not labels.** A fix names the rule that was wrong ("a date input with no words
  is a date") and holds for forms nobody has written yet. Adding a page's exact wording as an alias
  only raises that page's score.
- **Check what got worse, not only what got better.** Compare field by field against the previous
  engine on the sealed set; a regression there is a bug in the fix, fixed and disclosed.
- **Label blind.** Whoever labels a form never sees the engine's answers.

## Sealed results

Round of 1 October 2026: sealed Form Lab pages 76–90 (15 pages, 458 labelled fields), written blind
before any tuning, opened once with the finished engine.

| Engine | Precision | Recall | F1 |
| --- | --- | --- | --- |
| main at 03e7772 (start of the round) | 90.3% | 78.0% | 83.7% |
| Rules after the round's fixes | 91.0% | 78.8% | 84.5% |
| Rules + second-opinion model v1 | 91.2% | 87.5% | **89.3%** |

The model fixed 30 fields and broke 2 (a licence number read as a reference, an ethnicity dropdown
read as a city). One consent checkbox ("Allow support staff to sign in to my account") was filled by
every engine, including main; permission wording ("allow", "grant access") now counts as consent,
fixed after the sealed measurement. Pages 76–90 are now retired: the next round needs a new sealed
set before any tuning.

Real-world sealed set, same day: 200 forms from 200 websites of the UCI web form crawl
(Cui et al., PoPETs 2025), 2,317 fields labelled blind with this guide, kept outside the repository
under the dataset's licence (`scripts/uci-sealed/`, `npm run model:evaluate`).

| Engine (e69aa23) | Precision | Recall | F1 | Consent fields filled |
| --- | --- | --- | --- | --- |
| Rules | 87.1% | 79.5% | 83.1% | 21 |
| Rules + model v1 | 85.3% | 82.3% | 83.8% | 21 |

The model's wrong answers were mostly guesses on fields that should stay unknown (captcha responses,
"last 4 of SSN", school names), which synthetic pages never taught it. Consent fixes found on these
forms then brought the rules to 83.7% F1 and 8 filled consent fields (all mailing-list or
declaration choices whose page uses no consent wording). This set is now retired.

## Real-world comparison

1 October 2026: 30,956 English forms from the 11,500 sites of the UCI web form crawl, compared field
by field with their PI type classifier (`scripts/uci`, see its README). Their labels are a model's,
so disagreements were reviewed by hand. Three were engine bugs, fixed with
`fixtures/regressions/r09-real-world-uci-crawl.html`:

| Bug | Fields before | After |
| --- | --- | --- |
| A postal code on `type="tel"` read as a phone | 133 | 6 |
| `autocomplete="new-password"` on a text field (a form builder turning autofill off) read as a password | 149 | 18 |
| The second opinion naming a thing's name ("Facility Name", "OS Name") a person's full name | 246 | 169 |

Agreement on comparable fields went from 91.4% to 91.7%. Most of the remaining 169 are person names
their classifier missed. Training the model on their labels didn't help: every variant scored below
the current model on the validation pages (88.3–88.8% F1 against 89.0%), since 93% of the rows are
fields the rules already get right and their data has no "unknown" examples.

On the retired real-world set above, against main at 6872a90: rules 83.7% → 83.8% F1, rules + model
84.4% → 84.6% (precision 85.4% → 85.6%; the model's harmful changes 24 → 21). Seven fields fixed
(four postal codes on `type="tel"`, a group name and a school name no longer read as people, a
"last 4 of SSN" no longer read as a last name); two got worse, both select2 dropdown search boxes now
read as search, which the default "skip search fields" leaves empty. The same set showed Gravity
Forms honeypots (`autocomplete="new-password"`, labelled "Name" or "Email", hidden by the form
builder's stylesheet), now treated as traps from their markup, and an identity number the model
read as a phone: the model no longer guesses on fields whose own words name an ID number.

### Second real-world round: 1,200 more forms

1,200 more forms from 1,200 other websites of the same crawl (`scripts/uci-sealed/sample-round.mjs`),
labelled blind with this guide and `scripts/uci-sealed/label.mjs`, then checked against the settled
cases (`scripts/uci-sealed/consistency.mjs`): 998 forms (13,767 fields) became training data with
the first real-world set, and 202 forms (2,291 fields, no website shared with training) were sealed
and opened once. The real-form rows stay outside the repository, in `~/datasets/uci-webform/model/`.

| On the 202 sealed real forms | Precision | Recall | F1 | Better / worse than rules |
| --- | --- | --- | --- | --- |
| Rules alone | 88.0% | 82.2% | 85.0% | |
| Rules + model v1 (no real forms in training) | 86.8% | 85.2% | 86.0% | 49 / 15 |
| **Rules + model v2 (real forms in training, 150 KB)** | **88.7%** | 84.9% | **86.8%** | 43 / 5 |

The model now beats the rules on precision on real forms as well as on recall. A 287 KB model scored
87.2% (precision 88.9%, 54 better and 3 worse) but would break the 150 KB budget; the size was chosen
on validation pages, never on the sealed set. Learned guesses stay off by default: the +1.8 points
are short of the +3 the plan set for switching them on.

18 sensitive fields are filled on these forms by every engine: Stripe's hidden one-character helper
inputs, consent radios and checkboxes worded unusually ("show my name", "keep my gift anonymous",
supporter questions) and an email verification code. That is rule work for the next round.

### Third real-world round: 200 fresh sealed forms

Rule work tuned on the 998 training forms only: sign-up lists and consent wording, interest options
and plain first-person answers no longer read as consent, donation and price choices read as an
amount, a contact form's one unlabelled text area read as its message. The model was then retrained
on the same data. 200 forms from 200 websites no earlier round used (2,389 fields; same tools, same
guide) were labelled blind and opened once, against `main` before this work:

| On the 200 sealed real forms | Precision | Recall | F1 | Sensitive fields filled |
| --- | --- | --- | --- | --- |
| `main`, rules alone | 89.6% | 84.2% | 86.8% | 20 |
| `main`, rules + model | 89.5% | 86.5% | 88.0% | 20 |
| **This round, rules alone** | **90.8%** | 87.4% | **89.1%** | 23 |
| **This round, rules + model** | 90.4% | 89.9% | **90.1%** | 23 |

The 3 extra sensitive fields were a regression of the narrower declaration rule: promises to pay or
give ("I choose to pay the fees", "I want to contribute this amount every month", "I do not wish to
be publicly recognized"). Fixed after the measurement and disclosed: 20 again (89.2% / 90.2% F1).
The 20 left, on `main` too, are mostly contact-channel checkboxes ("by email", "by SMS"), investor
alert lists and two verification-code boxes: rule work for the next round. The model adds +1.0 F1
over the rules here, short of the +3 for switching learned guesses on by default. This set is now
retired.

### Fourth and fifth real-world rounds: more training forms

Two training rounds from websites no earlier round used, labelled blind with the same guide and
checked against the settled cases (`consistency.mjs`): round 4, 1,000 forms (10,071 fields) drawn
like round 2, mostly contact and sign-up forms; round 5, 1,257 forms (20,900 fields) drawn by
`scripts/uci-sealed/sample-rare.mjs`, the forms that ask for the types with the fewest rows
(ratings, colours, gender, industry, company size, start and end dates, middle names…). Two settled
cases were added to the guide and applied to every round, both sealed sets included: a checkbox that
adds to a payment (cover the fee, make it monthly) is `skip:consent`, and a topic picked from a list
is `subject` (183 labels changed, 7 of them on the third round's sealed forms). The engine's rules
are unchanged. On the third round's sealed forms, relabelled, with the model retrained on each mix:

| On the 200 third-round forms | Precision | Recall | F1 | Missed | Wrong |
| --- | --- | --- | --- | --- | --- |
| Rules alone | 90.9% | 87.3% | 89.1% | 156 | 140 |
| Rules + model, rounds 1–2 (before) | 90.8% | 90.0% | 90.4% | 112 | 147 |
| Rules + model, + rounds 4 and 5 | 90.3% | 90.5% | 90.4% | 102 | 156 |
| Rules + model, + round 4 | 90.9% | 88.8% | 89.9% | 132 | 142 |
| **Rules + model, + round 5 (kept)** | **90.8%** | **90.9%** | **90.9%** | 101 | 147 |

Round 4 made the model hold back, so it stays labelled but out of the training data. The third
round's set was already retired and the mix was chosen on it, so round 4 was then used as the clean
measurement: same draw as the third round's sealed forms, labelled blind, never trained on, never used
to choose anything.

| On round 4's 1,000 forms (10,071 fields) | Precision | Recall | F1 | Missed | Wrong |
| --- | --- | --- | --- | --- | --- |
| Rules alone | 91.2% | 86.9% | 89.0% | 701 | 626 |
| Rules + model, rounds 1–2 (before) | 91.6% | 89.8% | 90.7% | 522 | 617 |
| Rules + model, + round 5 (kept) | 91.3% | 90.1% | 90.7% | 495 | 638 |

The +0.5 did not hold: on clean forms the two models tie. The new one fills 27 more fields and gets 21
more wrong (62 fields newly right, mostly topic lists read as `subject`; 56 newly wrong, mostly other
lists read as `subject` and birth dates read as plain dates). Twice the real-form rows bought no F1, so
the model is near what its features allow: the next gains are rule work (495 fields missed, 13
sensitive fields filled) or new features, not more forms of the same crawl. Round 4 is now retired.

### Sixth real-world round: rule work on round 4, measured on 200 sealed forms

200 forms from websites no earlier round used were drawn and labelled blind before any fix (round 6;
the crawl's rich forms are used up, so these are mostly contact and sign-up forms). The rules were
then fixed against round 4's mistakes only: one-time codes worded "Validation code", "Temporary
code", "Reset code" or a bare "Enter code", and a row of code boxes with one two-character box; a
message's question on a select or radios ("How can we help?") and topic wording read as `subject`;
day/month/year selects of a birth date; WPForms and Gravity Forms name parts; a lead form's "Title"
as a job title. The evaluator counted every untouched sensitive select as filled (`undefined`
against `false`): fixed, and both sides below are scored with the fixed evaluator.

| | Precision | Recall | F1 | Sensitive fields filled |
| --- | --- | --- | --- | --- |
| Round 4 (tuned on), rules, before | 91.2% | 86.9% | 89.0% | 13 |
| Round 4 (tuned on), rules, after | 91.2% | 88.5% | 89.9% | 0 |
| **Round 6 (sealed), rules, before** | 94.9% | 88.9% | 91.8% | 1 |
| **Round 6 (sealed), rules, after** | **95.0%** | **90.4%** | **92.7%** | 1 |
| Round 6 (sealed), rules + model, before | 94.9% | 91.4% | 93.1% | 1 |
| Round 6 (sealed), rules + model, after | 95.0% | 92.5% | 93.8% | 1 |

The gain held on the sealed forms: +0.9 F1 for the rules, +0.7 with the model, precision unchanged.
The one sensitive field filled is a Chinese "验证码" (verification code): the engine reads English,
French and Arabic only. Round 6 is now retired.

### Seventh real-world round: two more fixes, and a second sealed check

200 more forms (round 7, mostly short contact, sign-up and log-in forms) were labelled blind before
two more fixes tuned on round 4: a support form's one text area called "Description" or "Details" is
its message (settled in the guide), and fields named as a later address line (address2, street2,
address_3, autocomplete="address-line3") are address line 2. Round 4, rules alone: F1 89.9% → 90.0%.

| On round 7's 200 sealed forms (1,379 fields) | Precision | Recall | F1 |
| --- | --- | --- | --- |
| Rules, before the sixth round | 94.2% | 89.7% | 91.9% |
| Rules, after the sixth round | 94.3% | 90.4% | 92.3% |
| **Rules, after this round** | 94.3% | 90.4% | **92.3%** |
| Rules + model, before the sixth round | 94.0% | 92.0% | 93.0% |
| **Rules + model, after this round** | 94.1% | 92.2% | **93.2%** |

The sixth round's fixes hold on a second sealed set (+0.4 F1); this round's two fixes change nothing
here, since these forms have no such fields. Round 7 is now retired.

## The gate

A run fails when a sensitive field is filled, a form is submitted, a network request is made,
or, compared with `baseline.json`, overall precision or recall drops, any type's precision or
recall drops, or fewer spelling variants are right. Update the baseline only for a change you
mean to accept, and say why in the commit.

The second-opinion model ([MODEL.md](MODEL.md)) answers more fields, so a few of its answers can
move a type's precision. Such a change is accepted only when every field it changed is listed and
reviewed below, overall precision drops by at most 0.5 point, and leaks, submissions and form types
stay where they were. Most fixtures are in the model's training data, so the benchmark guards
against harm; the sealed Form Lab set measures the gain.

Since 1 October 2026 the model is off by default (the "Learned guesses" setting): on 200 hand-labelled
real forms it added only 0.7 F1 and cost 1.8 points of precision, so the baseline is the rules alone
again. The reviews below apply when it is switched on.

Reviewed model changes (model v1, 1 October 2026; rules alone 41 mistakes, with the model 21):

| Fixture | Label | Model | Why it's accepted |
| --- | --- | --- | --- |
| `06-flight-booking` `dest` | unknown | city | "City or airport": the rules abstain on either-fields; a city is a valid answer |
| `37-fr-commande-charpente` `reperes[0][nom]` | unknown | lastName | The name of a marked part read as a person's; harmless sample text in a free field |
| `h06-declaration-fiscale` `f_20` | email | address | Unlabelled field the rules reached only from its neighbour, at 0.69; a known weakness to fix with more data |

## Adding a fixture

The quickest way to add a real form: open it, open the DevFiller side panel and click **Export as
test fixture**. The file keeps the form's structure and labels, never the values people typed, and
labels each control with DevFiller's answer (or the type you set with **This field is**). Check
every `data-expect` against the page, correct it, and save it in `fixtures/regressions/`.

Every reported bug becomes a fixture in `fixtures/regressions/` before it's fixed. Label the
truth a person would give, not what the engine does: see the [labelling guide](fixtures/README.md).
