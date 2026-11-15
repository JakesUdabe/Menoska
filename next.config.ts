import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Hostinger sirve archivos. `output: "export"` escribe el sitio en `out/`.
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
