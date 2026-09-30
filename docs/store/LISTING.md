# Chrome Web Store listing: ready to paste

Run `npm run store-listing` and open `docs/store/listing.html` in a browser for copy buttons and image previews. Copy each block into the matching field of the [Chrome Web Store developer dashboard](https://chrome.google.com/webstore/devconsole). Keep it in sync with [PRIVACY.md](../../PRIVACY.md) if behaviour changes.

## Package

- Build the upload file with `npm run package`, which creates `release/devfiller-<version>.zip` (the demo page is left out).
- Remake the images with `npm run build && npm run store-assets`.

## Store listing tab

**Name** (from the manifest)

```
DevFiller — Test data form filler
```

**Summary** (manifest `description`, 132 characters max)

```
Click the toolbar icon to fill the current website with generated test data.
```

**Category:** Developer Tools
**Language:** English

**Description**

```
DevFiller fills website forms with realistic, fictional test data in one click, so you can test sign-up flows, checkouts and admin screens without typing the same details again and again.

HOW IT WORKS
• Open any page with a form and click the DevFiller icon. Every field it recognizes is filled instantly.
• DevFiller never submits the form. You review the values and submit when you are ready.
• Open the side panel (right-click the icon, or press Alt+Shift+F) to see which fields were filled or skipped and why, what each field was recognized as, jump to a field, and undo the last fill.

ACCURATE BY DESIGN
• Each field is recognized from every clue the page gives: its label, name, placeholder, autocomplete attribute, units such as (mm) or (kg), and the answers a list offers. DevFiller fills a field only when the evidence is strong enough, and shows how sure it is.
• It reads the form as a whole: confirmation fields repeat what they confirm, end dates follow start dates, and a phone number follows the country the form asks for.
• Values follow each field's rules, and if the site rejects one, DevFiller writes it another way.
• Custom switches, checkboxes, dropdowns and rich-text editors built with ARIA roles are filled too.
• Got a field wrong? Tell DevFiller what it is from the side panel, and it remembers for that site.

DATA THAT MAKES SENSE
• 46 field types: names, usernames, emails, phones, addresses, companies, job titles, dates, numbers, messages and more.
• Values fit together: the username and email match the generated name, and the address and phone number come from one country: the United States, France or Algeria (69 wilayas and real communes).
• Measurements sized for their unit, and order or invoice numbers that look real.
• Repeatable data: type a seed to get exactly the same values on every fill.
• Recognizes labels in English, French and Arabic, and generates data in any of the three languages.
• Respects input types, length limits, min/max values and dropdown options.

YOU STAY IN CONTROL
• Custom values: map a label such as "Project code" to an exact value such as "PRJ-001".
• Exclusions: leave search bars, navigation and any field you choose untouched, on every site or just one.
• File uploads, payment and bank fields (card numbers, CVV, IBAN), one-time codes, consent and data-sharing checkboxes and "Remember me" choices are skipped. Password fields stay empty unless you turn on test passwords.

OPTIONAL AI FOR UNUSUAL FIELDS
Fields the local generator doesn't recognize can get relevant suggestions from Groq or Google Gemini, using your own API key. This is off by default. Only field descriptions (labels, names, placeholders and limits) are sent, never the values you type, the page address or the page content. Without a key, everything runs locally.

PRIVACY
No account, no DevFiller server, no analytics. Settings stay in your browser.
```

**Store icon:** `public/icons/icon-128.png`
**Screenshots**, in this order, from `docs/store/`:

1. `1-fill-with-side-panel.jpg`
2. `2-generator.jpg`
3. `3-ai-suggestions.jpg`
4. `4-excluded-fields.jpg`
5. `5-welcome.jpg`

**Small promo tile:** `docs/store/promo-small-440x280.jpg`
**Marquee promo tile:** `docs/store/promo-marquee-1400x560.jpg`
**Homepage URL:** `https://www.devfiller.com`
**Support URL:** `https://github.com/gouderhaithem/form-filler/issues`
**Official URL:** leave as None until www.devfiller.com is verified in Google Search Console.
**Mature content:** No

## Privacy tab

**Single purpose**

```
DevFiller fills the form on the current web page with generated, fictional test data when the user clicks it, so developers and testers can test forms without typing.
```

**Permission justifications**

| Permission | Justification |
| --- | --- |
| `activeTab` | DevFiller fills the form on the tab the user is looking at. This grants access only to that tab and only after the user clicks the toolbar icon or the side panel's Fill button, or opens the panel with the keyboard shortcut. |
| `scripting` | Filling a form requires running the fill routine in the current page. No script runs until the user clicks Fill, unless they turn on the optional "Prepare ahead of the click" setting. |
| `storage` | Stores the user's own settings locally: generated-data language, custom field values, field exclusions, and an optional AI API key the user supplies. Nothing is synced and there is no remote server. |
| `alarms` | Removes expired cached AI suggestions. Suggestions have a user-set expiry of 1 to 60 minutes, and an alarm clears them when they lapse. |
| `sidePanel` | Shows a panel beside the page listing which fields were filled or skipped and why, so the user can find a field, save a custom value, exclude a field, or undo the fill. |
| `contextMenus` | Adds "Open DevFiller panel" to the right-click menu of the toolbar icon. |
| Host: `generativelanguage.googleapis.com`, `api.groq.com` | When the user turns on AI suggestions and supplies their own API key, DevFiller sends form field labels and constraints to the provider the user selected, to generate relevant test values. Entered values, page URLs and page content are never sent. |
| Optional host: `http://*/*`, `https://*/*` | Requested only if the user turns on "Prepare ahead of the click", which generates AI suggestions as forms appear instead of waiting for a click. The user is asked when they enable the setting and can decline; the extension works fully without it. |

**Remote code:** No, I am not using remote code. (All JavaScript ships in the package.)

**Data usage**

What user data do you collect? Tick only:

- **Website content**: form field labels, names, placeholders and constraints, sent to the user's chosen AI provider only when the user turns AI on.
- **Authentication information**: the user's own AI API key, stored locally and sent only to that provider to authenticate.

Leave everything else unticked (personally identifiable information, health, financial, personal communications, location, web history, user activity).

Certify all three statements:

- I do not sell or transfer user data to third parties, apart from the approved use cases.
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose.
- I do not use or transfer user data to determine creditworthiness or for lending purposes.

**Privacy policy URL**

```
https://www.devfiller.com/privacy/
```

## Before you press Submit

- [ ] https://www.devfiller.com/privacy/ opens without a certificate warning.
- [ ] `npm run package` was run on the merged `main`.
- [ ] Install the zip in a fresh Chrome profile (`chrome://extensions` → Developer mode → Load unpacked, after unzipping) and fill a form once.
- [ ] Rotate any Groq or Gemini key that was ever pasted into a chat, commit, screenshot or test.
