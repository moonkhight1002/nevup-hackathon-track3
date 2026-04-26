import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    optimizePackageImports: ["recharts", "framer-motion", "@tanstack/react-query"],
  },
};

export default nextConfig;
