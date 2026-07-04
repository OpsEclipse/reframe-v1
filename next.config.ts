import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: __dirname,
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
  images: {
    disableStaticImages: true,
  },
};

export default nextConfig;
