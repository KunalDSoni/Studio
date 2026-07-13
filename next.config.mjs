/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  // static export for GitHub Pages; BASE_PATH=/Studio is set by the workflow
  output: "export",
  basePath: process.env.BASE_PATH || "",
};

export default nextConfig;
