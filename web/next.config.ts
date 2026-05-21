import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  allowedDevOrigins: ['10.251.251.120', 'localhost', '127.0.0.1'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: 'firebasestorage.googleapis.com' },
      { protocol: 'https', hostname: 'avatars.githubusercontent.com' },
      { protocol: 'https', hostname: '*.githubusercontent.com' },
    ],
  },
  // Required for AG Grid
  transpilePackages: ['ag-grid-react', 'ag-grid-community'],
  async headers() {
    if (process.env.NODE_ENV === 'development') {
      const devCsp =
        "default-src 'self' 'unsafe-inline' 'unsafe-eval' data:; script-src 'self' 'unsafe-eval' 'unsafe-inline' https: http:; style-src 'self' 'unsafe-inline' https: http:; font-src 'self' https: http: data:; img-src 'self' data: https: http: blob:; connect-src 'self' ws: wss: http: https:; frame-src 'self' https: http: data: about:;";
      return [
        {
          source: '/(.*)',
          headers: [
            {
              key: 'Content-Security-Policy',
              value: devCsp,
            },
          ],
        },
      ];
    }
    return [];
  },
};

export default nextConfig;
