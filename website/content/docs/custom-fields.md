Custom fields give a field an exact value every time, for example `Project code` → `PRJ-001` or `Coupon` → `TEST10`.

## Add a rule

1. Open **Options → Custom fields**.
2. Click **Add custom field**.
3. Enter the field's **label** and the **test value**.

The rule matches a field whose label, accessible name, name, ID or placeholder is exactly that text. Case, accents and punctuation don't matter. The value is inserted exactly as you typed it.

## Rules from the side panel

Rules you save from the [side panel](/docs/side-panel/) target one specific field on one website, using a CSS selector. They take priority over label rules and over the page's autocomplete hints. They appear in the same list, where you can edit or delete them.

## Which rule wins

1. A side panel rule for that exact field on this website
2. The field's standard `autocomplete` attribute
3. A custom label rule
4. DevFiller's built-in field types

A custom value is the same on every click. If it doesn't fit the field (for example, text in a number field), the field is reported as incompatible instead of filled.
