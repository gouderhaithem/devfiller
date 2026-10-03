import { ogCard } from "@/lib/og-card";

// The site's share card, at a final URL (/og/): metadata images would redirect to add the slash.
export const dynamic = "force-static";

export function GET() {
  return ogCard({ title: "Stop typing test data.", subtitle: "Fill any web form with realistic, fictional data in one click." });
}
