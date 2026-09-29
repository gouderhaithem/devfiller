import { DocsNav } from "@/components/DocsNav";
import { DOC_GROUPS, docHref } from "@/lib/docs";

const groups = DOC_GROUPS.map((group) => ({
  title: group.title,
  pages: group.pages.map((page) => ({ href: docHref(page), title: page.title })),
}));

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[14rem_1fr] lg:gap-16 lg:py-14">
      <aside className="lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:self-start lg:overflow-y-auto">
        <details className="rounded-lg border border-mist p-4 lg:hidden">
          <summary className="cursor-pointer font-medium">Documentation menu</summary>
          <div className="mt-4">
            <DocsNav groups={groups} />
          </div>
        </details>
        <div className="hidden lg:block">
          <DocsNav groups={groups} />
        </div>
      </aside>
      <main className="min-w-0">{children}</main>
    </div>
  );
}
