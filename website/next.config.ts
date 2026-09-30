import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Every page is still prebuilt HTML. Only /api/support runs on the server, to send support
  // messages without exposing the email key, which a static export can't do.
  trailingSlash: true,
  images: { unoptimized: true },
  // The hero demo imports the extension's own generator from ../src.
  turbopack: { root: path.join(__dirname, "..") },
};

export default nextConfig;
