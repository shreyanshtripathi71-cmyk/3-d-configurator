import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow large 3D model files to be served
  experimental: {
    largePageDataBytes: 128 * 1024,
  },
  // Ensure static files are properly served
  async headers() {
    return [
      {
        source: '/windows/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
