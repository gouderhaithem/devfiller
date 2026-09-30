import Link from "next/link";

// The wordmark: "Dev" in ink, "Filler" in the icon's indigo, like the tile it sits beside.
export function Logo({ tone = "ink" }: { tone?: "ink" | "light" }) {
  const light = tone === "light";
  return (
    <Link href="/" className="group flex items-center gap-2.5" aria-label="DevFiller home">
      {/* eslint-disable-next-line @next/next/no-img-element -- static export serves images as-is */}
      <img
        src="/generated/icon-256.png"
        alt=""
        width={32}
        height={32}
        className="size-8 rounded-[9px] shadow-[0_2px_8px_-2px_rgb(72_104_220/0.45)] transition-transform duration-200 group-hover:-rotate-6"
      />
      <span className="text-[1.3rem] leading-none font-bold tracking-[-0.03em]">
        <span className={light ? "text-paper" : "text-ink"}>Dev</span>
        <span className={light ? "text-mint" : "bg-linear-to-r from-tile-deep to-tile-light bg-clip-text text-transparent"}>Filler</span>
      </span>
    </Link>
  );
}
