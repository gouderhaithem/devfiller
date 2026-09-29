# devfiller.com

The DevFiller website: landing page, documentation, roadmap and privacy policy. Built with Next.js as a static export and hosted on Vercel, which deploys `main` to devfiller.com and gives every pull request a preview link. `.github/workflows/website.yml` checks that pull requests lint and build.

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

## Vercel project settings

- **Root Directory:** `website`
- **Include files outside the Root Directory:** on (the build reads `../PRIVACY.md`, `../FIELD_GUIDE.md`, `../src/data.ts` and the extension's icons)
- **Domains:** `devfiller.com` and `www.devfiller.com`

`vercel.json` skips a deploy when a commit doesn't touch the website or the files it reads.
