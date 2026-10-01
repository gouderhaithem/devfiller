#!/usr/bin/env python3
'''Samples real-world forms from the UCI web form dataset (dataset-formfiller.zip) into forms.jsonl.

The raw crawl is 287 GiB once unpacked, so it is streamed once and never written to disk. Only
English pages are kept (their labels exist for English only), and each site gives at most
--per-domain distinct forms, the same ones on every run (those of smallest salted hash). A form
already kept for another site is passed over, so each distinct form appears once in the sample. Each row holds the form's HTML, its fields, the classifier text of each field
group and the labels the dataset stored for the form.

  python scripts/uci/sample.py                      # writes $UCI_DIR/forms.jsonl
  python scripts/uci/sample.py --max-domains 200    # a quick run on the first 200 sites
'''

import argparse
import bisect
import hashlib
import json
import os
import sqlite3
import subprocess
import sys
import tarfile
from pathlib import Path

from field_string import group_fields, process_form

UCI_DIR = Path(os.environ.get('UCI_DIR', Path.home() / 'datasets/uci-webform'))
ZIP = Path(os.environ.get('UCI_ZIP', Path.home() / 'Downloads/dataset-formfiller.zip'))
CRAWL = 'crawl-merged-core.tar.zst'
# Forms past this size are page wrappers or builders, not forms a user fills.
MAX_FORM_HTML = 200_000


def unpack_db(db: Path):
    if db.exists():
        return
    print(f'unpacking webform-data.db into {db.parent}', file=sys.stderr)
    # Unpacked under another name first, so an interrupted run never leaves a cut database behind.
    partial = db.with_suffix('.partial')
    with open(partial, 'wb') as out:
        unzip = subprocess.Popen(['unzip', '-p', str(ZIP), 'webform-data.db.zst'], stdout=subprocess.PIPE)
        subprocess.run(['zstd', '-dc'], stdin=unzip.stdout, stdout=out, check=True)
        if unzip.wait():
            raise SystemExit(f'could not read webform-data.db.zst from {ZIP}')
    partial.replace(db)


def load_labels(db: Path):
    con = sqlite3.connect(db)
    english = {job for job, in con.execute("SELECT job_hash FROM page_language WHERE lang_code IN ('en', 'guess:en')")}
    stored = {(job, form): json.loads(labels) for job, form, labels in con.execute('SELECT job_hash, form_filename, field_list FROM field_classification')}
    form_types = {(job, form): kind for job, form, kind in con.execute('SELECT job_hash, form_filename, form_type FROM form_classification')}
    con.close()
    return english, stored, form_types


def field_row(field):
    element = field.get('fieldElement') or {}
    label = field.get('labelElement') or {}
    previous = field.get('previousElement') or {}
    return {
        'name': field.get('name'),
        'tag': element.get('tagName'),
        'html': element.get('outerHTML', ''),
        'visible': bool(element.get('isVisible')),
        'label': (label.get('text') or '').strip(),
        'previous': (previous.get('text') or '').strip()[:300],
    }


def form_row(domain, job, filename, form, stored, form_types):
    fields = form.get('fields') or []
    html = (form.get('element') or {}).get('outerHTML', '')
    if not fields or not html or len(html) > MAX_FORM_HTML:
        return None
    texts = list(process_form(form))
    index = {id(field): i for i, field in enumerate(fields)}
    groups = [{'name': name, 'text': text, 'fields': [index[id(field)] for field in members]}
              for (name, members), text in zip(group_fields(form), texts)]
    return {
        'domain': domain, 'job': job, 'form': filename,
        'formType': form_types.get((job, filename)),
        'stored': stored.get((job, filename), []),
        'html': html,
        'fields': [field_row(field) for field in fields],
        'groups': groups,
    }


