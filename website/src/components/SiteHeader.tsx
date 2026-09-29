import Link from "next/link";
import { Logo } from "./Logo";
import { installHref, installLabel, site } from "@/lib/site";

const links = [
  { href: "/docs/", label: "Docs" },
  { href: "/#roadmap", label: "Roadmap" },
  { href: "/privacy/", label: "Privacy" },
  { href: site.repo, label: "GitHub" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-mist bg-paper/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Logo />
        <nav aria-label="Main" className="flex items-center gap-1 sm:gap-2">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="hidden rounded-md px-3 py-2 text-[0.95rem] text-ink-soft hover:text-ink sm:block"
            >
              {link.label}
            </Link>
          ))}
          <Link href="/docs/" className="rounded-md px-3 py-2 text-[0.95rem] text-ink-soft hover:text-ink sm:hidden">
            Docs
          </Link>
          <Link
            href={installHref}
            className="rounded-lg bg-brand px-4 py-2 text-[0.95rem] font-medium text-paper hover:bg-tile-deep"
          >
            {installLabel}
          </Link>
        </nav>
      </div>
    </header>
  );
}
