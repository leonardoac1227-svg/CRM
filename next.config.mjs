/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ["@prisma/client", "bcryptjs", "socket.io"],
  },
  async redirects() {
    return [
      { source: "/teo", destination: "/ia", permanent: false },
      { source: "/teo/:path*", destination: "/ia/:path*", permanent: false },
    ];
  },
  images: { remotePatterns: [{ protocol: "https", hostname: "**" }] },
};
export default nextConfig;
