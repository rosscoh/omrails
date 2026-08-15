import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * PGlite ships a WASM binary and postgres.js opens raw TCP sockets. Neither
   * survives being bundled, so both are left as real Node requires at runtime.
   */
  serverExternalPackages: ["@electric-sql/pglite", "postgres"],
};

export default nextConfig;
