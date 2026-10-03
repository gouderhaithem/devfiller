# Firefox Add-ons (addons.mozilla.org): submitting DevFiller

The Firefox build is the same code as Chrome's with a Firefox manifest
(`scripts/firefox-manifest.mjs`): a background script instead of a service worker, the sidebar
instead of the side panel (Alt+Shift+F toggles it), and the add-on ID `devfiller@devfiller.com`.
It needs Firefox 140 or later (Firefox for Android 142).

## Build

```sh
npm ci
npm run package:firefox   # release/devfiller-<version>-firefox.zip
```

`npm run package` still builds the Chrome and Edge zip, `release/devfiller-<version>.zip`; the two
sit side by side. Check the Firefox zip with Mozilla's linter before uploading:

```sh
npx web-ext lint --source-dir <the unzipped folder>
```

Expected: 0 errors and 3 warnings, all explained to reviewers below.

## Submit

1. Sign in at <https://addons.mozilla.org/developers/> and choose **Submit a New Add-on**.
2. **How to distribute:** On this site.
3. **Upload** `release/devfiller-<version>-firefox.zip`. Platforms: Firefox (desktop); add Firefox for
   Android only after testing it there.
4. **Source code:** Yes, the add-on is built (Vite bundles and minifies it). Upload a zip of the
   repository at the release commit, or point to <https://github.com/gouderhaithem/devfiller>, with
   these build notes:

   > Node.js 20 or later, npm 10. Run `npm ci` then `npm run package:firefox`. The add-on is written
   > to `release/devfiller-<version>-firefox.zip`. The build runs `tsc -b && vite build`, then
   > `scripts/firefox-manifest.mjs` writes the Firefox manifest.

5. **Listing:** copy the name, summary, description and screenshots from `docs/store/LISTING.md`
   (or `npm run store-listing` for copy buttons). Category: Developer Tools. Homepage
   `https://www.devfiller.com`, support `https://www.devfiller.com/support/`, privacy policy
   `https://www.devfiller.com/privacy/`. Licence: MIT.
6. **Name:** another add-on is called "Dev Filler", so keep the full name, "DevFiller — Test data
   form filler".

## Notes for reviewers

- **Data collection:** none required. `websiteContent` is optional: only when the person turns on AI
  suggestions with their own Groq or Gemini key, field descriptions (labels, names, placeholders,
  limits) go to that provider, after Firefox asks for consent (`src/browser.ts`). Values typed into
  forms, page addresses and page content are never sent.
- **Permissions:** `activeTab` and `scripting` fill the page the person clicks on; `storage` keeps
  settings; `alarms` clears cached AI suggestions; `contextMenus` adds "Open DevFiller panel" to the
  toolbar button. The Groq and Gemini hosts are for the optional AI; all websites are an optional
  permission, asked only for "Prepare ahead of the click".
- **Linter warnings:** `sidePanel.open` is Chrome's side panel, never called in Firefox (it opens the
  sidebar instead); the two `innerHTML` assignments are inside React's DOM renderer
  (`dangerouslySetInnerHTML`), not DevFiller's code.
