import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
