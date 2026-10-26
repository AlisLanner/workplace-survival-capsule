import type { NextConfig } from "next";

/**
 * 同源转发：浏览器统一访问相对 /api 路径，由 Next 服务端转发到本机 Express 后端。
 * 流式接口（/api/assessment/message/stream）依赖 rewrites 的透传语义，
 * 不在中间层读取完整响应；BACKEND_ORIGIN 由启动器注入，默认为本机视觉版后端。
 * node_modules 通过 junction 指向原预览工程的依赖，Turbopack 封闭构建需要把
 * 解析根放宽到两个工程的共同父目录。
 */
const backendOrigin = process.env.BACKEND_ORIGIN || "http://127.0.0.1:17877";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  images: { unoptimized: true },
  turbopack: process.env.TURBOPACK_ROOT ? { root: process.env.TURBOPACK_ROOT } : undefined,
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${backendOrigin}/api/:path*`,
      },
      {
        source: "/health",
        destination: `${backendOrigin}/health`,
      },
    ];
  },
};
export default nextConfig;
