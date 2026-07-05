/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // NOTE: 'standalone' output is intentionally NOT used. It requires creating
  // filesystem symlinks during the trace-copy step, which fails with EPERM on
  // Windows unless Developer Mode / admin privileges are enabled (see DECISIONS.md).
  // The Docker image instead copies full node_modules, which works identically
  // cross-platform and in CI (Linux runners have no such restriction).
  transpilePackages: ['@prospect/shared'],
  env: {
    NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001',
  },
};

module.exports = nextConfig;
