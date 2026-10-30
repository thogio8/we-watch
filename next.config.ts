import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // The phone keeps visited pages 5 minutes: switching tabs or coming back
    // from a movie page is instant. Every change on this phone clears them
    // (server/revalidate.ts); a change on the other phone shows within 5 min.
    staleTimes: { dynamic: 300 },
  },
  // The invite token is in the path: never sent to another site as Referer.
  async headers() {
    return [
      {
        source: "/invitation/:token*",
        headers: [{ key: "Referrer-Policy", value: "no-referrer" }],
      },
    ];
  },
  images: {
    // TMDB already serves the sizes we need; skip Vercel Hobby's optimisation quota.
    unoptimized: true,
    remotePatterns: [{ protocol: "https", hostname: "image.tmdb.org" }],
  },
};

export default nextConfig;
