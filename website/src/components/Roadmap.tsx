import Link from "next/link";

type Status = "Available" | "In design" | "Planned";

const STEPS: { status: Status; title: string; body: string; href?: string; link?: string }[] = [
  {
    status: "Available",
    title: "Chrome extension 1.0",
    body: "One-click filling, the side panel with undo, custom values, exclusions, English, French and Arabic, and optional AI with your own key. The Chrome Web Store listing is on its way; until then, install it from GitHub.",
    href: "/docs/install/",
    link: "Install it",
  },
  {
    status: "In design",
    title: "devfiller on npm",
    body: "The same field detection and data generator as a dev dependency, so your Playwright, Cypress and Vitest suites fill forms with realistic data instead of hard-coded strings.",
    href: "/docs/npm-package/",
    link: "Read the draft",
  },
  {
    status: "Planned",
    title: "Edge and Firefox",
    body: "Store releases for Microsoft Edge and Firefox, once each browser is tested end to end.",
  },
  {
    status: "Planned",
    title: "Repeatable and custom data",
    body: "Seeded fills that produce the same data every run, custom generators for patterns, UUIDs and ranges, and support for frames, shadow DOM and custom dropdowns.",
  },
];

const badge: Record<Status, string> = {
  Available: "bg-mint-pale text-ink",
  "In design": "bg-mist text-brand",
  Planned: "bg-ivory text-ink-soft",
};

export function Roadmap() {
  return (
    <ol className="relative mt-10 space-y-10 border-l-2 border-mist pl-8 sm:pl-10">
      {STEPS.map((step, index) => (
        <li key={step.title} className="relative max-w-2xl">
          <span
            aria-hidden
            className={`absolute -left-[2.6rem] top-0.5 flex size-8 items-center justify-center rounded-full text-sm font-semibold sm:-left-[3.1rem] ${
              step.status === "Available" ? "bg-mint text-ink" : "border-2 border-mist bg-paper text-ink-soft"
            }`}
          >
            {index + 1}
          </span>
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-xl font-semibold">{step.title}</h3>
            <span className={`rounded-full px-2.5 py-0.5 text-sm ${badge[step.status]}`}>{step.status}</span>
          </div>
          <p className="mt-2 text-ink-soft">{step.body}</p>
          {step.href && (
            <Link href={step.href} className="mt-2 inline-block font-medium text-brand underline underline-offset-4">
              {step.link}
            </Link>
          )}
        </li>
      ))}
    </ol>
  );
}
