import type { Metadata } from "next";
import Link from "next/link";
import { SupportForm } from "@/components/SupportForm";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Support",
  description: "Ask a question, report a problem or suggest an idea. DevFiller's maintainer replies by email.",
};

const SELF_HELP = [
  { href: "/docs/limits/", title: "Limits and troubleshooting", text: "Pages DevFiller can't fill, and what to try first." },
  { href: "/docs/how-it-works/", title: "How recognition works", text: "Why a field was filled, skipped or left unknown." },
  { href: "/docs/side-panel/", title: "Fix a field yourself", text: "Set a field's type or value from the side panel." },
  { href: "/docs/privacy-permissions/", title: "Privacy and permissions", text: "What is stored, what is sent, and why." },
];

export default function SupportPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
      <div className="max-w-2xl">
        <p className="text-sm font-semibold tracking-[0.14em] text-brand uppercase">Support</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">How can we help?</h1>
        <p className="mt-4 text-lg text-ink-soft">
          Ask a question, report something that doesn’t work, or suggest an idea. The maintainer reads every message and replies by email.
        </p>
      </div>

      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <SupportForm />

        <aside className="space-y-8">
          <section>
            <h2 className="text-[0.95rem] font-semibold">Quick answers</h2>
            <ul className="mt-3 space-y-2">
              {SELF_HELP.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="group block rounded-xl p-3 ring-1 ring-mist transition hover:bg-mist/40 hover:ring-brand/40">
                    <span className="font-medium text-ink group-hover:text-brand">{item.title}</span>
                    <span className="mt-0.5 block text-sm text-ink-soft">{item.text}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
          <section className="rounded-xl bg-ivory p-4 text-sm text-ink-soft">
            <h2 className="text-[0.95rem] font-semibold text-ink">Prefer to report it in public?</h2>
            <p className="mt-1.5">
              Bugs and ideas are also welcome as{" "}
              <a href={site.issues} className="font-medium text-brand underline-offset-2 hover:underline">
                GitHub issues
              </a>
              , where others can follow them.
            </p>
          </section>
        </aside>
      </div>
    </main>
  );
}
