import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "@solana/web3.js",
    "@meteora-ag/dynamic-bonding-curve-sdk",
    "bn.js",
  ],
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push(
        "@solana/web3.js",
        "@meteora-ag/dynamic-bonding-curve-sdk",
        "bn.js"
      );
    }

    // Reduce bundle size by excluding unnecessary modules
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
      crypto: false,
    };

    return config;
  },
  // Enable compression
  compress: true,
  // Optimize images
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
