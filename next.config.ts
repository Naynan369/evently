import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  allowedDevOrigins: ["localhost", "127.0.0.1"],
  async redirects() {
    if (process.env.NODE_ENV !== "development") return [];
    const canonical = new URL(process.env.APP_URL || "http://localhost:3000");
    if (
      canonical.protocol !== "http:" ||
      !["localhost", "127.0.0.1"].includes(canonical.hostname)
    )
      return [];
    const alias = canonical.hostname === "localhost" ? "127.0.0.1" : "localhost";
    const host = alias + (canonical.port ? ":" + canonical.port : "");
    return [
      {
        source: "/:path((?!api(?:/|$)|_next(?:/|$)).*)",
        // Redirect page visits before cookies or forms are used. API requests
        // still require the exact APP_URL origin; never redirect a mutation.
        has: [
          { type: "header", key: "host", value: host.replaceAll(".", "\\.") },
          { type: "header", key: "accept", value: ".*text/html.*" },
        ],
        destination: canonical.origin + "/:path*",
        permanent: false,
      },
    ];
  },
  outputFileTracingExcludes: {
    "/*": ["./data/**/*", "./test-results/**/*", "./.env*"],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "no-referrer" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
