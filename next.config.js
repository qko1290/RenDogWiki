// File: next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Next Optimizer가 신뢰하는 호스트
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

    /**
     * ✅ 변환(Transformations) 폭증 방지 핵심
     * - sizes 후보를 줄여 w 변형 가짓수 자체를 감소
     * - 포맷도 webp만 유지해서 포맷별 중복 변환 줄임
     */
    formats: ['image/webp'],

    // ✅ 위키 레이아웃에서 현실적으로 자주 쓰는 폭만 남김
    deviceSizes: [360, 640, 960, 1280, 1920],

    // ✅ 아이콘/작은 이미지용 (필요 최소)
    imageSizes: [16, 24, 32, 48, 64, 96, 128],
  },

  // ✅ 기존 webpack 경고 무시 설정 그대로 유지
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