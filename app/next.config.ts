import type { NextConfig } from "next";

const ngrokHost = (process.env.NEXT_PUBLIC_BASE_URL || "")
  .replace("https://", "")
  .replace("http://", "");

const nextConfig: NextConfig = {
  allowedDevOrigins: ngrokHost ? [ngrokHost] : [],
};

export default nextConfig;
