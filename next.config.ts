import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    optimizePackageImports: ["lucide-react", "@mui/material", "@mui/icons-material"],
  },
  images: {
    disableStaticImages: true,
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      "figma:asset": path.resolve(__dirname, "src/assets"),
    };
    return config;
  },
};

export default nextConfig;
