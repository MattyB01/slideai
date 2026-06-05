import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Disable Turbopack in favor of webpack
  },
  // Use the built-in webpack-based compiler (not SWC)
  webpack: (config, { isServer }) => {
    return config;
  },
};

export default nextConfig;
