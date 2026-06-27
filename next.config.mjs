/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === 'production';
const repo = 'texture-of-sound';

const nextConfig = {
  output: 'export',
  // GitHub Pages는 https://<user>.github.io/<repo>/ 하위에 서빙되므로 prod에서만 basePath 적용
  basePath: isProd ? `/${repo}` : '',
  assetPrefix: isProd ? `/${repo}/` : '',
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
