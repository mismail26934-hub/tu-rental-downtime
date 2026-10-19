import type { NextConfig } from 'next';

const isHttps = (
  process.env.AUTH_URL ||
  process.env.NEXTAUTH_URL ||
  ''
).startsWith('https://');

const securityHeaders: { key: string; value: string }[] = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=()',
  },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'self'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "style-src 'self' 'unsafe-inline'",
      // Next.js + inline theme bootstrap script
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' http://156.67.216.137:* https://156.67.216.137:*",
      "connect-src 'self' http://156.67.216.137:* https://156.67.216.137:* ws://156.67.216.137:* wss://156.67.216.137:*",
      // Izinkan objek untuk memuat sumber daya yang aman
      "object-src 'none'",
    ].join('; '),
  },
];

if (isHttps) {
  securityHeaders.push({
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains',
  });
}

const nextConfig: NextConfig = {
  // Tambahkan baris ini untuk mengizinkan host IP development server Anda
  allowedDevOrigins: ['156.67.216.137'],
  serverExternalPackages: ['bcrypt', 'mysql2', '@resvg/resvg-js'],
  agentRules: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
