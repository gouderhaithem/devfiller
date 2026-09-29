import Link from "next/link";

export function Logo({ tone = "ink" }: { tone?: "ink" | "light" }) {
  return (
    <Link href="/" className="flex items-center gap-2.5" aria-label="DevFiller home">
      {/* eslint-disable-next-line @next/next/no-img-element -- static export serves images as-is */}
      <img src="/generated/icon-256.png" alt="" width={32} height={32} className="size-8" />
      <span className={`text-xl font-semibold tracking-tight ${tone === "light" ? "text-paper" : "text-ink"}`}>devfiller</span>
    </Link>
  );
}
