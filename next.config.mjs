/** @param {string} phase */
export default function nextConfig(phase) {
  const isDevServer = phase === "phase-development-server";
  const defaultDistDir =
    isDevServer || process.env.VERCEL ? ".next" : ".next-prod";

  /** @type {import('next').NextConfig} */
  return {
    distDir: process.env.NEXT_DIST_DIR || defaultDistDir,
    transpilePackages: ["three"],
    images: {
      unoptimized: true,
    },
    async headers() {
      return [
        {
          source: "/showcase/:path*",
          headers: [
            {
              key: "Cache-Control",
              value: "public, max-age=31536000, immutable",
            },
          ],
        },
      ];
    },
  };
}
