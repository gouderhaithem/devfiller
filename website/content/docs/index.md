DevFiller is a browser extension for developers and testers. Open a page with a form, click the DevFiller icon, and every field it recognizes gets realistic, fictional test data. It never submits the form: you check the values and submit when you're ready.

## How a fill works

1. DevFiller reads the form on the page you're looking at. It only runs when you click, and only on that tab.
2. Each field is matched to one of [43 field types](/docs/field-types/) by its autocomplete attribute, label, name, ID or placeholder, in English, French or Arabic.
3. A matching value is generated locally. The username and email follow the generated name, numbers and dates stay within the field's limits, and dropdowns get a real option.
4. Fields that should stay manual are skipped: passwords (unless you turn them on), payment fields, one-time codes, consent boxes and file uploads.
5. The toolbar icon shows how many fields were filled. Hover over it for details, or open the [side panel](/docs/side-panel/) to see every field.

Click again to get a different identity and new values.

## What you can adjust

- [Generated data](/docs/generated-data/): the data language, and whether to replace existing values, fill unknown fields, or generate test passwords.
- [Custom fields](/docs/custom-fields/): exact values for your own labels, such as `Project code` → `PRJ-001`.
- [Excluded fields](/docs/excluded-fields/): fields that must stay untouched, on every site or just one.
- [AI suggestions](/docs/ai/): optional Groq or Gemini suggestions for fields the local generator doesn't recognize, using your own key.

## Privacy in one sentence

Everything runs in your browser and nothing is sent anywhere, unless you turn on AI, which sends field descriptions (never the values you type) to the provider you chose. Details are in [Privacy and permissions](/docs/privacy-permissions/).
