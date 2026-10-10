import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [{ source: "/console", destination: "/sandbox", permanent: false }];
  },
};

export default nextConfig;
