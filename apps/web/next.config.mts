import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    // Next.js 16.3's CLI checker loses the captured `tsc --showConfig` output
    // with Node 24.20. TypeScript 5.9 still exposes the compiler API, so this
    // keeps Next's full production type check without ignoring build errors.
    useTypeScriptCli: false,
  },
  poweredByHeader: false,
  typedRoutes: true,
};

export default nextConfig;
