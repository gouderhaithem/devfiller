import type { Metadata } from "next";
import { DocArticle } from "@/components/DocArticle";
import { findDoc } from "@/lib/docs";

const page = findDoc("")!;

export const metadata: Metadata = { title: "Documentation", description: page.description };

export default function DocsHome() {
  return <DocArticle page={page} />;
}
