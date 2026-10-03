# devfiller.com

The DevFiller website: landing page, documentation, roadmap, support form and privacy policy. Built with Next.js and hosted on Vercel. Every page is prebuilt; only `/api/support` runs on the server. Vercel deploys `main` to devfiller.com and gives every pull request a preview link. `.github/workflows/website.yml` checks that pull requests lint and build.

```sh
cd website
npm ci
npm run dev      # http://localhost:3000
npm run build    # production build
npm run start    # serve it on http://localhost:3000
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

## Support form

`/support/` posts to `/api/support`, which checks the message and emails it through [Resend](https://resend.com). It accepts posts only from the site itself, ignores bots (a hidden field and a minimum fill time), and allows 5 messages per address every 15 minutes on each server instance. Messages aren't stored. Set these environment variables in Vercel (Settings → Environment Variables, for Production and Preview):

| Variable | Required | Value |
| --- | --- | --- |
| `RESEND_API_KEY` | Yes | The Resend API key (`re_…`). Without it, the form answers that support is unavailable. |
| `SUPPORT_EMAIL_TO` | Yes | Where messages go. It lives only in Vercel, so the address never appears in this public repository. |
| `SUPPORT_EMAIL_FROM` | No | The sender, on a domain verified in Resend, e.g. `DevFiller Support <support@devfiller.com>`. Defaults to `DevFiller Support <onboarding@resend.dev>`, which only delivers to your Resend account's own email address. |

Redeploy after changing a variable. Replying to a support email answers the person who wrote in.

The in-code limit counts per server instance. For a firm limit, add a Vercel Firewall rate-limit rule on `/api/support` (for example 10 requests per 10 minutes per IP).

## Reviews

`/reviews/` and the homepage show the reviews from [Neon](https://neon.tech) Postgres, read at most every five minutes and again as soon as a review is sent. The review form posts to `/api/reviews`, which applies the support form's protections (same origin only, a hidden field, a minimum fill time, 3 reviews per address every 15 minutes) and publishes the review at once. Nothing but the name, optional role, rating, review and date is stored. With no reviews, the pages show an empty state.

| Variable | Required | Value |
| --- | --- | --- |
| `DATABASE_URL` | Yes | The Neon connection string (`postgresql://…?sslmode=require`). Set it in Vercel for Production and Preview, and in `website/.env.local` (git-ignored) to work locally. Without it the pages show the empty state and the form answers that reviews can't be saved. |

Create the table once (safe to run again): `cd website && node scripts/create-reviews-table.mjs`.

Hide or remove a review in Neon's SQL editor; the site picks it up within five minutes:

```sql
SELECT id, name, role, rating, comment, approved, created_at FROM reviews ORDER BY created_at DESC;
UPDATE reviews SET approved = false WHERE id = 42;  -- hide it (true shows it again)
DELETE FROM reviews WHERE id = 43;
```

`vercel.json` skips a deploy when a commit doesn't touch the website or the files it reads.
