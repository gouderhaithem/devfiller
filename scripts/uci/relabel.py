#!/usr/bin/env python3
'''Labels each field group of forms.jsonl with the UCI PI type classifier, into labelled.jsonl.

The dataset only stores a form-level list of PI types, without saying which field has which. Their
classifier (SetFit on bge-small, in classifier-pi-type.tar.zst) is run again on every group's text,
which gives each group its own labels and probabilities. Joined in order, a form's group labels
should be the list the dataset stored; the share that match is printed as a check.

  python scripts/uci/relabel.py                     # reads and writes in $UCI_DIR
'''

import argparse
import json
import os
import shutil
import subprocess
import sys
import warnings
from pathlib import Path

UCI_DIR = Path(os.environ.get('UCI_DIR', Path.home() / 'datasets/uci-webform'))
ZIP = Path(os.environ.get('UCI_ZIP', Path.home() / 'Downloads/dataset-formfiller.zip'))
# Probabilities kept in the output for the report, beyond the labels themselves.
KEEP_PROBABILITY = 0.05


def unpack_model(model_dir: Path):
    if (model_dir / 'model_head.pkl').exists():
        return
    print(f'unpacking the PI type classifier into {model_dir}', file=sys.stderr)
    # Unpacked beside it first, so an interrupted run never leaves half a model behind.
    partial = model_dir.with_name(model_dir.name + '.partial')
    shutil.rmtree(partial, ignore_errors=True)
    partial.mkdir(parents=True)
    unzip = subprocess.Popen(['unzip', '-p', str(ZIP), 'classifier-pi-type.tar.zst'], stdout=subprocess.PIPE)
    zstd = subprocess.Popen(['zstd', '-dc'], stdin=unzip.stdout, stdout=subprocess.PIPE)
    unzip.stdout.close()
    subprocess.run(['tar', 'x', '-C', str(partial)], stdin=zstd.stdout, check=True)
    if any((zstd.wait(), unzip.wait())):
        raise SystemExit(f'could not read classifier-pi-type.tar.zst from {ZIP}')
    shutil.rmtree(model_dir, ignore_errors=True)
    partial.rename(model_dir)


def classify(texts, model_dir: Path, batch_size: int):
    warnings.filterwarnings('ignore')
    from setfit import SetFitModel  # pylint: disable=import-outside-toplevel
    model = SetFitModel.from_pretrained(str(model_dir))
    results = {}
    for start in range(0, len(texts), batch_size * 16):
        chunk = texts[start:start + batch_size * 16]
        # One probability pair per label: [no, yes].
        probabilities = model.predict_proba(chunk, batch_size=batch_size)[:, :, 1].tolist()
        for text, row in zip(chunk, probabilities):
            results[text] = {label: round(p, 4) for label, p in zip(model.labels, row) if p >= KEEP_PROBABILITY}
        print(f'{min(start + len(chunk), len(texts))}/{len(texts)} field groups', file=sys.stderr, flush=True)
    return results


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--forms', type=Path, default=UCI_DIR / 'forms.jsonl')
    parser.add_argument('--out', type=Path, default=UCI_DIR / 'labelled.jsonl')
    parser.add_argument('--model', type=Path, default=UCI_DIR / 'classifier-pi-type')
    parser.add_argument('--batch-size', type=int, default=64)
    args = parser.parse_args()

    unpack_model(args.model)
    with open(args.forms, encoding='utf-8') as fin:
        forms = [json.loads(line) for line in fin]
    texts = sorted({group['text'] for form in forms for group in form['groups'] if group['text']})
    probabilities = classify(texts, args.model, args.batch_size)

    matched = 0
    with open(args.out, 'w', encoding='utf-8') as out:
        for form in forms:
            joined = []
            for group in form['groups']:
                group['probabilities'] = probabilities.get(group['text'], {})
                # The classifier's own decision: each label's output says yes past one half.
                group['labels'] = [label for label, p in group['probabilities'].items() if p > 0.5]
                joined.extend(group['labels'])
            matched += joined == form['stored']
            out.write(json.dumps(form, ensure_ascii=False) + '\n')
    share = matched / len(forms) if forms else 0
    print(f'{len(forms)} forms, {len(texts)} distinct field groups; labels reproduce the stored list for {share:.1%} of forms', file=sys.stderr)


if __name__ == '__main__':
    main()
