import type { NextConfig } from 'next';

/**
 * `/api/*` is proxied to the backend so the browser can use relative
 * paths (`/api/v1/auth/login` etc.) — which is what @forjio/auth-ui
 * and the api.ts client emit. In production nginx also proxies `/api`;
 * this rewrite makes local `next dev` behave the same way.
 */
const API_ORIGIN = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4170';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${API_ORIGIN}/api/:path*` }];
  },
};

export default nextConfig;
