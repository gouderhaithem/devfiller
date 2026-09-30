## Data language

Choose **English**, **Français** or **العربية** for generated names, addresses and text in **Options → Generator**. Labels are always recognized in all three languages, whatever you pick.

## Fill settings

Open the settings button at the top of the options page:

| Setting | Default | What it does |
| --- | --- | --- |
| Replace existing values | On | Fills fields that already have a value. Turn it off to keep what's there. |
| Fill unknown fields | On | Fills fields DevFiller doesn't recognize with readable words or sentences, even if the site's own validation might reject them. |
| Generate test passwords | Off | Fills password fields. The password and its confirmation get the same value. |
| Addresses and phones | Mixed | Where cities, postal codes, districts, countries and phone numbers come from: **United States**, **France** or **Algeria**, or **Mixed** to pick one of them for each fill. |
| Repeatable data | Empty | Type a seed, such as `checkout-test`, to get exactly the same values on every fill. Leave it empty for fresh data on every click. |

## Repeatable data

With a seed, the same form gets the same identity and the same values every time: generic text, numbers, dates, choices and phone numbers included. Use it for tests that compare screenshots or expect known values. Change the seed to get a different, equally repeatable set.

- Each field draws from its own stream, so adding a field to the form doesn't change the others.
- Dates don't depend on the day you run the test: birth dates count back from 1 January 2026, and start dates fall in 2030.
- Seeded fills don't use AI suggestions, since those can't be repeated.
- A field whose name and ID are generated anew on each page load (such as `:r1:` in React apps) can't be matched from one run to the next, so it gets a new value. So can a field whose page sets its limits relative to today.

## What the data looks like

- **Names are real names.** `Jamie`, `Parker` and `Jamie Parker`, with the username `jamie.parker` and the email `jamie.parker@example.com`. Each fill picks a different identity when one is available.
- **No random strings.** Unknown text fields get simple words such as "Garden" or "River"; text areas get short sentences.
- **Safe by design.** Emails and websites use `example.com`. US phone numbers use the fictional range 202-555-01xx.
- **Places that fit together.** The city, postal code, district, state or wilaya, country, nationality and phone number all come from the same country. With **Algeria**, you get the chef-lieu of one of 20 wilayas (for example Oran, daira of Oran, 31000), a `+213` mobile number and Algerian names, in Arabic script when the data language is Arabic.
- **Phones follow the form.** When the form asks for a country, or the phone field shows a dial code such as `+213` or `+33`, the number is written in that country's format. French and Algerian numbers follow the real format and may be in use, so never use them to send messages.
- **Within the field's rules.** Numbers respect min, max and step; dates respect their range; dropdowns and radio buttons get a real option, different from the last one when possible.

The pools are finite, so values repeat over time, and a website's own validation may still reject a value.

See [Field types](/docs/field-types/) for the full list of recognized fields and labels.
