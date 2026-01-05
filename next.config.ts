import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Output configuration for static export
  output: "standalone",

  // Server external packages for edge runtime compatibility
  serverExternalPackages: [
    "@solana/web3.js",
    "@meteora-ag/dynamic-bonding-curve-sdk",
    "bn.js",
    "bs58",
    "jito-ts",
    "@grpc/grpc-js",
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
    } else {
      // Client-side: prevent bundling Node.js-only packages
      config.externals = config.externals || [];
      if (typeof config.externals === "undefined") {
        config.externals = [];
      }
      if (Array.isArray(config.externals)) {
        config.externals.push("jito-ts", "@grpc/grpc-js");
      } else if (typeof config.externals === "object") {
        config.externals["jito-ts"] = "commonjs jito-ts";
        config.externals["@grpc/grpc-js"] = "commonjs @grpc/grpc-js";
      }
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
      dns: false,
      child_process: false,
      util: false,
      events: false,
      buffer: false,
      process: false,
      "pino-pretty": false,
    };

    // Optimize for production builds
    if (!dev) {
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: "all",
          cacheGroups: {
            vendor: {
              test: /[\\/]node_modules[\\/]/,
              name: "vendors",
              priority: 10,
              chunks: "all",
            },
            solana: {
              test: /[\\/]node_modules[\\/]@solana[\\/]/,
              name: "solana",
              priority: 20,
              chunks: "all",
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
        source: "/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
