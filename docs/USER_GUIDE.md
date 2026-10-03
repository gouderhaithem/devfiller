<p align="center">
  <img src="../public/icons/icon-256.png" width="96" height="96" alt="DevFiller icon" />
</p>
<h1 align="center">DevFiller</h1>
<p align="center"><strong>Less typing. More testing.</strong></p>
<p align="center">Fresh test data for the form in front of you. One toolbar click.</p>
<p align="center">Chrome & Edge · Manifest V3 · English / Français / العربية</p>
<p align="center">
  <a href="#get-started">Get started</a> ·
  <a href="#gemini-optional">Gemini</a> ·
  <a href="#your-cache-your-timing">Cache controls</a> ·
  <a href="#development">Development</a>
</p>

![DevFiller welcome page with an interactive form preview](images/welcome.png)

DevFiller fills website forms with fictional names, usernames, emails, addresses, and more. Unknown fields get readable words instead of random character strings. Add your own Gemini key for suggestions related to unfamiliar labels.

Click the extension icon to fill the current website. Click again for fresh values. **You control when the form is submitted.**

## What you get

| Feature | What it does |
| --- | --- |
| One-click filling | Fills the active page directly from the toolbar, with a count on the icon. |
| 46 field categories | Identities, contact details, work, addresses, dates, numbers, and short text. |
| Three languages | Recognizes English, French, and Arabic labels; choose the generated data language. |
| Readable unknown values | Uses simple words such as “Garden” and “River”, or short sentences for textareas. |
| Optional Gemini | Prepares related suggestions on page load and keeps a batch ready for your next click. |
| Configurable cache | Choose **1–60 minutes**, with **5 minutes** as the default, or clear it immediately. |
| Custom rules & exclusions | Supply values for your own labels and protect fields that should stay untouched. |
| First-install welcome | A quick setup guide, interactive preview, and links to your settings. |

## Get started

You’ll need Node.js and npm to build from source.

```sh
cd /path/to/devfiller
npm ci
npm run build
```

1. Open `chrome://extensions` in Chrome or `edge://extensions` in Edge.
2. Enable **Developer mode** and choose **Load unpacked**.
3. Select the generated **`dist` folder**. Select the folder itself, not an individual file.
4. Follow the welcome page and pin DevFiller from the browser’s Extensions menu.
5. Open a website with a form and click the DevFiller toolbar icon.

**Already installed?** Rebuild, then click **Reload** on DevFiller’s extension card. Your saved settings remain. The welcome page opens automatically only on a new installation; you can revisit it from **Options → Welcome guide**.

Right-click the toolbar icon → **Options** to configure DevFiller. Gemini is the default tab. The other tabs are **Generator**, **Custom fields**, and **Excluded fields**.

The toolbar badge shows the number of filled fields. Hover over the icon for details. A `!` badge means filling failed; browser internal pages and extension stores restrict extension access.

## Side panel

Right-click the toolbar icon → **Open DevFiller panel**, or press **Alt + Shift + F**. The panel stays beside the website and follows the active tab. Ordinary toolbar clicks fill the page and wait if AI data is still pending.

Use the field list to inspect filled/skipped results, highlight a control, save a custom value, or exclude a field. Panel custom rules target a CSS selector on the exact hostname and take priority over autocomplete. You can change their values or delete them in **Options → Custom fields**. If the website changes its markup, recreate the rule. Panel exclusions appear in **Options → Excluded fields**.

**Undo last fill** restores the last fill for the current document and preserves controls changed since then. Reloading clears undo. Original values stay in the isolated extension context of the page, never in Gemini prompts or extension storage. Undo cannot reverse other website actions triggered by change events.

The list refreshes after tab changes and periodically while open. On a new website, click DevFiller or reopen its panel from the icon’s menu if access is needed. Restricted browser pages, frames, and custom widgets retain the existing limitations.

The panel needs Chrome 118+ or a compatible Edge version. Customize the shortcut in your browser’s extension shortcuts page.

## AI suggestions (optional)

Local generation works without an account or API key. To add contextual suggestions for fields the local generator does not recognize:

1. Open **Options → AI** and pick a **Provider**: **Groq** (the default) or **Gemini**.
2. Paste that provider's key, from the [Groq console](https://console.groq.com/keys) or [Google AI Studio](https://aistudio.google.com/apikey).
3. Click **Test key** to check which supported models your key can reach. This lists models; it does not generate test data.
4. Enable **Use AI for unknown fields**, then click **Save settings**.
5. Click DevFiller on a website with a form. Suggestions are requested for that click and cached for later fills.

Each provider has its own models, and switching selects the new provider's default. Groq is a useful alternative when Gemini's free tier rate-limits you. **Prepare ahead of the click** is off by default because watching every page and generating in advance spends quota on forms you may never fill. Turn it on, and accept the browser's website-access request, if you would rather trade quota for an instant fill.

