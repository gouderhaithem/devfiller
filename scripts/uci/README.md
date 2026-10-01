# UCI web form dataset: extractor and disagreement report

Compares the engine with the PI type classifier of the UCI web form study ("Understanding Privacy
Norms through Web Forms", PoPETs 2025; [code](https://github.com/UCI-Networking-Group/webform)) on
real-world forms from 11,500 popular sites. The point is to find real fields the engine reads
differently, review them, and turn the right ones into fixtures. It is not a training set: their
labels are a model's (about 94% micro-F1 on their validation set) and cover 19 kinds of personal
information, not our 48 types.

Everything is read from the released `dataset-formfiller.zip` and written to `$UCI_DIR`
(default `~/datasets/uci-webform`), never into the repository. The raw crawl is 287 GiB once
unpacked, so it is streamed, never extracted.

## Setup

```console
$ uv venv ~/datasets/uci-webform/.venv
$ uv pip install -p ~/datasets/uci-webform/.venv --index-url https://download.pytorch.org/whl/cpu torch
$ uv pip install -p ~/datasets/uci-webform/.venv -r scripts/uci/requirements.txt
```

`UCI_ZIP` points at the zip (default `~/Downloads/dataset-formfiller.zip`).

## Steps

| Step | Command | Writes |
| --- | --- | --- |
| Sample English forms, at most 3 per site, each distinct form once | `cd scripts/uci && $PY sample.py` | `forms.jsonl` |
| Label each field group with their classifier | `cd scripts/uci && $PY relabel.py` | `labelled.jsonl` |
| Run the engine on each form in Chromium | `node scripts/uci/run.mjs engine` | `engine.jsonl` |
| Compare | `node scripts/uci/run.mjs report` | `report.md`, `disagreements.jsonl` |
| Training rows for the second-opinion model | `node scripts/uci/run.mjs training` | `uci-train.jsonl` |

`$PY` is `~/datasets/uci-webform/.venv/bin/python`. `sample.py --max-domains 200` makes a quick run.

The dataset stores one list of PI types per form, without saying which field has which; `relabel.py`
reruns their classifier on each field group (fields sharing a name, as they grouped them), and checks
that the joined labels give back the stored list. `field_string.py` is their field text, ported
unchanged, since the classifier was trained on exactly that text.

## Training on it

`training` keeps only labels their classifier was sure of (p ≥ 0.75; its probabilities run low),
one per single visible field. A label naming one of our types (email, phone…) is used as is; a
broad one (a person's name, a place, business details) only through an engine answer it covers.
Fields with no PI label are never used, since no PI is not "unknown" to us. Each type keeps at most
800 distinct rows (`UCI_PER_TYPE`). Then:

```console
$ EXTRA=~/datasets/uci-webform/uci-train.jsonl npm run train
```

`train.ts` adds these rows to every training set, unreworded and weighing `EXTRA_WEIGHT` (0.3) of a
field each, and never validates on them: the validation pages and the sealed set stay hand-labelled,
so the model card says whether they helped.

## Notes

The engine is whatever this checkout's `src/fill` is. Fields are compared as the crawler saw them on
screen; how their labels map to our types is in `map.ts`.
