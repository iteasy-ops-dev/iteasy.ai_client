/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ['node-ssh', 'ssh2', 'cpu-features', 'sshcrypto'],
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        net: false,
        tls: false,
        fs: false,
        crypto: false,
        stream: false,
        buffer: false,
      };
      
      // SSH 관련 모듈을 클라이언트 사이드에서 제외
      config.externals = [
        ...(config.externals || []),
        'node-ssh',
        'ssh2',
        'cpu-features',
        'sshcrypto'
      ];
    }
    return config;
  }
}

module.exports = nextConfig