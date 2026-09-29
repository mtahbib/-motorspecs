import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The embedded demo database ships WebAssembly + data files; keep it (and the
  // Postgres client) as regular Node modules instead of bundling them.
  serverExternalPackages: ["@electric-sql/pglite", "postgres"],
  experimental: {
    serverActions: {
      // Vehicle photos and customer documents are limited to 10 MB each.
      bodySizeLimit: "25mb",
    },
    // Proxy buffers request bodies; keep its limit in line with uploads.
    proxyClientMaxBodySize: "25mb",
  },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/public/**" }],
  },
};

export default nextConfig;
