# devfiller.com

The DevFiller website: landing page, documentation, roadmap and privacy policy. Built with Next.js as a static export and deployed to GitHub Pages by `.github/workflows/website.yml` on every push to `main`.

```sh
cd website
npm ci
npm run dev      # http://localhost:3000
npm run build    # static site in out/
```

## Where content comes from

| Content | Source |
| --- | --- |
| Docs pages | `content/docs/*.md`, listed in `src/lib/docs.ts` |
| Field types page | `../FIELD_GUIDE.md` |
| Privacy policy | `../PRIVACY.md` (also used by the Chrome Web Store listing) |
| Hero demo data | The extension's own generator, `../src/data.ts` |
| Icons and screenshots | Copied from the extension by `scripts/sync-assets.mjs` before each build |

To add a docs page, write a Markdown file in `content/docs/` and add it to `DOC_GROUPS` in `src/lib/docs.ts`.

When the Chrome Web Store listing is live, set `chromeStoreUrl` in `src/lib/site.ts`. Every install button then links to the store.
