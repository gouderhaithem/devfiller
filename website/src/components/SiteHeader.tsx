import Link from "next/link";
import { Logo } from "./Logo";
import { installHref, installLabel, site } from "@/lib/site";

const links = [
  { href: "/docs/", label: "Docs" },
  { href: "/#roadmap", label: "Roadmap" },
  { href: "/reviews/", label: "Reviews" },
  { href: "/support/", label: "Support" },
  { href: "/privacy/", label: "Privacy" },
  { href: site.repo, label: "GitHub" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 bg-paper/85 backdrop-blur-md">
      {/* A thin brand line along the bottom, fading out at the edges. */}
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-px bg-linear-to-r from-transparent via-tile/35 to-transparent" />
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Logo />
        <nav aria-label="Main" className="flex items-center gap-1 sm:gap-2">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="hidden rounded-md px-3 py-2 text-[0.95rem] font-medium text-ink-soft transition-colors hover:bg-mist/60 hover:text-ink sm:block"
            >
              {link.label}
            </Link>
          ))}
          <Link href="/docs/" className="rounded-md px-3 py-2 text-[0.95rem] text-ink-soft hover:text-ink sm:hidden">
            Docs
          </Link>
          <Link
            href={installHref}
            className="rounded-lg bg-linear-to-b from-tile-light to-tile-deep px-4 py-2 text-[0.95rem] font-medium text-paper shadow-[0_2px_10px_-3px_rgb(60_96_220/0.6)] transition-[filter,transform] hover:brightness-110 active:translate-y-px whitespace-nowrap"
          >
            {/* Phones keep the header on one line with the short label. */}
            <span className="sm:hidden">Install</span>
            <span className="hidden sm:inline">{installLabel}</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
