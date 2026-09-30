## Where DevFiller can't fill

- **Frames and shadow DOM.** DevFiller fills the page's main document. Forms inside iframes or web components' shadow roots aren't reached yet.
- **Custom widgets without ARIA roles.** Switches, checkboxes, radio groups, dropdowns and rich-text editors built with the standard ARIA roles are filled. Widgets that don't declare a role, and custom date pickers, aren't recognized, and the side panel and **Undo last fill** only cover native fields.
- **Fields that expect real typing.** Some frameworks only accept keystrokes from a real person; a script can't reproduce that.
- **Browser pages.** `chrome://` pages, the Chrome Web Store and other extensions' pages don't allow extensions.

These are on the [roadmap](/#roadmap).

## Skipped on purpose

File uploads, hidden, disabled and read-only fields, card and bank details, one-time codes, consent, terms, newsletter and data-sharing checkboxes, and "Remember me" choices are always left for you. Passwords are skipped unless you turn on **Generate test passwords**.

## Troubleshooting

| What you see | What to try |
| --- | --- |
| The icon shows `!` | The page doesn't allow extensions, or it changed while filling. Reload it and click again. |
| Some fields stay empty | Open the [side panel](/docs/side-panel/) to see why each one was skipped. Turn on **Fill unknown fields**, set the right type with **This field is**, or add a [custom field](/docs/custom-fields/). |
| A field got the wrong kind of value | Select it in the side panel and choose its type with **This field is**. It's used on that site from then on. |
| A field you care about keeps changing | [Exclude it](/docs/excluded-fields/), for that site or everywhere. |
| The site rejects a value | DevFiller already tries other formats when a site marks a field invalid. If it still fails, add a custom field with a value that passes. |
| AI values don't appear | Check the key with **Test key**, and read the status under the suggestion cache. A quota error falls back to local values. |
| The panel says page access is needed | Click the DevFiller icon once on that site, or reopen the panel from the icon's menu. |

Still stuck? [Open an issue](https://github.com/gouderhaithem/form-filler/issues) with your browser version and the steps, and attach the form: **Export as test fixture** in the side panel saves its structure, never the values in it.
