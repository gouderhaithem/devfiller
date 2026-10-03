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

### French and Arabic forms from the web

The UCI crawl has almost no French or Arabic forms (12 unused French websites), so 255 forms were
collected from 188 public French, Belgian, Swiss, Québécois, Algerian, Moroccan, Tunisian, Egyptian
and Gulf websites (`scripts/uci-sealed/crawl-forms.mjs`: home, contact, sign-up and job pages,
nothing typed or submitted, websites that turn automated browsers away skipped), labelled blind with
the same guide plus French and Arabic notes, and split by website: 157 training forms (117 French, 40
Arabic) and 98 sealed (69 French, 29 Arabic). Rule fixes were tuned on the training forms only: a
select named only by its prompt ("Choisir fonction", "اختر الخبرة"), experience and salary selects,
"mots clés", "gare de départ", "خبرتك", "راتبك المتوقع", and "الاسم" / "Name" as the whole name alone
but the first name beside a surname. The model was retrained with the training forms (920 rows).

| | Precision | Recall | F1 |
| --- | --- | --- | --- |
| French and Arabic training forms, rules, before | 89.4% | 77.2% | 82.8% |
| French and Arabic training forms, rules, after | 90.1% | 80.5% | 85.0% |
| **98 sealed French and Arabic forms, rules, before** | 86.5% | 80.2% | 83.2% |
| **98 sealed French and Arabic forms, rules, after** | 86.9% | 80.5% | **83.6%** |
| 98 sealed French and Arabic forms, rules + model, before | 86.5% | 81.3% | 83.8% |
| 98 sealed French and Arabic forms, rules + model, after | 87.2% | 82.2% | **84.6%** |

French and Arabic stay about 8 points below English (92–93% on the sealed English rounds): many of
these forms are search widgets, price sliders and custom pickers, and 98 forms make a noisy measure.
In English, round 4 moved from 91.4% to 91.2% with the retrained model (rules unchanged at 90.1%);
the benchmark gate shows no regressions. The sealed French and Arabic forms are now retired.

### A second collection of French and Arabic forms

481 more websites (French regional and professional sites, Senegal, Côte d'Ivoire, Cameroon and other
francophone African countries, Lebanon, the Maghreb, the Gulf, Egypt, Jordan and Iraq) gave 171
forms from 119 of them, labelled blind and split by website: 105 training forms (82 French, 23
Arabic) and 66 sealed (48 French, 18 Arabic, 498 fields). The model was retrained with both
collections' training forms (262 forms); the rules are unchanged.

| On the 66 sealed forms | Precision | Recall | F1 |
| --- | --- | --- | --- |
| Rules | 88.7% | 78.3% | 83.2% |
| Rules + model, before | 88.5% | 80.6% | 84.4% |
| **Rules + model, retrained** | **89.3%** | 80.6% | **84.7%** |

A small gain (three fewer wrong answers), and English round 4 is unchanged (91.2%). The model's
lever on French and Arabic is nearly spent: recall there is held back by the rules (78.3%), so the
next gains come from rule work on the training forms.

Rule work followed, tuned on both collections' 262 training forms only: French and Arabic topic
wording ("Thématique", "Motif de votre réclamation", "Votre demande concerne", "نوع الاقتراح",
"عنوان الرسالة"), customer, parcel, subscriber, contract and booking numbers, lists of calling codes
read as the country (a typed "Indicatif" box is left alone, since a country name there would be
rejected), activation codes as one-time codes, and a visible "Nom de famille" over name="Name". The
66 sealed forms, opened once for the model, were not looked at; measured again:

| | Rules | Rules + model |
| --- | --- | --- |
| French and Arabic training forms, before → after | 85.2% → 86.6% | 87.0% → 87.9% |
| **66 sealed forms, before → after** | **83.2% → 83.5%** | **84.7% → 84.9%** |
| English round 4, before → after | 90.1% → 90.2% | 91.2% → 91.2% |

Two of the first wordings broke benchmark fixtures and were taken out before the measurement: a bare
"Motif" (a medical appointment's reason isn't a message's topic) and "N° client" (which normalises to
"client", a company). The one sensitive field the training forms still filled, an activation code,
no longer is. This sealed set is now retired.

## Against other form fillers

`node scripts/model/run.mjs compare <out.json> <folders…>` runs DevFiller's shipped engine and other fillers' Chrome extensions on the same labelled pages,
served over local http with every other request blocked, and scores every tool the same way: by the
value it leaves in each field. A value that fits the field's label (a valid email, digits for a
phone, a real option in a select, a date, words of a name, and never lorem ipsum where a name, a
city, a company or a topic is asked) is right; any other value is wrong; an untouched field is
missed. Card, code and bank fields filled with anything but a test value are leaks. Each extension
is triggered the way its "fill the page" shortcut does it; Fake Filler, which works through the
active-tab permission a click grants, gets that page access from its manifest instead.

3 October 2026, on the 498 sealed pages of rounds 6 and 7 and the French and Arabic set (2,536
labelled fields; DevFiller was measured on them before, never tuned on them):

| | Right | Wrong | Missed | Sensitive fields leaked |
| --- | --- | --- | --- | --- |
| **DevFiller 1.1** (default settings) | **93.5%** | **1.9%** | 4.6% | **1** |
| DevFiller 1.1 with learned guesses | 93.5% | 1.4% | 5.1% | 1 |
| Fake Filler 4.1.0 (about 400,000 users) | 87.5% | 9.9% | 2.6% | 15 |
| Fake Data 4.10 | 68.3% | 11.1% | 20.6% | 14 |

| Right / wrong | Round 6 (English) | Round 7 (English) | French and Arabic |
| --- | --- | --- | --- |
| DevFiller | 95.1% / 0.9% | 95.4% / 2.2% | 86.5% / 3.4% |
| Fake Filler | 90.3% / 7.1% | 89.6% / 8.6% | 77.4% / 18.3% |
| Fake Data | 70.6% / 8.3% | 68.5% / 9.4% | 63.1% / 20.4% |

Fake Filler fills nearly every field and gets the common ones right; a field it doesn't recognise
gets lorem ipsum ("Dolor facilis totam" as a first name, "Sapiente porro odit" as a phone). Its
leaks are random values in card, code and bank fields. DevFiller's one leak is a Chinese
verification code. The labels follow this guide, which shares DevFiller's types; scoring the values
rather than the types keeps that from favouring it, but the value checks test a value's shape, not
its meaning.

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

Since 3 October 2026 the extension turns learned guesses on by default: on the sealed real forms the rules have caught up enough that the model no longer costs precision (round 6: 95.0% with and without it; French and Arabic: 86.9% → 87.2%), and in the filler comparison below it leaves fewer wrong values (1.9% → 1.4% of fields). The engine's API, and so this benchmark's baseline, still asks for it explicitly.

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
