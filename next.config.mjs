// next.config.mjs
/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'd1y7k8qotewoph.cloudfront.net', // CloudFront 도메인
      },
      {
        protocol: 'https',
        hostname: 'rendog-wiki-images.s3.amazonaws.com', // 혹시 직접 참조할 때 대비
      }
    ],
  },
};

export default nextConfig;
