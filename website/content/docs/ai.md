DevFiller fills recognized fields locally. For fields it doesn't recognize, such as "Favourite framework" or "Warehouse zone", you can let an AI provider suggest relevant values instead of generic words. It's optional, it's off by default, and it uses your own API key.

## Set it up

1. Open **Options → AI**.
2. Pick a **Provider**: **Groq** (the default) or **Gemini**.
3. Paste that provider's key. Get one from the [Groq console](https://console.groq.com/keys) or [Google AI Studio](https://aistudio.google.com/apikey).
4. Click **Test key** to see which models your key can use. This doesn't generate anything.
5. Choose a model, turn on **Use AI for unknown fields**, and click **Save settings**.

Each provider needs its own key. Switching provider selects that provider's default model. Groq is a good choice when Gemini's free tier starts limiting you.

## When requests happen

By default, suggestions are requested when you click Fill, so nothing is generated for forms you never fill. The first fill on a form waits for the suggestions; later fills reuse them from the cache.

**Prepare ahead of the click** generates suggestions as soon as a form appears, so every fill is instant. It uses your quota on every page with a form, including ones you never fill, and it asks for permission to access websites. It's off by default.

One request asks for up to ten suggestions each for up to 30 unknown fields. Recognized fields, custom rules, dropdowns and radio buttons still use the local generator.

## If the provider says no

- **Quota or rate limit:** DevFiller retries briefly, then fills those fields with local values instead.
- **Any other error:** the form is left untouched and the error is shown, so you never get a half-AI, half-random fill without knowing.

A model that your key can't use shows as unavailable; choose another one.

## The suggestion cache

Suggestions are kept in the browser's session memory, per tab, website, language, model and key. Each click uses the next suggestion for each field.

In **Options → AI → Suggestion cache** you can set how long they last (1 to 60 minutes, 5 by default) or clear them now. Restarting the browser, reloading or disabling the extension also clears them.

## What gets sent

Only field descriptions: labels, accessible names, input names and IDs, placeholders, types, limits, and the data language. Values you typed, page addresses and page content are never sent. Labels are sent as the website wrote them, so they can mention something specific to that site. See [Privacy and permissions](/docs/privacy-permissions/).
