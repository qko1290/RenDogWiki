// File: next.config.js

const path = require('path');

/** @type {import('next').NextConfig} */

const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'crafatar.com', pathname: '/avatars/**' },
    ],
  },
}

module.exports = {
  webpack: (config) => {
    config.ignoreWarnings = [
      { module: /keyv[\\/]src[\\/]index\.js/, message: /Critical dependency/ },
    ];
    return config;
  },
};
