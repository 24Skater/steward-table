import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Standalone output exists for the Docker image, which copies a self-contained
   * server. It is skipped when NEXT_DISABLE_STANDALONE is set, which the E2E
   * suite does: `next start` cannot serve standalone output, and the standalone
   * server itself cannot resolve pnpm's symlinked node_modules on every
   * platform. Both failure modes look like "every element is missing" rather
   * than like a server problem, which is a slow thing to diagnose.
   */
  ...(process.env.NEXT_DISABLE_STANDALONE ? {} : { output: "standalone" as const }),
  typedRoutes: true,
  experimental: {
    // @ts-ignore nodeMiddleware added in Next.js 15.3; types lag behind
    nodeMiddleware: true,
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
