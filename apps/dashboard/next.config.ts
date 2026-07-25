import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@novachat/ui", "@novachat/shared-types"],
  webpack(config, { webpack }) {
    const d3ConstantShim = path.resolve(process.cwd(), "src/lib/d3-constant-shim.js");

    config.plugins.push(
      new webpack.NormalModuleReplacementPlugin(
        /^\.\/constant\.js$/,
        (resource: { context?: string; request: string }) => {
          const context = resource.context ?? "";

          if (context.includes("d3-drag") || context.includes("d3-zoom")) {
            resource.request = d3ConstantShim;
          }
        }
      )
    );

    return config;
  }
};

export default nextConfig;
