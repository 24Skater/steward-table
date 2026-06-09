import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    reactCompiler: true,
    typedRoutes: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.r2.cloudflarestorage.com",
      },
    ],
  },
};

export default nextConfig;
