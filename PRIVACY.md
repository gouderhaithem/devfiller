# DevFiller Privacy Policy

_Last updated: 3 October 2026_

DevFiller is a browser extension for Chrome, Edge and Firefox that fills website forms with generated, fictional test data. This policy explains what data DevFiller handles, where it goes, and what it never does.

## Summary

- DevFiller has **no server**. The developer does not collect, receive, or store any of your data.
- Settings stay in your browser's local extension storage and are never synced.
- Values you type into forms are **never** sent anywhere.
- Only if you turn on the optional AI feature and add your own API key, **descriptions of form fields** (not their values) are sent to the AI provider you picked (Groq or Google Gemini).

## Data stored on your device

| Data | Where | How long |
| --- | --- | --- |
| Generator settings (including your region and seed), custom field values, field types you set, field exclusions | The browser's local extension storage (this browser only) | Until you change them or uninstall DevFiller |
| AI provider, model, and API key (if you add one) | The browser's local extension storage, readable only by DevFiller itself, never by websites. It is **not encrypted**. | Until you choose **Remove saved key** or uninstall DevFiller |
| AI suggestions | The browser's session storage (memory, cleared when the browser closes) | Your chosen cache time (1–60 minutes), or until you clear them |
| Undo history for the last fill | The page's memory | Until the page is closed or reloaded |

None of this data is sent to the developer.

Working out what each field is happens entirely on your device; no page content is sent anywhere for it. If you click **Export as test fixture** in the side panel (the sidebar in Firefox), DevFiller saves an HTML file to your computer with the form's structure and labels. It removes the values in the form, hidden fields, scripts, images and the site's address, and it is not sent anywhere unless you share it yourself.

## Data sent to third parties (optional AI only)

The AI feature is **off by default**. When you turn it on and save your own API key, DevFiller sends a request to the provider you chose. In Firefox, the browser first asks for your consent to send website content, and you can withdraw it in Firefox's add-on settings, which stops all AI requests:

- **Groq**: `https://api.groq.com` ([Groq privacy policy](https://groq.com/privacy-policy/))
- **Google Gemini**: `https://generativelanguage.googleapis.com` ([Google privacy policy](https://policies.google.com/privacy))

Each request contains:

- Field **metadata** from forms DevFiller could not fill with local data: visible labels and accessibility names, input names and IDs, placeholders, input types, and constraints such as length limits or allowed options.
- The language you picked for generated data.
- Your API key, which the provider uses to authenticate you.

Each request **never** contains:

- Values typed into or already in form fields
- Page URLs or full page HTML
- Cookies, browsing history, or other tabs

Website authors write the field labels and placeholders, so they may mention something specific to that website. These requests go directly from your browser to the provider under your own account, and that provider's terms and privacy policy apply to them.

## Website access

- When you click the toolbar icon, the side panel (the sidebar in Firefox), or the context menu, DevFiller reads and fills the form fields on the **active tab only** (`activeTab`, `scripting`).
- If you turn on **automatic preparation** for AI, DevFiller asks for permission to access websites. With that permission, a small script detects forms as they load so suggestions are ready sooner. You can remove this permission at any time in your browser's extension settings.
- DevFiller never submits forms. You always submit them yourself.

## What DevFiller does not do

- No analytics, tracking, advertising, or fingerprinting
- No selling or transferring user data, and no use of it for credit, lending, or any purpose unrelated to filling forms
- No remote code. All code ships inside the extension package.

## Your control

- Turn off AI or choose **Remove saved key** in Options to stop all third-party requests and clear cached suggestions.
- Uninstall DevFiller to delete everything it stored.

## The website's support form

The extension never uses this form. If you write in through <https://www.devfiller.com/support/>, your name, email address, topic, message and the optional page address are sent by email to the maintainer through [Resend](https://resend.com), an email delivery service, so the maintainer can reply. The website doesn't store the message. The emails are kept only as long as needed to answer you, and you can ask for yours to be deleted.

## The website's reviews

The extension never uses this either. If you write a review at <https://www.devfiller.com/reviews/>, the name, optional role, star rating and review you type are stored in a database run by [Neon](https://neon.tech), with the date. A review is shown publicly on the website, with your name and role, as soon as you send it; the maintainer may remove reviews that are spam or abusive. Nothing else is stored with it: no email address, IP address or account. To have your review corrected or removed, use the support form.

## Changes and contact

If this policy changes, the updated version will be published at this address with a new date. For questions, use the [support form](https://www.devfiller.com/support/) or open an issue at <https://github.com/gouderhaithem/devfiller/issues>.
