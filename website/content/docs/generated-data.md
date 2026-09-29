## Data language

Choose **English**, **Français** or **العربية** for generated names, addresses and text in **Options → Generator**. Labels are always recognized in all three languages, whatever you pick.

## Fill settings

Open the settings button at the top of the options page:

| Setting | Default | What it does |
| --- | --- | --- |
| Replace existing values | On | Fills fields that already have a value. Turn it off to keep what's there. |
| Fill unknown fields | On | Fills fields DevFiller doesn't recognize with readable words or sentences, even if the site's own validation might reject them. |
| Generate test passwords | Off | Fills password fields. The password and its confirmation get the same value. |

## What the data looks like

- **Names are real names.** `Jamie`, `Parker` and `Jamie Parker`, with the username `jamie.parker` and the email `jamie.parker@example.com`. Each fill picks a different identity when one is available.
- **No random strings.** Unknown text fields get simple words such as "Garden" or "River"; text areas get short sentences.
- **Safe by design.** Emails and websites use `example.com`. Phone numbers use the fictional US range 202-555-01xx.
- **Within the field's rules.** Numbers respect min, max and step; dates respect their range; dropdowns and radio buttons get a real option, different from the last one when possible.

The pools are finite, so values repeat over time. Addresses and phone regions aren't tied to the data language, and a website's own validation may still reject a value.

See [Field types](/docs/field-types/) for the full list of recognized fields and labels.