def crawl_members():
    '''Streams the crawl tar out of the zip: unzip and zstd run alongside the parser.'''
    unzip = subprocess.Popen(['unzip', '-p', str(ZIP), CRAWL], stdout=subprocess.PIPE)
    zstd = subprocess.Popen(['zstd', '-dc'], stdin=unzip.stdout, stdout=subprocess.PIPE)
    unzip.stdout.close()
    finished = False
    try:
        with tarfile.open(fileobj=zstd.stdout, mode='r|') as tar:
            for member in tar:
                parts = member.name.split('/')
                # Hard links repeat a form already seen on another page of the site.
                if member.isfile() and len(parts) == 3 and parts[2].startswith('form-') and parts[2].endswith('.json'):
                    yield parts, tar.extractfile(member)
                else:
                    yield parts, None
        finished = True
    finally:
        # tarfile stops at the end-of-archive marker: read the padding after it, so zstd ends on
        # its own instead of on a closed pipe.
        if finished:
            while zstd.stdout.read(1 << 20):
                pass
        zstd.stdout.close()
        if not finished:
            zstd.terminate()
            unzip.terminate()
        # A tar cut short by a failed unzip or zstd can still end cleanly: check them.
        codes = zstd.wait(), unzip.wait()
        if finished and any(codes):
            raise SystemExit(f'reading {CRAWL} from {ZIP} failed (unzip {unzip.returncode}, zstd {zstd.returncode})')


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--out', type=Path, default=UCI_DIR / 'forms.jsonl')
    parser.add_argument('--per-domain', type=int, default=3, help='forms kept per site')
    parser.add_argument('--max-domains', type=int, help='stop after this many sites')
    parser.add_argument('--salt', default='devfiller-uci-1', help='changes which forms are chosen')
    args = parser.parse_args()

    db = UCI_DIR / 'webform-data.db'
    UCI_DIR.mkdir(parents=True, exist_ok=True)
    unpack_db(db)
    english, stored, form_types = load_labels(db)

    # Each site's best few candidates, by salted hash: a few spares stand in for forms another
    # site already gave, and nothing more of a site is held in memory.
    spares = args.per_domain * 4
    kept, written = set(), {}
    stats = {'forms': 0, 'english': 0, 'duplicates': 0, 'kept': 0, 'domains': 0, 'bad': 0, 'reappeared': 0}
    current, picks, signatures = None, [], set()
    tmp = args.out.with_suffix('.partial')

    with open(tmp, 'w', encoding='utf-8') as out:
        def flush():
            for _, signature, row in picks:
                if written.get(current, 0) >= args.per_domain:
                    break
                if signature in kept:
                    continue
                kept.add(signature)
                written[current] = written.get(current, 0) + 1
                out.write(json.dumps(row, ensure_ascii=False) + '\n')
                stats['kept'] += 1

        for parts, stream in crawl_members():
            domain = parts[0]
            if domain != current:
                flush()
                picks, signatures = [], set()
                current = domain
                if domain in written:
                    stats['reappeared'] += 1
                else:
                    stats['domains'] += 1
                    if stats['domains'] % 500 == 0:
                        print(stats, file=sys.stderr, flush=True)
                if args.max_domains and stats['domains'] > args.max_domains:
                    break
                written.setdefault(domain, 0)
            if stream is None:
                continue
            stats['forms'] += 1
            _, job, filename = parts
            if job not in english:
                continue
            stats['english'] += 1
            try:
                row = form_row(domain, job, filename, json.load(stream), stored, form_types)
            except (ValueError, KeyError, TypeError, AttributeError):
                stats['bad'] += 1
                continue
            if row is None:
                continue
            signature = hashlib.sha1('\0'.join(group['text'] for group in row['groups']).encode()).hexdigest()
            if signature in signatures:
                stats['duplicates'] += 1
                continue
            signatures.add(signature)
            rank = hashlib.sha1((args.salt + signature).encode()).hexdigest()
            if len(picks) < spares or rank < picks[-1][0]:
                bisect.insort(picks, (rank, signature, row), key=lambda pick: pick[0])
                del picks[spares:]
        else:
            flush()

    tmp.replace(args.out)
    print('done', stats, '->', args.out, file=sys.stderr)


if __name__ == '__main__':
    main()
