// =============================================
// File: next.config.js — 전체 코드 (교체용)
// =============================================
/** @type {import('next').NextConfig} */
const nextConfig = {
  // 외부 이미지 허용(Next/Image 사용 시 필요; 일반 <img>에도 무해)
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'crafatar.com', pathname: '/avatars/**' },
      { protocol: 'https', hostname: 'crafthead.net', pathname: '/helm/**' },
      { protocol: 'https', hostname: 'minotar.net', pathname: '/helm/**' },
      { protocol: 'https', hostname: 'mc-heads.net', pathname: '/avatar/**' },
    ],
  },

  // 배포 환경에서 외부 이미지가 아예 요청되지 않는 문제(CSP 차단) 방지
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            // 필요 최소만 지정: img-src 만 완화
            key: 'Content-Security-Policy',
            value: [
              "img-src 'self' https://crafatar.com https://crafthead.net https://minotar.net https://mc-heads.net data: blob:",
            ].join('; '),
          },
        ],
      },
    ];
  },

  // 기존 ignoreWarnings 유지
  webpack: (config) => {
    config.ignoreWarnings = [
      ...(config.ignoreWarnings || []),
      { module: /keyv[\\/]src[\\/]index\.js/, message: /Critical dependency/ },
    ];
    return config;
  },
};

module.exports = nextConfig;
