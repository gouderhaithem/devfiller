import Link from "next/link";
import { Logo } from "./Logo";
import { site } from "@/lib/site";

const groups = [
  {
    title: "Product",
    links: [
      { href: "/docs/install/", label: "Install" },
      { href: "/docs/", label: "Documentation" },
      { href: "/#roadmap", label: "Roadmap" },
    ],
  },
  {
    title: "Project",
    links: [
      { href: site.repo, label: "Source code" },
      { href: site.issues, label: "Report an issue" },
      { href: "/privacy/", label: "Privacy policy" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-mist bg-ivory">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:grid-cols-[2fr_1fr_1fr] sm:px-6">
        <div className="max-w-xs">
          <Logo />
          <p className="mt-3 text-[0.95rem] text-ink-soft">
            Fictional test data for the forms you build. Free and open source under the MIT license.
          </p>
        </div>
        {groups.map((group) => (
          <div key={group.title}>
            <h2 className="text-[0.95rem] font-semibold">{group.title}</h2>
            <ul className="mt-3 space-y-2">
              {group.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-[0.95rem] text-ink-soft hover:text-ink">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </footer>
  );
}
