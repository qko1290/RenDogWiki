// next.config.mjs
/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'd1y7k8qotewoph.cloudfront.net',
      },
    ],
  },
};

export default nextConfig;
