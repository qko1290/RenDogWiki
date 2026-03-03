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
      { protocol: 'https', hostname: 'crafatar.com', pathname: '/avatars/**' },
      { protocol: 'https', hostname: 'd1y7k8qotewoph.cloudfront.net', pathname: '/**' },
      { protocol: 'https', hostname: 'rendog-wiki-images.s3.amazonaws.com', pathname: '/**' },
      { protocol: 'https', hostname: 'rdwiki.s3.ap-southeast-2.amazonaws.com', pathname: '/**' },
      { protocol: 'https', hostname: 'rdwiki.s3.ap-northeast-2.amazonaws.com', pathname: '/**' },
    ],

    // ✅ 안전장치 1) 포맷 2배 변환 방지: webp만
    formats: ['image/webp'],

    // ✅ 안전장치 2) 캐시 TTL 상향(초)
    // - Vercel/Next가 허용하는 범위 내에서 "최소" TTL을 잡아, 동일 변환 재사용률을 올림
    // - 30일(= 2592000s)
    minimumCacheTTL: 60 * 60 * 24 * 30,

    // ✅ 안전장치 3) w 후보 수 자체 축소
    deviceSizes: [360, 640, 960, 1280, 1920],
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