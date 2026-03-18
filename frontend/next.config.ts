import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async rewrites() {
    // Proxy /api requests to the Python backend to resolve Mixed Content "HTTPS to HTTP" blocking.
    // The browser will securely call /api and Vercel will internally fetch the insecure HTTP endpoint.
    return [
      {
        source: "/api/:path*",
        destination: "http://23.94.151.242:8000/:path*",
      },
    ];
  },
};

export default nextConfig;

