Excluded fields keep their current value. DevFiller doesn't fill them, doesn't send any events to them, and leaves them out of AI requests.

## Skipped by default

Two protections are on by default in **Options → Excluded fields**:

- **Skip search fields**: search inputs and search labels in English, French and Arabic.
- **Skip headers and navigation**: inputs and dropdowns inside page headers and navigation areas, such as language or store pickers.

## Add your own exclusions

| Match by | Example | What it excludes |
| --- | --- | --- |
| Label, name, ID or placeholder | `Language` | Fields with exactly that text. Case, accents, punctuation and Arabic diacritics don't matter. |
| CSS selector for a field | `#site-search` | The matching fields. |
| CSS selector for a container | `.header-filters` | Every field inside it. |

Add a **website** such as `example.com` to apply the rule only there and on its subdomains. Leave it blank to apply it everywhere.

Excluding one radio button protects its whole group. Changes save automatically and clear any cached AI suggestions.
