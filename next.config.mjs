/** 전체 파일: next.config.mjs
 * - CloudFront/S3 원격 이미지 허용
 * - 다른 설정은 프로젝트에 맞게 추가하세요
 */

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Next/Image가 외부 이미지를 최적화/캐싱할 수 있게 도메인 화이트리스트
    remotePatterns: [
      // CloudFront 기본 도메인 (환경변수로 바꾸고 싶다면 아래 lib/cdn.ts에서 처리)
      { protocol: 'https', hostname: 'd1y7k8qotewoph.cloudfront.net' },

      // 레거시로 본문에 남아 있을 수 있는 S3 도메인들(점진 이전용)
      { protocol: 'https', hostname: 'rdwiki.s3.amazonaws.com' },
      { protocol: 'https', hostname: 'rdwiki.s3.ap-northeast-2.amazonaws.com' },
    ],
  },
  // 필요시 추가:
  // reactStrictMode: true,
  // experimental: { optimizePackageImports: ['lucide-react'] },
};

export default nextConfig;
