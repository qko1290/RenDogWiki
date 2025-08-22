/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // ⚠️ allow-list를 domains로 명시
    domains: ['d1y7k8qotewoph.cloudfront.net'],
    // (선택) 지원 포맷
    formats: ['image/avif', 'image/webp'],
    // (선택) Next 기본 값에 포함돼 있지만 명시해두면 안정적
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
};

export default nextConfig;
