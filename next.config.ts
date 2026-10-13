import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["bcrypt", "mysql2", "@resvg/resvg-js"],
  agentRules: false,
};

export default nextConfig;
