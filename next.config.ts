import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["bcrypt", "mysql2"],
  agentRules: false,
};

export default nextConfig;
