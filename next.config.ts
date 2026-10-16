import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  serverExternalPackages: ['@prisma/client', 'pg', '@electric-sql/pglite', 'bcryptjs'],
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  typedRoutes: false,
  images: {
    // Every garment image is drawn as local SVG art, so no remote hosts are needed.
    unoptimized: true,
  },
}

export default nextConfig