**With preparation on, forms appearing prepares data; clicking waits for AI if needed.** Late-rendered forms and forms revealed in dialogs are detected automatically. Hidden tabs wait until visible. Fill shares an existing preload and waits for its response. Missing or expired suggestions are generated before filling. Only a quota/rate-limit error switches to local data; other AI errors leave the form untouched. A request asks for up to ten suggestions for each of up to 30 unknown fields. Recognized fields, custom rules, dropdowns, and radio groups use the local engine. Incomplete or invalid AI results show an error instead of silently filling local values.

AI requests use your provider account's quota and billing settings. DevFiller briefly retries temporary errors while the fill waits. A final quota/rate-limit error pauses automatic background preparation for one minute, but a fill you click always attempts the provider again, so a short rate limit does not leave later clicks filling unrelated local words. Other failures are reported. Model availability depends on your key: the listing can include models a key cannot generate with, and older models are retired for new accounts, so switch models if one reports as unavailable.

### Your cache, your timing

In **Options → AI → Suggestion cache**:

| Control | Behavior |
| --- | --- |
| **Cache expiry (minutes)** | Enter a whole number from 1 to 60. Existing installations keep the five-minute default. |
| **Save expiry** | Saves the duration independently of your API key settings. Clears previous suggestions so fresh batches use the new duration. |
| **Clear cache** | Removes all cached suggestions immediately without removing your key or changing your expiry setting. |
| **Cache status** | Shows the number of suggestions and batches, plus a countdown to the next batch expiry. |

Batches are isolated by tab, website origin, language, model, and key. Each field keeps its remaining suggestions when the surrounding form changes. Only new or exhausted fields need another request when background detection runs. Normal typing and unrelated DOM changes do not repeatedly request data. Adding fields does **not** extend the existing batch’s expiry.

Clicks consume suggestions in order. Reloading the same form reuses the remaining batch until it expires. After clearing or expiry, the next eligible page load, form change, or return to the tab prepares a fresh batch. A click uses available cache, waits for an in-flight preload, or requests missing suggestions. Memory is bounded to 24 batches, with up to 120 field signatures per batch.

