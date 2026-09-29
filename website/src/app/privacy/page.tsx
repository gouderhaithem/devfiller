import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Metadata } from "next";
import { Markdown } from "@/components/Markdown";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: "What DevFiller stores on your device, what it sends when AI is on, and what it never does.",
};

export default async function PrivacyPage() {
  // PRIVACY.md at the repository root is the single source for the store listing and this page.
  const policy = await readFile(path.join(process.cwd(), "..", "PRIVACY.md"), "utf8");
  return (
    <main className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
      <Markdown>{policy}</Markdown>
    </main>
  );
}
