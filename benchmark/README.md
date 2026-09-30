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

## The gate

A run fails when a sensitive field is filled, a form is submitted, a network request is made,
or, compared with `baseline.json`, overall precision or recall drops, any type's precision or
recall drops, or fewer spelling variants are right. Update the baseline only for a change you
mean to accept, and say why in the commit.

## Adding a fixture

The quickest way to add a real form: open it, open the DevFiller side panel and click **Export as
test fixture**. The file keeps the form's structure and labels, never the values people typed, and
labels each control with DevFiller's answer (or the type you set with **This field is**). Check
every `data-expect` against the page, correct it, and save it in `fixtures/regressions/`.

Every reported bug becomes a fixture in `fixtures/regressions/` before it's fixed. Label the
truth a person would give, not what the engine does: see the [labelling guide](fixtures/README.md).