Suggestions live in session memory. Expiry is checked before filling, and a cleanup alarm removes expired entries. If the browser delays an alarm while sleeping, expired values are still rejected on the next access. Extension reloads, disabling the extension, or a browser restart clear this [session storage](https://developer.chrome.com/docs/extensions/reference/api/storage#property-session).

## Make it fit your forms

### Generator

Choose **English**, **Français**, or **العربية** for generated data. Label recognition always includes all three languages.

Open the settings button at the top of Options to control:

- **Replace existing values** — on by default. Turn it off to preserve populated fields.
- **Fill unknown fields** — on by default. Uses readable fallback values even when the website’s custom validation rejects them.
- **Learned guesses** — on by default. When the rules aren’t sure what a field is, a small model built into the extension suggests a type. It runs offline, and its guesses are marked in the field list.
- **Generate test passwords** — off by default. When enabled, password and confirmation fields share a generated value per fill.

### Custom fields

Add a label and a test value, for example `Project code` → `PRJ-001`. Rules match exact normalized labels, accessible names, names, IDs, or placeholders. Standard autocomplete attributes take priority over label rules. Rules created from the side panel target one field on an exact hostname and take priority over autocomplete. Custom values are inserted exactly as entered, without added prefixes or suffixes. A fixed custom value stays the same across clicks; if it cannot fit the control, that field is reported as incompatible.

### Excluded fields

Search fields and controls inside headers/navigation are skipped by default. Add exclusions using either a label or a CSS selector:

| Match | Example | Scope |
| --- | --- | --- |
| Label, name, ID, or placeholder | `Language` | Exact match with normalized case, accents, punctuation, and Arabic diacritics. |
| CSS field selector | `#site-search` | Excludes matching controls. |
| CSS container selector | `.header-filters` | Excludes the container’s controls too. |
| Optional website | `example.com` | Applies the rule to that hostname and its subdomains. Leave blank for all sites. |

Exclusions save automatically and clear the Gemini cache. Excluded fields keep their values, receive no filling events, and are omitted from Gemini scans. Excluding a radio button protects its whole group.

## Field coverage

| Category | Generated values |
| --- | --- |
| Identity | Username, full / first / middle / last name, date of birth, age, gender, nationality, title |
| Contact & account | Email, phone, website, optional test password |
| Work | Company, job title, department, industry, employee count |
| Address | Street address, apartment / suite, city, state / wilaya, postal code, country |
| Text | Biography, description, message, subject, notes, search text when allowed |
| Numbers | Quantity, price, amount, salary, percentage, rating |
| Dates & appearance | Date, start / end date, time, color |

Native inputs, textareas, selects, checkboxes, and radio groups are supported, including numeric ranges and date/time types. See the [field guide](../FIELD_GUIDE.md) for label aliases and future coverage ideas.

### Freshness and practical limits

Generated fields use readable words and phrases, with no appended random identifiers. Companies, addresses, messages, URLs, and test passphrases rotate through natural samples. Names contain only natural names: `Jamie`, `Parker`, and `Jamie Parker`. Usernames are readable, such as `jamie.parker`, with matching `example.com` emails. Each fill chooses another identity when an alternative is available; the finite name pool can repeat over time. Unknown text inputs use a finite pool of natural words; textareas use short sentences. Dropdowns, radios, bounded numbers, and dates avoid consecutive repeats when an alternative is available. Checkboxes toggle when eligible. Finite choice sets will eventually repeat, and a control with only one allowed value cannot change.

Data is fictional and intended for testing. Emails and websites use `example.com`; phone samples use the fictional US 202-555-01xx range. Address and phone regions are not necessarily tied to the selected language. Website-specific validation may still reject generated data.

DevFiller works in the active page’s **top-level document**. Frames, shadow DOM, rich-text editors, and custom JavaScript controls need separate adapters. File uploads and hidden/disabled/read-only controls are skipped; detected consent, payment, bank and one-time-code fields get test values. Some frameworks require trusted user input that a script cannot reproduce.

## Privacy & permissions

| Data | Where it goes |
| --- | --- |
| Generator settings, custom rules, exclusions | Local extension storage. No browser sync. |
| Gemini API key | Local extension storage restricted to trusted extension pages. It is **not encrypted**. Sent to Google in the API authentication header. |
| Gemini prompt | Field labels/accessibility names, input names/IDs, placeholders, types, constraints, and selected language go to Google. |
| Entered form values | Excluded from the Gemini prompt. Whole-page HTML and page URLs are also excluded. |
| Generated suggestions | Browser session cache, removed on expiry or when you clear it. |

Labels and placeholders are sent as written, so they can contain information specific to the website. **Remove saved key** disables Gemini and clears its cache. No shared API key is bundled, and the development preview does not store Gemini credentials.

DevFiller requests `activeTab` and `scripting` to fill the clicked page, `storage` for preferences/cache, and `alarms` for cache cleanup. `sidePanel` and `contextMenus` provide the optional page companion. Access to Google’s API endpoint supports Gemini requests. Broad HTTP/HTTPS website access is optional and requested when you enable Gemini’s automatic preparation.

## Development

```sh
npm ci
npm run dev
```

| Local page | Purpose |
| --- | --- |
| `http://127.0.0.1:5187/` | Options preview alongside a working form demo. |
| `http://127.0.0.1:5187/welcome.html` | First-install welcome presentation. |
| `http://127.0.0.1:5187/demo.html` | Standalone form for testing the installed extension. |
| `http://127.0.0.1:5187/dynamic-form.html` | Regression fixture that reveals fields after filling. |

The development webpage previews the interface and local generator. Configure Gemini in the installed extension’s **Options** page.

```sh
npm run build                 # Type-check and create dist/
npm test                      # Unit tests
npx playwright install chromium
npm run test:e2e              # Real Chromium extension + browser UI tests
npm run icons                # Rebuild icon sizes from the generated master
```

Browser tests start a separate server on port 5188 and use disposable profiles. They cover toolbar filling, multilingual data, saved settings, exclusions, changing forms, cache reuse/expiry, and the first-install welcome flow at desktop, tablet, and mobile sizes.

Google responses are simulated in automated tests. The native website-permission dialog and a real Gemini key/model need manual verification. Edge and arbitrary third-party websites are not separately tested.

### Project map

```text
public/manifest.json       Extension permissions, entry points, and icons
../public/icons/              Toolbar and app icons (16–256 px)
src/background.ts          Toolbar action, Gemini preparation, cache, install event
src/engine.ts              Page scanning and form filling
src/data.ts                Synthetic values, settings, field types
src/samples.ts             Readable field samples in English, French, and Arabic
src/gemini.ts              Gemini requests, validation, cache configuration
src/GeminiPanel.tsx         Gemini and cache controls
src/ExclusionsPanel.tsx     Exclusion rules
src/main.tsx               Options and development preview
src/welcome.tsx             First-install welcome presentation
src/welcome.css             Welcome page styling
scripts/build-icons.mjs     Alpha-preserving icon size exports
tests/                      Unit and browser coverage
docs/brand/                 Generated master icon and generation prompt
```

The [implementation history](../PLAN.md) records the project’s evolution. The [icon notes](brand/README.md) include the original generation prompt and how to rebuild the icon sizes.
