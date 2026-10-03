import Link from "next/link";
import { Markdown } from "./Markdown";
import { docHref, loadDoc, neighbours, type DocPage } from "@/lib/docs";
import { site } from "@/lib/site";
import { JsonLd } from "./JsonLd";
import { articleJsonLd, breadcrumbJsonLd } from "@/lib/seo";

export async function DocArticle({ page }: { page: DocPage }) {
  const markdown = await loadDoc(page);
  const { previous, next } = neighbours(page);
  return (
    <article>
      <JsonLd data={breadcrumbJsonLd([{ name: "Docs", path: "/docs/" }, ...(page.slug ? [{ name: page.title, path: docHref(page) }] : [])])} />
      <JsonLd data={articleJsonLd({ title: page.title, description: page.description, path: docHref(page) })} />
      <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">{page.title}</h1>
      <p className="mt-3 max-w-2xl text-lg text-ink-soft">{page.description}</p>
      <div className="mt-10">
        <Markdown>{markdown}</Markdown>
      </div>
      <nav aria-label="Next and previous pages" className="mt-16 grid gap-4 border-t border-mist pt-8 sm:grid-cols-2">
        {previous ? (
          <Link href={docHref(previous)} className="rounded-lg border border-mist p-4 hover:border-brand">
            <span className="block text-sm text-ink-soft">Previous</span>
            <span className="font-medium">{previous.title}</span>
          </Link>
        ) : (
          <span />
        )}
        {next && (
          <Link href={docHref(next)} className="rounded-lg border border-mist p-4 text-right hover:border-brand">
            <span className="block text-sm text-ink-soft">Next</span>
            <span className="font-medium">{next.title}</span>
          </Link>
        )}
      </nav>
      <p className="mt-8 text-sm text-ink-soft">
        Something wrong or missing on this page?{" "}
        <a href={site.issues} className="text-brand underline underline-offset-4">
          Open an issue
        </a>
        .
      </p>
    </article>
  );
}
