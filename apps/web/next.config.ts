import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() { return [{source: "/api/:path*", destination: `${process.env.INTERNAL_API_ORIGIN ?? "http://127.0.0.1:4000"}/api/:path*`}]; },
  transpilePackages: ["@opspilot/contracts"],
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, "../.."),
};

export default nextConfig;
