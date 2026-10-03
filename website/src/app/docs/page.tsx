import type { Metadata } from "next";
import { DocArticle } from "@/components/DocArticle";
import { findDoc } from "@/lib/docs";
import { pageMeta } from "@/lib/seo";

const page = findDoc("")!;

export const metadata: Metadata = pageMeta({
  title: "Documentation",
  description: "How to install DevFiller, fill a form with test data, fix a field from the side panel, and the 46 field types it recognizes.",
  path: "/docs/",
});

export default function DocsHome() {
  return <DocArticle page={page} />;
}
