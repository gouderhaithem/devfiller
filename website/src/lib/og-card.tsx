import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";

// The share card for links to devfiller.com: the logo and name, a headline, what DevFiller is in a
// few words, and the side panel on a filled form. Set in Geist (OFL), whose tables the image renderer
// reads in full; the site's Instrument Sans uses font features it doesn't support.
export const ogSize = { width: 1200, height: 630 };

const root = process.cwd();
const asset = (file: string) => readFile(path.join(root, file));
const font = (name: string) => asset(`node_modules/geist/dist/fonts/geist-sans/Geist-${name}.ttf`);
const dataUrl = async (file: string, type: string) => `data:${type};base64,${(await asset(file)).toString("base64")}`;

const TAGS = ["Free", "Chrome · Firefox · Edge", "EN · FR · AR"];

export async function ogCard({ title, subtitle, eyebrow }: { title: string; subtitle: string; eyebrow?: string }) {
  const [regular, semibold, bold, icon, panel] = await Promise.all([
    font("Regular"),
    font("SemiBold"),
    font("Bold"),
    dataUrl("public/generated/icon-256.png", "image/png"),
    dataUrl("public/generated/side-panel.jpg", "image/jpeg"),
  ]);
  const long = title.length > 28;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", overflow: "hidden", fontFamily: "Geist", color: "#ffffff", background: "linear-gradient(140deg, #5c7cf4 0%, #4868dc 55%, #2f4fc8 100%)" }}>
        {/* Soft light behind the screenshot, and a mint glow in the corner. */}
        <div style={{ position: "absolute", right: -140, top: -120, width: 620, height: 620, borderRadius: 620, background: "rgba(255,255,255,0.10)", display: "flex" }} />
        <div style={{ position: "absolute", left: -120, bottom: -160, width: 420, height: 420, borderRadius: 420, background: "rgba(108,228,176,0.20)", display: "flex" }} />

        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: 600, padding: "60px 0 56px 72px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse renders plain img */}
            <img src={icon} width={72} height={72} alt="" style={{ borderRadius: 18, boxShadow: "0 10px 30px rgba(20,30,90,0.35)" }} />
            <div style={{ display: "flex", fontSize: 40, fontWeight: 700, letterSpacing: -1 }}>
              Dev<span style={{ color: "#c9d5ff" }}>Filler</span>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            {eyebrow ? <div style={{ display: "flex", fontSize: 24, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", color: "#6ce4b0", marginBottom: 14 }}>{eyebrow}</div> : null}
            <div style={{ display: "flex", fontSize: long ? 56 : 72, fontWeight: 700, lineHeight: 1.04, letterSpacing: -2, maxWidth: long ? 520 : 470 }}>{title}</div>
            <div style={{ display: "flex", fontSize: 27, fontWeight: 400, lineHeight: 1.35, color: "rgba(255,255,255,0.88)", marginTop: 18 }}>{subtitle}</div>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            {TAGS.map((tag) => (
              <div key={tag} style={{ display: "flex", fontSize: 21, fontWeight: 600, padding: "8px 16px", borderRadius: 999, background: "rgba(255,255,255,0.16)", border: "1px solid rgba(255,255,255,0.28)" }}>
                {tag}
              </div>
            ))}
          </div>
        </div>

        {/* The side panel beside a filled form, bleeding off the right edge. */}
        <div style={{ position: "absolute", left: 640, top: 92, display: "flex", padding: 10, borderRadius: 22, background: "rgba(255,255,255,0.22)", boxShadow: "0 30px 70px rgba(15,25,80,0.45)" }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse renders plain img */}
          <img src={panel} width={704} height={440} alt="" style={{ borderRadius: 14 }} />
        </div>
        <div style={{ position: "absolute", right: 40, bottom: 34, display: "flex", fontSize: 24, fontWeight: 600, color: "#ffffff", padding: "8px 18px", borderRadius: 999, background: "rgba(20,30,90,0.45)" }}>devfiller.com</div>
      </div>
    ),
    {
      ...ogSize,
      fonts: [
        { name: "Geist", data: regular, weight: 400, style: "normal" },
        { name: "Geist", data: semibold, weight: 600, style: "normal" },
        { name: "Geist", data: bold, weight: 700, style: "normal" },
      ],
    },
  );
}
