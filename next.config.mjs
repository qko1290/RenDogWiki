/** 전체 파일: next.config.mjs */
const nextConfig = {
  images: {
    domains: ['d1y7k8qotewoph.cloudfront.net'],
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes:  [16, 32, 48, 64, 96, 128, 256, 384],
  },
};
export default nextConfig;
