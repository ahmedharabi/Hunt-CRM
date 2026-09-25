import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The Docker build sets this to ship a self-contained server; `next start`
  // and the desktop app keep using the regular output.
  output: process.env.HUNT_STANDALONE === "1" ? "standalone" : undefined,
  // Native addon: must be required at runtime by Node, never bundled.
  serverExternalPackages: ["better-sqlite3"],
  // `npm run dev:lan` — let phones on the local network load dev assets.
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.*.*.*", "*.local"],
  typedRoutes: true,
  // The badge would sit on the mobile quick-add button (or the sidebar's
  // Settings link). Compile and runtime errors still surface without it.
  devIndicators: false,
};

export default nextConfig;
