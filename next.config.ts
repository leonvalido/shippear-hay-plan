import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Event images come from many public sources; the optimizer serves 64px / 200px variants instead of originals.
    remotePatterns: [{ protocol: "https", hostname: "**" }, { protocol: "http", hostname: "**" }],
    deviceSizes: [375, 640, 828, 1080, 1280],
    imageSizes: [64, 128, 200, 400],
  },
};

export default nextConfig;
