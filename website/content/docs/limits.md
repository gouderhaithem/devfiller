## Where DevFiller can't fill

- **Frames and shadow DOM.** DevFiller fills the page's main document. Forms inside iframes or web components' shadow roots aren't reached yet.
- **Custom widgets.** Rich-text editors and JavaScript dropdowns or date pickers that aren't real `<input>`, `<select>` or `<textarea>` elements need dedicated support.
- **Fields that expect real typing.** Some frameworks only accept keystrokes from a real person; a script can't reproduce that.
- **Browser pages.** `chrome://` pages, the Chrome Web Store and other extensions' pages don't allow extensions.

These are on the [roadmap](/#roadmap).

## Skipped on purpose

File uploads, hidden, disabled and read-only fields, payment card fields, one-time codes, and consent, terms and newsletter checkboxes are always left for you. Passwords are skipped unless you turn on **Generate test passwords**.

## Troubleshooting

| What you see | What to try |
| --- | --- |
| The icon shows `!` | The page doesn't allow extensions, or it changed while filling. Reload it and click again. |
| Some fields stay empty | Open the [side panel](/docs/side-panel/) to see why each one was skipped. Turn on **Fill unknown fields**, or add a [custom field](/docs/custom-fields/). |
| A field you care about keeps changing | [Exclude it](/docs/excluded-fields/), for that site or everywhere. |
| The site rejects a value | Its validation is stricter than the field's HTML rules. Add a custom field with a value that passes. |
| AI values don't appear | Check the key with **Test key**, and read the status under the suggestion cache. A quota error falls back to local values. |
| The panel says page access is needed | Click the DevFiller icon once on that site, or reopen the panel from the icon's menu. |

Still stuck? [Open an issue](https://github.com/gouderhaithem/form-filler/issues) with your browser version, the steps, and a small example form using fictional data.
