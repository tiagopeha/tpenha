import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // O core é publicado como fonte TypeScript dentro do workspace.
  transpilePackages: ['@diamante/core'],
};

export default nextConfig;
