import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@novachat/ui", "@novachat/shared-types"]
};

export default nextConfig;
