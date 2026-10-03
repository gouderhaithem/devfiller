<p align="center">
  <img src="public/icons/icon-256.png" width="96" height="96" alt="DevFiller icon" />
</p>
<h1 align="center">DevFiller</h1>
<p align="center"><strong>Less typing. More testing.</strong></p>
<p align="center">Fill website forms with fresh, fictional test data in one toolbar click.</p>
<p align="center">
  <a href="https://github.com/gouderhaithem/devfiller/actions/workflows/ci.yml"><img src="https://github.com/gouderhaithem/devfiller/actions/workflows/ci.yml/badge.svg" alt="Build and tests" /></a>
  <img src="https://img.shields.io/badge/version-0.11.2-5370ce" alt="Version 0.11.2" />
  <img src="https://img.shields.io/badge/Chrome_%26_Edge-Manifest_V3-527b66" alt="Chrome and Edge, Manifest V3" />
  <img src="https://img.shields.io/badge/TypeScript-React-3178c6" alt="TypeScript and React" />
</p>
<p align="center">
  <a href="#quick-start">Quick start</a> ·
  <a href="docs/getting-started.html">First-run walkthrough</a> ·
  <a href="docs/USER_GUIDE.md">User guide</a> ·
  <a href="#development">Development</a>
</p>

![DevFiller welcome page with a working form preview](docs/images/welcome.png)

DevFiller is a browser extension for developers and QA testers who repeatedly fill forms while building and testing websites. Click the toolbar icon to generate names, matching usernames and emails, addresses, dates, and other readable values. Click again for another set.

**Local generation works without an account or API key. You decide when to submit the form.**

## Features

| | What you can do |
| --- | --- |
| **Side panel** | Inspect filled/skipped fields beside the website, highlight a control, and save a custom value or exclusion. |
| **Undo last fill** | Restore the previous values while preserving fields you edited afterward. |
| **One-click filling** | Fill the active page directly from the toolbar and see the filled-field count on the icon. |
| **46 field categories** | Generate fictional identities, contact details, work information, addresses, numbers, dates, and text. |
| **Measured recognition** | Every field scored from all its clues, the form read as a whole, and a confidence and the evidence shown in the side panel. Card fields get sandbox test cards (4242 4242 4242 4242 and the declined, insufficient-funds, expired and incorrect-CVC cards), never real ones. Other sensitive fields get values that read as tests: a one-time code of 4s (`444444`), a bank account of 4s (a valid IBAN `DE47444444444444444444`, BIC `TESTDE44`, US routing `110000000`), consent and "Remember me" boxes ticked with "Yes" on permission questions. Exclude any field you want left alone. |
| **Fits the site's validation** | Values follow each field's rules, and a value the site rejects is written another way. |
| **Custom widgets** | ARIA switches, checkboxes, radio groups, dropdowns and rich-text editors are filled too. |
| **Repeatable and regional data** | A seed gives the same data every run; addresses and phones come from the United States, France or Algeria (69 wilayas, real communes). |
| **Fix a field's type** | Tell DevFiller what a field is from the side panel, and export any form as a test fixture. |
| **English, French & Arabic** | Recognize labels in all three languages and choose a language for generated data. |
| **Custom values** | Map your own labels to exact test values, such as `Project code` → `PRJ-001`. |
| **Field exclusions** | Protect fields by label or CSS selector, optionally scoped to a website. Search and navigation controls are skipped by default. |
| **Optional AI** | Contextual suggestions for unfamiliar fields using your own **Groq** (default) or **Gemini** key, requested when you click Fill. Quota failures fall back to local data. |
| **Cache controls** | Keep Gemini suggestions for 1–60 minutes, see their expiry, or clear them immediately. |

## Install

