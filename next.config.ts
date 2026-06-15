import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // unpdf(pdfjs 번들)는 서버 외부 패키지로 두어 서버리스에서 안전하게 로드
  serverExternalPackages: ["unpdf"],
};

export default nextConfig;
