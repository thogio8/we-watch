import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  images: {
    // TMDB already serves the sizes we need; skip Vercel Hobby's optimisation quota.
    unoptimized: true,
    remotePatterns: [{ protocol: "https", hostname: "image.tmdb.org" }],
  },
};

export default nextConfig;
