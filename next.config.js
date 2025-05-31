// File: next.config.js

const path = require('path');

const nextConfig = {
  webpack: (config) => {
    config.resolve.alias['@lib'] = path.resolve(__dirname, 'app/wiki/lib');
    return config;
  },
};

module.exports = nextConfig;
