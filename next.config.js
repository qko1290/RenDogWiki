// File: next.config.js
const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Next Optimizer가 신뢰하는 호스트(도메인도 함께 지정)
    domains: [
      'd1y7k8qotewoph.cloudfront.net',
      'rendog-wiki-images.s3.amazonaws.com',
      'rdwiki.s3.ap-southeast-2.amazonaws.com',
      'rdwiki.s3.ap-northeast-2.amazonaws.com',
      'crafatar.com',
    ],
    remotePatterns: [
      { protocol: 'https', hostname: 'crafatar.com', pathname: '/avatars/**' },

      // CloudFront + S3 원본들 (모두 허용)
      { protocol: 'https', hostname: 'd1y7k8qotewoph.cloudfront.net', pathname: '/**' },
      { protocol: 'https', hostname: 'rendog-wiki-images.s3.amazonaws.com', pathname: '/**' },
      { protocol: 'https', hostname: 'rdwiki.s3.ap-southeast-2.amazonaws.com', pathname: '/**' },
      { protocol: 'https', hostname: 'rdwiki.s3.ap-northeast-2.amazonaws.com', pathname: '/**' },
    ],

    // 선택: 최적화 포맷/사이즈
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes:  [16, 32, 48, 64, 96, 128, 256, 384],
  },

  // ✅ 기존 webpack 경고 무시 설정 그대로 유지
  webpack: (config) => {
    config.ignoreWarnings = [
      { module: /keyv[\\/]src[\\/]index\.js/, message: /Critical dependency/ },
    ];
    return config;
  },
};

module.exports = nextConfig;
