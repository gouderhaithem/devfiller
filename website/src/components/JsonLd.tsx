import { jsonLdScript } from "@/lib/seo";

// Structured data for search engines, escaped so no value can close the script tag.
export function JsonLd({ data }: { data: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(data) }} />;
}
