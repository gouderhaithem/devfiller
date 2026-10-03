import { DOC_PAGES, findDoc } from "@/lib/docs";
import { ogCard } from "@/lib/og-card";

// Each docs page's share card, built with the site: /og/docs/<slug>/.
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return DOC_PAGES.filter((page) => page.slug).map((page) => ({ slug: page.slug }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const page = findDoc((await params).slug);
  return ogCard({ eyebrow: "Docs", title: page?.title ?? "Documentation", subtitle: page?.description ?? "How DevFiller fills forms with test data." });
}
