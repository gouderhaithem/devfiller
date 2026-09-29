## From the Chrome Web Store

DevFiller is being prepared for the Chrome Web Store. When the listing is live, the **Install DevFiller** button on this site will take you straight to it.

## Install it from GitHub today

You need [Node.js](https://nodejs.org/) 20 or later and Git.

```sh
git clone https://github.com/gouderhaithem/form-filler.git
cd form-filler
npm ci
npm run build
```

1. Open `chrome://extensions` in Chrome.
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked** and select the `dist` folder you just built. Select the folder itself, not a file inside it.
4. Pin DevFiller from the Extensions menu (the puzzle icon) so the icon stays in your toolbar.

A welcome page opens after the first install. You can reopen it later from the extension's options.

To update, pull the latest code, run `npm run build` again, and click **Reload** on DevFiller's card in `chrome://extensions`. Your settings are kept.

## Fill your first form

1. Open any page with a form, for example a sign-up page on your local development server.
2. Click the DevFiller icon. The fields fill, and the icon shows how many.
3. Click again for a new identity and new values.

If the icon shows `!`, the page couldn't be filled. Browser pages such as `chrome://` pages and the Chrome Web Store don't allow extensions.

## Shortcuts and menus

| Action | How |
| --- | --- |
| Fill the current page | Click the toolbar icon |
| Open the side panel | Press **Alt+Shift+F**, or right-click the icon → **Open DevFiller panel** |
| Open the settings | Right-click the icon → **Options** |

You can change the shortcut at `chrome://extensions/shortcuts`. DevFiller needs Chrome 118 or later.
