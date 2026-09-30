import Link from "next/link";
import { FillDemo } from "@/components/FillDemo";
import { Roadmap } from "@/components/Roadmap";
import { installHref, installLabel } from "@/lib/site";

const FILLS = [
  ["Identity", "Names, usernames, date of birth, age, gender, nationality"],
  ["Contact", "Emails at example.com, fictional phone numbers, websites"],
  ["Work", "Company, job title, department, industry, team size"],
  ["Address", "Street, apartment, city, state or wilaya, postal code, country"],
  ["Numbers and dates", "Quantities, prices, ratings, dates, times, colors, all within the field's limits"],
  ["Text", "Readable words and short sentences, never random strings"],
];

const LEAVES = [
  "Passwords, unless you turn test passwords on",
  "Payment card fields and one-time codes",
  "Consent, terms and newsletter checkboxes",
  "File uploads, hidden, disabled and read-only fields",
  "Search boxes and navigation controls",
  "Any field you exclude, on every site or just one",
];

const PANEL_POINTS = [
  ["Every field, with a reason", "Filled, skipped, or incompatible, and why."],
  ["Fix one field", "Save a custom value or exclude a field for this website."],
  ["Undo last fill", "Restore the previous values, keeping anything you edited since."],
];

export default function Home() {
  return (
    <main>
      <section className="bg-tile text-paper">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_1.05fr] lg:py-24">
          <div>
            <h1 className="text-5xl font-semibold leading-[1.02] tracking-tight sm:text-6xl lg:text-7xl">
              Stop typing test data.
            </h1>
            <p className="mt-6 max-w-lg text-lg text-paper/85">
              DevFiller fills the form you&apos;re testing with realistic, fictional data in one click. It never submits anything,
              and it works without an account.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href={installHref} className="rounded-lg bg-paper px-5 py-3 font-medium text-ink hover:bg-ivory">
                {installLabel}
              </Link>
              <Link href="/docs/" className="rounded-lg px-5 py-3 font-medium text-paper ring-1 ring-paper/40 hover:ring-paper">
                Read the docs
              </Link>
            </div>
            <p className="mt-6 text-paper/75">Free for Chrome. Recognizes English, French and Arabic labels.</p>
          </div>
          <FillDemo />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <h2 className="max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">What it fills, and what it leaves alone</h2>
        <p className="mt-4 max-w-2xl text-ink-soft">
          43 field types, matched by label, name, placeholder or autocomplete. Values fit together: the username and email
          follow the generated name.
        </p>
        <div className="mt-10 grid gap-12 md:grid-cols-2">
          <div>
            <h3 className="text-lg font-semibold">Filled for you</h3>
            <dl className="mt-4 divide-y divide-mist border-y border-mist">
              {FILLS.map(([term, detail]) => (
                <div key={term} className="grid gap-1 py-3 sm:grid-cols-[9rem_1fr]">
                  <dt className="font-medium">{term}</dt>
                  <dd className="text-ink-soft">{detail}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div>
            <h3 className="text-lg font-semibold">Left for you to handle</h3>
            <ul className="mt-4 divide-y divide-mist border-y border-mist">
              {LEAVES.map((item) => (
                <li key={item} className="py-3 text-ink-soft">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="bg-ivory">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[1fr_1.6fr]">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">See every field beside the page</h2>
            <p className="mt-4 text-ink-soft">
              Open the side panel with Alt+Shift+F. It follows the tab you&apos;re on and shows exactly what happened.
            </p>
            <dl className="mt-8 space-y-5">
              {PANEL_POINTS.map(([term, detail]) => (
                <div key={term} className="border-l-2 border-mint pl-4">
                  <dt className="font-medium">{term}</dt>
                  <dd className="text-ink-soft">{detail}</dd>
                </div>
              ))}
            </dl>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element -- static export serves images as-is */}
          <img
            src="/generated/side-panel.jpg"
            alt="A filled form with the DevFiller side panel listing 17 filled and 3 skipped fields"
            width={1280}
            height={800}
            loading="lazy"
            className="w-full rounded-xl border border-mist shadow-[0_20px_50px_-24px_rgba(31,42,92,0.45)]"
          />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="grid gap-10 md:grid-cols-[1fr_1.2fr]">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Nothing leaves your browser unless you turn on AI</h2>
          <div className="space-y-4 text-ink-soft">
            <p>
              Settings stay in local extension storage. There is no DevFiller server, account or analytics, and the values you
              type are never sent anywhere.
            </p>
            <p>
              If you add your own Groq or Gemini key, only field descriptions (labels, names, placeholders and limits) go to that
              provider, to suggest values for unusual fields.
            </p>
            <Link href="/privacy/" className="inline-block font-medium text-brand underline underline-offset-4">
              Read the privacy policy
            </Link>
          </div>
        </div>
      </section>

      <section id="roadmap" className="scroll-mt-20 border-t border-mist">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Roadmap</h2>
          <p className="mt-4 max-w-2xl text-ink-soft">
            The extension is the first step. Next, the same engine as a package you install in your test suite.
          </p>
          <Roadmap />
        </div>
      </section>
    </main>
  );
}
