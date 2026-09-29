import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Static HTML for GitHub Pages; there is no server.
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  // The hero demo imports the extension's own generator from ../src.
  turbopack: { root: path.join(__dirname, "..") },
};

export default nextConfig;
