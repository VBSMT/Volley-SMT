import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Import du calendrier Excel (2 Mo max, vérifié dans l'action).
  experimental: { serverActions: { bodySizeLimit: "3mb" } },
};

export default nextConfig;
