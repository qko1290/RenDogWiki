// =============================================
// File: next.config.js — 전체 코드 (교체용)
// =============================================
/** @type {import('next').NextConfig} */
const nextConfig = {
  // 프록시를 쓰므로 외부 도메인 허용은 필수는 아님(남겨도 무해)
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'crafatar.com', pathname: '/avatars/**' },
      { protocol: 'https', hostname: 'crafthead.net', pathname: '/helm/**' },
      { protocol: 'https', hostname: 'minotar.net', pathname: '/helm/**' },
      { protocol: 'https', hostname: 'mc-heads.net', pathname: '/avatar/**' },
    ],
  },

  // 문서 단위 CSP에 의해 새로고침에서만 이미지가 막히는 현상 방지
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            // 프록시(동일 출처)로만 이미지 로드 → 'self'면 충분. data: / blob:은 UI 아이콘 등 대비
            value: "img-src 'self' data: blob:;",
          },
        ],
      },
    ];
  },

  // 브라우저에서 사용할 배포 식별자(캐시 버스터)
  env: {
    NEXT_PUBLIC_DEPLOY_COMMIT:
      process.env.VERCEL_GIT_COMMIT_SHA ||
      process.env.VERCEL_DEPLOYMENT_ID ||
      'dev',
  },

  webpack: (config) => {
    config.ignoreWarnings = [
      ...(config.ignoreWarnings || []),
      { module: /keyv[\\/]src[\\/]index\.js/, message: /Critical dependency/ },
    ];
    return config;
  },
};

module.exports = nextConfig;
