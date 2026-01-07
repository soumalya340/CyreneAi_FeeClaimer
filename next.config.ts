import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Output configuration for static export
  output: 'standalone',

  // Server external packages for edge runtime compatibility
  serverExternalPackages: [
    "@solana/web3.js",
    "@meteora-ag/dynamic-bonding-curve-sdk",
    "bn.js",
    "bs58",
  ],

  experimental: {
    // Enable experimental features if needed
  },

  // Turbopack configuration (empty for now, using webpack for builds)
  turbopack: {},

  webpack: (config, { isServer, dev }) => {
    // Server-side externals
    if (isServer) {
      config.externals.push(
        "@solana/web3.js",
        "@meteora-ag/dynamic-bonding-curve-sdk",
        "bn.js",
        "bs58"
      );
    }

    // Configure fallbacks for browser compatibility
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
      crypto: false,
      stream: false,
      url: false,
      zlib: false,
      http: false,
      https: false,
      assert: false,
      os: false,
      path: false,
      'pino-pretty': false,
    };

    // Optimize for production builds
    if (!dev) {
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            vendor: {
              test: /[\\/]node_modules[\\/]/,
              name: 'vendors',
              priority: 10,
              chunks: 'all',
            },
            solana: {
              test: /[\\/]node_modules[\\/]@solana[\\/]/,
              name: 'solana',
              priority: 20,
              chunks: 'all',
            },
          },
        },
      };
    }

    return config;
  },

  // Enable compression
  compress: true,

  // Optimize images
  images: {
    unoptimized: true,
    domains: [],
  },

  // Configure headers for better performance
  async headers() {
    return [
      {
        source: '/(.*)',
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
