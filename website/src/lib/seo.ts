import type { Metadata } from "next";
import { site } from "./site";

// Search and sharing: each page's canonical URL and share card, and the structured data (JSON-LD)
// that tells search engines what DevFiller is.

// Share cards come from app/og: the site's at /og/, a docs page's at /og/docs/<slug>/.
export const SITE_CARD = "/og/";

export function pageMeta({ title, description, path, image = SITE_CARD }: { title: string; description: string; path: string; image?: string }): Metadata {
  const images = [{ url: image, width: 1200, height: 630, alt: title }];
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { type: "website", siteName: site.name, url: path, title, description, images },
    twitter: { card: "summary_large_image", title, description, images },
  };
}

const absolute = (path: string) => new URL(path, site.url).toString();

const author = { "@type": "Person", name: site.author.name, url: site.author.url };

export function appJsonLd(rating: { count: number; average: number | null }) {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: site.name,
    description: site.description,
    url: site.url,
    applicationCategory: "DeveloperApplication",
    applicationSubCategory: "Browser extension",
    operatingSystem: "Chrome, Firefox, Edge",
    image: absolute("/generated/icon-256.png"),
    screenshot: absolute("/generated/side-panel.jpg"),
    ...(site.chromeStoreUrl ? { downloadUrl: site.chromeStoreUrl, installUrl: site.chromeStoreUrl } : {}),
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    inLanguage: ["en", "fr", "ar"],
    license: "https://opensource.org/licenses/MIT",
    author,
    sameAs: [site.repo, ...(site.chromeStoreUrl ? [site.chromeStoreUrl] : []), site.firefoxStoreUrl, site.edgeStoreUrl],
    // Only real, approved reviews: no rating is claimed before there is one.
    ...(rating.count && rating.average !== null
      ? { aggregateRating: { "@type": "AggregateRating", ratingValue: rating.average, reviewCount: rating.count, bestRating: 5, worstRating: 1 } }
      : {}),
  };
}

export function siteJsonLd() {
  return { "@context": "https://schema.org", "@type": "WebSite", name: site.name, url: site.url, publisher: author };
}

export function breadcrumbJsonLd(trail: readonly { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((crumb, i) => ({ "@type": "ListItem", position: i + 1, name: crumb.name, item: absolute(crumb.path) })),
  };
}

export function articleJsonLd({ title, description, path }: { title: string; description: string; path: string }) {
  return { "@context": "https://schema.org", "@type": "TechArticle", headline: title, description, url: absolute(path), author, publisher: author, about: { "@type": "SoftwareApplication", name: site.name } };
}

export function faqJsonLd(items: readonly { question: string; answer: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({ "@type": "Question", name: item.question, acceptedAnswer: { "@type": "Answer", text: item.answer } })),
  };
}

// JSON for a <script type="application/ld+json">, with < escaped so no value can close the tag.
export function jsonLdScript(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
