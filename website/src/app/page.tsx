import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { FillDemo } from "@/components/FillDemo";
import { ReviewsSection } from "@/components/ReviewsSection";
import { Roadmap } from "@/components/Roadmap";
import { listApprovedReviews } from "@/lib/reviews-db";
import { summarize } from "@/lib/reviews";
import { SITE_CARD, appJsonLd, faqJsonLd, siteJsonLd } from "@/lib/seo";
import { installHref, installLabel } from "@/lib/site";

const FILLS = [
  ["Identity", "Names, usernames, date of birth, age, gender, nationality"],
  ["Contact", "Emails at example.com, fictional phone numbers, websites"],
  ["Work", "Company, job title, department, industry, team size"],
  ["Address", "Street, city or commune, district or daira, state or wilaya, postal code and country, all from one country"],
  ["Numbers and dates", "Quantities, prices, ratings, dates and times, within the field's limits; end dates after start dates"],
  ["Measurements and codes", "Lengths, weights and thicknesses sized for their unit, order and invoice numbers that look real"],
  ["Text", "Readable words and short sentences, never random strings"],
  ["Sensitive fields", "Values anyone can tell are tests: the 4242 test card, codes of 4s, a test IBAN, consent boxes ticked"],
];

const LEAVES = [
  "Passwords, unless you turn test passwords on",
  "Card, bank and code fields, if you choose to leave them empty",
  "File uploads, hidden, disabled and read-only fields",
  "Search boxes and navigation controls",
  "Any field you exclude, on every site or just one",
];

const HOW_IT_WORKS = [
  ["Read every clue", "The label, name, placeholder, autocomplete, units such as (mm) or (kg), and the answers a list offers."],
  ["Score the candidates", "Clues that agree add up, clues that contradict push a type down, and close calls stay unknown."],
  ["Read the form", "Confirmation fields, start and end dates, card sections and the form's type, from the fields around each one."],
  ["Fit the page", "Values follow the field's rules, and a value the site rejects is written another way."],
];

// Plain answers to what people ask before installing; also published as FAQ structured data.
const FAQ = [
  { question: "Is DevFiller free?", answer: "Yes. DevFiller is a free Chrome extension, open source under the MIT license, with no account, no subscription and no usage limit." },
  { question: "Does DevFiller submit the form?", answer: "No. It fills the fields and stops, so you can check the values and submit the form yourself when you're ready." },
  { question: "What test data does it generate?", answer: "Realistic, fictional data for 46 field types: names, usernames, emails at example.com, phone numbers, addresses from one country (the United States, France or Algeria), companies, job titles, dates, numbers and messages. The username and email match the name, and confirmation fields repeat what they confirm." },
  { question: "Does it work with React, Vue and Angular forms?", answer: "Yes. DevFiller sets each value the way frameworks notice a person typing, and it also fills custom switches, checkboxes, dropdowns and rich-text editors built with ARIA roles." },
  { question: "Does it recognize French and Arabic forms?", answer: "Yes. It reads labels in English, French and Arabic, generates data in any of the three languages, and knows Algeria's 69 wilayas and its communes." },
  { question: "What about passwords, credit cards and one-time codes?", answer: "Card fields get sandbox test cards such as 4242 4242 4242 4242, one-time codes get 444444 and bank fields a test IBAN, so anyone can tell they are tests. Password fields stay empty unless you turn on test passwords, and you can exclude any field." },
  { question: "Does DevFiller send my data anywhere?", answer: "No. There is no DevFiller server, account or analytics, and settings stay in your browser. Only if you turn on AI suggestions with your own Groq or Gemini key are field descriptions (labels, names, placeholders) sent to that provider." },
  { question: "How accurate is it?", answer: "On about 500 real-world forms from public websites (2,500 hand-labelled fields in English, French and Arabic), DevFiller filled 93.5% of the fields with a value that fits them and got 1.9% wrong." },
];

const PANEL_POINTS = [
  ["Every field, with a reason", "Filled, skipped, or incompatible, and why."],
  ["What each field was recognized as", "Its type, how sure DevFiller is, and the clues behind it."],
  ["Fix one field", "Set its type, save a custom value, or exclude it for this website."],
  ["Undo last fill", "Restore the previous values, keeping anything you edited since."],
];

export const metadata: Metadata = {
  alternates: { canonical: "/" },
  openGraph: { url: "/", images: [{ url: SITE_CARD, width: 1200, height: 630, alt: "DevFiller: fill any form with realistic test data in one click" }] },
  twitter: { card: "summary_large_image", images: [SITE_CARD] },
};

// Reviews are read again at most every five minutes, and at once when one is sent.
export const revalidate = 300;

export default async function Home() {
  const reviews = await listApprovedReviews();
  return (
    <main>
      <JsonLd data={appJsonLd(summarize(reviews))} />
      <JsonLd data={siteJsonLd()} />
      <JsonLd data={faqJsonLd(FAQ)} />
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
          46 field types in English, French and Arabic. Values fit together: the username and email follow the generated
          name, and the address and phone number come from one country.
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
        <h2 className="max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">It reads the field before it fills it</h2>
        <p className="mt-4 max-w-2xl text-ink-soft">
          DevFiller weighs every clue a field gives and fills it only when the evidence is strong enough. When it isn&apos;t sure,
          it leaves the field unknown rather than guess wrong.
        </p>
        <ol className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {HOW_IT_WORKS.map(([term, detail], index) => (
            <li key={term} className="border-t-2 border-mint pt-4">
              <span className="text-sm font-semibold text-brand">{index + 1}</span>
              <h3 className="mt-1 font-semibold">{term}</h3>
              <p className="mt-2 text-ink-soft">{detail}</p>
            </li>
          ))}
        </ol>
        <Link href="/docs/how-it-works/" className="mt-8 inline-block font-medium text-brand underline underline-offset-4">
          How recognition works
        </Link>
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

      <section id="reviews" className="scroll-mt-20 border-t border-mist">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Reviews</h2>
          <p className="mt-4 max-w-2xl text-ink-soft">What developers and testers say after using DevFiller on their own forms.</p>
          <ReviewsSection reviews={reviews} limit={3} />
        </div>
      </section>

      <section id="faq" className="scroll-mt-20 border-t border-mist bg-ivory">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Questions about DevFiller</h2>
          <div className="mt-8 divide-y divide-mist border-y border-mist">
            {FAQ.map((item) => (
              <details key={item.question} className="group py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-medium">
                  {item.question}
                  <span aria-hidden="true" className="text-2xl leading-none text-ink-soft transition-transform group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-3 max-w-3xl text-ink-soft">{item.answer}</p>
              </details>
            ))}
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
