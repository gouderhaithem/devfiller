DevFiller is open source under the [MIT license](https://github.com/gouderhaithem/form-filler/blob/main/LICENSE).

## Run it locally

```sh
git clone https://github.com/gouderhaithem/form-filler.git
cd form-filler
npm ci
npm run dev        # options preview and demo forms at http://127.0.0.1:5187
```

| Page | What it's for |
| --- | --- |
| `/` | The options page next to a working demo form |
| `/welcome.html` | The first-install welcome page |
| `/demo.html` | A mixed-language form to test the installed extension on |
| `/dynamic-form.html` | A form that reveals fields after filling |

## Build, test and package

```sh
npm run build              # type-check and build the extension into dist/
npm test                   # unit tests
npx playwright install chromium
npm run test:e2e           # the real extension in Chromium
npm run package            # release/devfiller-<version>.zip for the Chrome Web Store
npm run store-assets       # store screenshots and promo tile
```

Browser tests load the built extension in a throwaway profile and cover toolbar filling, the side panel, settings, exclusions, forms that change, and the AI cache. AI providers are simulated.

## Where things are

| Path | What it holds |
| --- | --- |
| `public/manifest.json` | Permissions, entry points and icons |
| `src/background.ts` | Toolbar action, AI preparation and cache |
| `src/engine.ts` | Field detection and filling |
| `src/data.ts`, `src/samples.ts` | The generator and its samples in three languages |
| `src/gemini.ts` | Groq and Gemini requests |
| `src/sidepanel.tsx`, `src/panel-page.ts` | Side panel and undo |
| `src/main.tsx` | The options page |
| `website/` | This website |

## Contributing

Bug reports and pull requests are welcome on [GitHub](https://github.com/gouderhaithem/form-filler). For a bug, include your browser version, the steps, and a small example form with fictional data. Run the build and both test suites before opening a pull request.
