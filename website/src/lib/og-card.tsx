import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";

// The share card for links to devfiller.com: the brand tile, the icon, a title and a line under it.
export const ogSize = { width: 1200, height: 630 };

export async function ogCard({ title, subtitle }: { title: string; subtitle: string }) {
  const icon = await readFile(path.join(process.cwd(), "public/generated/icon-256.png"));
  const iconSrc = `data:image/png;base64,${icon.toString("base64")}`;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "72px 80px", background: "linear-gradient(135deg, #5c7cf4 0%, #3c60dc 100%)", color: "#ffffff" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse renders plain img */}
          <img src={iconSrc} width={88} height={88} alt="" style={{ borderRadius: 20 }} />
          <div style={{ fontSize: 44, fontWeight: 700, letterSpacing: -1 }}>DevFiller</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: title.length > 40 ? 64 : 78, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2, maxWidth: 1000 }}>{title}</div>
          <div style={{ fontSize: 32, color: "rgba(255,255,255,0.85)", maxWidth: 1000 }}>{subtitle}</div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 26, color: "rgba(255,255,255,0.8)" }}>
          <span>Free Chrome extension · English, French, Arabic</span>
          <span>devfiller.com</span>
        </div>
      </div>
    ),
    ogSize,
  );
}
