import type { MetadataRoute } from "next";
import { DOC_PAGES, docHref } from "@/lib/docs";
import { site } from "@/lib/site";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const paths = ["/", "/reviews/", "/support/", "/privacy/", ...DOC_PAGES.map(docHref)];
  return paths.map((path) => ({ url: `${site.url}${path}` }));
}
