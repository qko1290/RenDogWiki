// File: next.config.js

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: [
      'd1y7k8qotewoph.cloudfront.net',
      'rendog-wiki-images.s3.amazonaws.com',
      'rdwiki.s3.ap-southeast-2.amazonaws.com',
      'rdwiki.s3.ap-northeast-2.amazonaws.com',
      'crafatar.com',
    ],

    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'crafatar.com',
        pathname: '/avatars/**',
      },
      {
        protocol: 'https',
        hostname: 'd1y7k8qotewoph.cloudfront.net',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'rendog-wiki-images.s3.amazonaws.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'rdwiki.s3.ap-southeast-2.amazonaws.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'rdwiki.s3.ap-northeast-2.amazonaws.com',
        pathname: '/**',
      },
    ],

    // webp만 유지
    formats: ['image/webp'],

    // 캐시 유지
    minimumCacheTTL: 60 * 60 * 24 * 30,

    // 후보 수 더 축소
    deviceSizes: [360, 640, 960, 1280],
    imageSizes: [16, 24, 32, 48, 64, 96, 128],
  },

  webpack: (config) => {
    config.ignoreWarnings = [
      {
        module: /keyv[\\/]src[\\/]index\.js/,
        message: /Critical dependency/,
      },
    ];

    return config;
  },
};

module.exports = nextConfig;