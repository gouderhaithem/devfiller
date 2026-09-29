DevFiller has no server, no account and no analytics. The full [privacy policy](/privacy/) is the reference; this page summarizes it.

## Where your data lives

| Data | Where |
| --- | --- |
| Settings, custom fields and exclusions | Local extension storage in this browser. Never synced. |
| AI provider, model and API key | Local extension storage, readable only by DevFiller's own pages. **Not encrypted.** Sent only to your provider, to authenticate. |
| AI suggestions | Session memory, cleared on expiry, when you clear the cache, or when the browser closes. |
| Undo history | The page's memory, until it reloads. |

**Remove saved key** in **Options → AI** turns AI off and clears the cache.

## What is sent, and only with AI on

| Sent to your provider | Never sent |
| --- | --- |
| Field labels, names, IDs, placeholders, types and limits | Values typed into or already in fields |
| The data language | Page addresses and page content |
| Your API key | Cookies, history, other tabs |

## Why each permission exists

| Permission | Why DevFiller needs it |
| --- | --- |
| `activeTab` | Fill the tab you're looking at, only after you click or use the shortcut. |
| `scripting` | Run the fill in that page. Nothing runs until you click, unless you turn on "Prepare ahead of the click". |
| `storage` | Keep your settings, rules, exclusions and optional API key on your device. |
| `alarms` | Remove expired AI suggestions on time. |
| `sidePanel` | Show the side panel beside the page. |
| `contextMenus` | Add **Open DevFiller panel** to the toolbar icon's right-click menu. |
| `api.groq.com`, `generativelanguage.googleapis.com` | Send AI requests to the provider you chose, only with AI on. |
| All websites (optional) | Asked for only when you turn on "Prepare ahead of the click". You can decline, and remove it any time in `chrome://extensions`. |
