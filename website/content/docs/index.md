DevFiller is a browser extension for developers and testers. Open a page with a form, click the DevFiller icon, and every field it recognizes gets realistic, fictional test data. It never submits the form: you check the values and submit when you're ready.

## How a fill works

1. DevFiller reads the form on the page you're looking at. It only runs when you click, and only on that tab.
2. It works out what each field is from every clue the page gives, such as the label, name, placeholder, autocomplete attribute, units and the answers a list offers, in English, French or Arabic. Each field gets one of [46 field types](/docs/field-types/) and a confidence, or stays unknown when the clues aren't strong enough. [How recognition works](/docs/how-it-works/) explains the details.
3. A matching value is generated locally. The username and email follow the generated name, places and phone numbers come from one country, numbers and dates fit the field's limits, and confirmation fields repeat what they confirm.
4. Fields that must stay yours are skipped: passwords (unless you turn them on), card and bank details, one-time codes, consent boxes and file uploads.
5. If the site rejects a value, DevFiller tries another way of writing it. The toolbar icon shows how many fields were filled; open the [side panel](/docs/side-panel/) to see every field and why.

Click again to get a different identity and new values.

## What you can adjust

- [Generated data](/docs/generated-data/): the data language, the country for addresses and phones, repeatable data with a seed, and whether to replace existing values, fill unknown fields, or generate test passwords.
- [Custom fields](/docs/custom-fields/): exact values for your own labels, such as `Project code` → `PRJ-001`.
- [Excluded fields](/docs/excluded-fields/): fields that must stay untouched, on every site or just one.
- [AI suggestions](/docs/ai/): optional Groq or Gemini suggestions for fields the local generator doesn't recognize, using your own key.

## Privacy in one sentence

Everything runs in your browser and nothing is sent anywhere, unless you turn on AI, which sends field descriptions (never the values you type) to the provider you chose. Details are in [Privacy and permissions](/docs/privacy-permissions/).
