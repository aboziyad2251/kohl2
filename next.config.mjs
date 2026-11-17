/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  async headers() {
    return ['/auth/forgot-password', '/api/auth/providers', '/login'].map(source => ({
      source, headers: [{ key: 'Cache-Control', value: 'no-store, max-age=0' }],
    }));
  },
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
