import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DocArticle } from "@/components/DocArticle";
import { DOC_PAGES, docHref, findDoc } from "@/lib/docs";
import { pageMeta } from "@/lib/seo";

// Every docs page is known at build time; anything else is a 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return DOC_PAGES.filter((page) => page.slug).map((page) => ({ slug: page.slug }));
}

export async function generateMetadata(props: PageProps<"/docs/[slug]">): Promise<Metadata> {
  const page = findDoc((await props.params).slug);
  return page ? pageMeta({ title: page.title, description: page.description, path: docHref(page), image: `/og/docs/${page.slug}/` }) : {};
}

export default async function DocPage(props: PageProps<"/docs/[slug]">) {
  const page = findDoc((await props.params).slug);
  if (!page) notFound();
  return <DocArticle page={page} />;
}
