import type { NextConfig } from "next";

/** Images come from here, and from the app itself. */
const TMDB_IMAGES = "https://image.tmdb.org";

/**
 * A static policy: nonces need every page rendered per request, which
 * cacheComponents (partial prerendering) rules out, hence 'unsafe-inline'
 * for Next's inline scripts. 'unsafe-eval' only in development (React
 * rebuilds server error stacks with eval). No upgrade-insecure-requests:
 * the e2e server runs over http.
 */
function contentSecurityPolicy(): string {
  const dev = process.env.NODE_ENV === "development";
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${TMDB_IMAGES}`,
    "font-src 'self'",
    "connect-src 'self'",
    "manifest-src 'self'",
    "worker-src 'self'",
    "frame-src 'none'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}

/** On every response. WebAuthn, clipboard and share keep their default (self). */
const securityHeaders = () => [
  { key: "Content-Security-Policy", value: contentSecurityPolicy() },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  {
    key: "Permissions-Policy",
    value:
      "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
  },
  // Ignored over http: no effect locally nor in the e2e.
  { key: "Strict-Transport-Security", value: "max-age=63072000" },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // The phone keeps visited pages 5 minutes: switching tabs or coming back
    // from a movie page is instant. Every change on this phone clears them
    // (server/revalidate.ts); a change on the other phone shows within 5 min.
    staleTimes: { dynamic: 300 },
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders() },
      // After the rule above: for the same key, the last matching rule wins.
      // The invite token is in the path: never sent to another site as Referer.
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