Install DevFiller from the **[Chrome Web Store](https://chromewebstore.google.com/detail/devfiller-%E2%80%94-test-data-for/neodjaolegipdhfjgjbdlgfehenmeofj)**. Chrome keeps it up to date.

1. Open [DevFiller on the Chrome Web Store](https://chromewebstore.google.com/detail/devfiller-%E2%80%94-test-data-for/neodjaolegipdhfjgjbdlgfehenmeofj) and click **Add to Chrome**.
2. Pin DevFiller to your toolbar and follow the welcome guide.
3. Open a page with a form and click the DevFiller icon.

Right-click the icon and choose **Options** to change the generated language, add custom values, or configure exclusions. [How recognition works](https://www.devfiller.com/docs/how-it-works/) explains how DevFiller decides what each field is.

## Run your own build

Use **Node.js 22** and npm for the same runtime as CI.

```sh
git clone https://github.com/gouderhaithem/devfiller.git
cd devfiller
npm ci
npm run build
```

1. Open `chrome://extensions` in Chrome or `edge://extensions` in Edge.
2. Enable **Developer mode**, then click **Load unpacked**.
3. Select the generated **`dist/` folder**. Turn off the store version while you test your build.

To update your build, rebuild and click **Reload** on its extension card.

### Try the local demo

```sh
npm run dev
```

Open [the local preview](http://127.0.0.1:5187/), choose **Generator**, and click **Generate & fill**. This preview uses the same local filling engine as the extension.

![DevFiller generator and a filled multilingual demo form](docs/images/generator.png)

### Open the side panel

Right-click the DevFiller toolbar icon and choose **Open DevFiller panel**, or press **Alt + Shift + F**. The panel opens beside the current website. A normal toolbar click fills the page, waiting for AI data when needed.

- Review each field's filled/skipped status and reason. Hidden inputs are omitted and password values are masked.
- Select a field to highlight it on the page, save a custom test value for that field on that hostname, or exclude it.
- Click **Fill this page / Fill again** to apply your settings, or **Undo last fill** to restore the last set of changes.
- Switch tabs or reload a page and the panel refreshes its field list. A new website may need a toolbar click or reopening the panel from the icon's menu to grant access.

Undo keeps one fill per document, preserves later manual edits, and resets when the document reloads. Previous values stay in the page's isolated extension context and never go to Gemini. Undo restores form controls, not other effects a website may trigger when a value changes.

Requires Chrome 118+ or an Edge version supporting the Side Panel API. Change a conflicting shortcut at `chrome://extensions/shortcuts` or `edge://extensions/shortcuts`.

<img src="docs/images/sidepanel.png" width="420" alt="DevFiller native side panel showing individual field results and fill controls" />

### Optional AI setup (Groq or Gemini)

In the installed extension, open **Options → AI**, pick a **Provider**, enter that provider's API key, and click **Test key**. Choose a model, enable **Use AI for unknown fields**, and save.

Two providers are supported, each with its own key and models:

| Provider | Models | Get a key |
| --- | --- | --- |
| **Groq** (default) | `openai/gpt-oss-20b` (default), `openai/gpt-oss-120b`, `qwen/qwen3.8-27b` | [Groq console](https://console.groq.com/keys) |
| **Gemini** | `gemini-3.6-flash` (default), `gemini-3.5-flash`, `gemini-3.8-flash` | [Google AI Studio](https://aistudio.google.com/apikey) |

Groq leads because its free tier answered every measured request and returned a first fill in about 2.5 seconds, where Gemini's free tier rate-limited quickly. Switching providers selects that provider's default model; paste the matching key. Settings saved before providers existed stay on Gemini, so an existing Google key is never sent to Groq.

A provider listing a model is not a guarantee your key can generate with it — Gemini still lists models that are retired for newer accounts. If filling reports a model as unavailable or repeatedly overloaded, pick another from the list.

By default **Gemini runs only when you click Fill**, so no quota is spent on pages you open but never fill. The first click on a form generates its suggestions and waits for them; later clicks reuse the cache until it expires.

Turn on **Prepare ahead of the click** to trade quota for speed. DevFiller then watches for forms as they appear — including forms rendered later by React/Vue, dialogs, and navigation within an app — and generates before you click, so filling is instant. This requires standing website access and generates for every page with a form, including ones you never fill. Existing open pages are covered when you enable it, and hidden tabs wait until you return to them.

**Clicking Fill waits for AI.** Ready suggestions are used immediately. When preparation is on, an in-flight preload is shared with the click; if data is missing or expired, the remaining suggestions are requested before filling. Only a Gemini quota/rate-limit failure switches the AI step to local data. Other AI errors leave the form untouched and show an error. Forms remain untouched until you click. Background preparation deduplicates requests and only sends field descriptions, not entered values. Contextual text such as Description, Message, Title, Company, and Job title uses Gemini even when DevFiller recognizes its label. Identity/contact fields and explicit custom rules retain their existing generators. Missing, expired, or mismatched AI data leaves the affected field unchanged instead of inserting random local text; the panel shows the reason and whether a filled value came from Gemini, local data, or your rule. After a quota failure, automatic background preparation pauses for a minute, but **a fill you click always tries Gemini again**, so a brief rate limit no longer leaves you filling unrelated local words after the API recovers. Gemini requests use your Google project's quota and billing settings.

See the [complete user guide](docs/USER_GUIDE.md#gemini-optional) for cache behavior, settings, permissions, and troubleshooting.

## Onboarding

New to DevFiller? **[docs/getting-started.html](docs/getting-started.html)** is a self-contained first-run walkthrough: build, load, pin, fill, the three settings worth knowing on day one, what DevFiller deliberately will not do, and the four things that most often trip people up. Open the file in any browser, or hand it to a teammate who just loaded the extension.

## Privacy and boundaries

- Settings, custom values, and exclusions stay in local extension storage. There is no browser sync or DevFiller backend.
- Gemini is optional. Its prompt contains field metadata, including labels and placeholders, plus the selected language. Entered form values, page URLs, and whole-page HTML are excluded. Labels can still contain website-specific information.
- Your Gemini key stays in local extension storage, which is **not encrypted**, and is sent to Google for API authentication. No shared key is bundled.
- DevFiller fills the **top-level document**. Frames, shadow DOM, rich-text editors, and custom widgets need additional adapters.
- File uploads and hidden/disabled/read-only controls are skipped. Detected one-time-code, bank and consent fields get test values; exclude a field to leave it alone. Filling never submits forms automatically.
- Generated data is fictional. Finite sample pools can repeat, and website-specific validation may reject values. Choose the region for addresses and phones in the options; French and Algerian phone numbers follow the real format and may be in use.

The extension uses `activeTab`, `scripting`, `storage`, and `alarms`, plus `sidePanel` and `contextMenus` for the page companion. Automatic Gemini preparation requests optional HTTP/HTTPS website access. [Privacy policy](PRIVACY.md) · [Full privacy and permissions details →](docs/USER_GUIDE.md#privacy--permissions)

## Development

Built with **React 19**, **TypeScript**, **Vite**, and **Manifest V3**. Vitest covers the generator and filling logic, while Playwright exercises the interface and a real Chromium extension.

```sh
npm ci
npm run dev                   # Options preview and local demo on port 5187
npm run build                 # Type-check and build the unpacked extension
npm test                      # Unit tests
npx playwright install chromium
npm run test:e2e              # Browser and extension tests on port 5188
npm run package               # release/devfiller-<version>.zip for Chrome and Edge
npm run package:firefox       # release/devfiller-<version>-firefox.zip for Firefox 140+
```

The Firefox build is the same code with a Firefox manifest (the sidebar instead of the side panel). [docs/store/FIREFOX.md](docs/store/FIREFOX.md) explains submitting it to addons.mozilla.org.

Run `npm run build` before the browser tests. CI runs the build and both test suites and uploads an unpacked extension artifact.

| Path | Purpose |
| --- | --- |
| `src/engine.ts` | Field detection, constraints, exclusions, and filling |
| `src/data.ts`, `src/samples.ts` | Fictional values and multilingual samples |
| `src/background.ts` | Toolbar action, Gemini preparation, and session cache |
| `src/gemini.ts` | Gemini and Groq requests, response validation, and cache configuration |
| `src/form-preload.ts`, `public/form-watch.js` | Detect forms as they appear and prepare Gemini data before filling |
| `src/sidepanel.tsx`, `src/panel-page.ts` | Side panel interface, field highlighting, and undo |
| `src/main.tsx` | Options interface and development preview |
| `src/welcome.tsx` | First-install guide and interactive example |
| `public/manifest.json` | Extension entry points and permissions |
| `tests/` | Unit and browser regression coverage |

Google responses are simulated in automated tests. Live Gemini access, the native website-permission prompt, Edge, and arbitrary third-party websites require manual verification.

## Documentation and contributions

- [User guide](docs/USER_GUIDE.md): settings, custom rules, exclusions, cache behavior, and practical limits.
- [Field guide](FIELD_GUIDE.md): supported categories, aliases, and coverage ideas.
- [Third-party notices](THIRD_PARTY_NOTICES.md): the Algerian communes dataset and its licence.
- [Implementation notes](PLAN.md): project evolution and future ideas.
- [Brand assets](docs/brand/README.md): icon source and rebuild instructions.
- [Chrome Web Store readiness](docs/chrome-web-store-readiness.pdf) ([source](docs/chrome-web-store-readiness.html)): publication audit, blockers, pre-publish checklist, and ready-to-paste permission justifications ([ready-to-paste listing](docs/store/LISTING.md)). Rebuild with `node scripts/html-to-pdf.mjs docs/chrome-web-store-readiness.html docs/chrome-web-store-readiness.pdf`.

For a bug report, include the browser version, reproduction steps, and a minimal form example with fictional data. Before opening a pull request, run the build and both test suites. Useful next areas include custom widget adapters and more regional datasets.

## Author

DevFiller is built and maintained by **Haithem Gouder** ([GitHub](https://github.com/gouderhaithem)). Questions and ideas are welcome through the [support form](https://www.devfiller.com/support/) or the [issues](https://github.com/gouderhaithem/devfiller/issues).

## License

[MIT](LICENSE)
