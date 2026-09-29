import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Every page is prebuilt HTML; Vercel serves it without running a server.
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  // The hero demo imports the extension's own generator from ../src.
  turbopack: { root: path.join(__dirname, "..") },
};

export default nextConfig;
