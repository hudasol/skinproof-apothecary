import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Native modules stay on the server and are loaded from node_modules at runtime.
  serverExternalPackages: ['better-sqlite3', 'sharp'],
  poweredByHeader: false,
  // Lets the e2e server build into its own folder beside a running dev server.
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  experimental: {
    serverActions: { bodySizeLimit: '11mb' },
  },
};

export default nextConfig;
