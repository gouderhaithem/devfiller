"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface NavGroup {
  title: string;
  pages: { href: string; title: string }[];
}

export function DocsNav({ groups }: { groups: NavGroup[] }) {
  const pathname = usePathname();
  const current = pathname.endsWith("/") ? pathname : `${pathname}/`;
  return (
    <nav aria-label="Documentation" className="space-y-7">
      {groups.map((group) => (
        <div key={group.title}>
          <h2 className="text-sm font-semibold text-ink">{group.title}</h2>
          <ul className="mt-2 space-y-0.5 border-l border-mist">
            {group.pages.map((page) => {
              const active = page.href === current;
              return (
                <li key={page.href}>
                  <Link
                    href={page.href}
                    aria-current={active ? "page" : undefined}
                    className={`-ml-px block border-l-2 py-1.5 pl-4 text-[0.95rem] ${
                      active ? "border-brand font-medium text-ink" : "border-transparent text-ink-soft hover:text-ink"
                    }`}
                  >
                    {page.title}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
