import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 서버 외부 패키지(번들에 포함하지 않고 node_modules 그대로 트레이싱)
  //  - unpdf(pdfjs 번들): 서버리스에서 안전하게 로드
  //  - @sparticuz/chromium: bin/ 의 chromium 바이너리가 번들러에 의해 누락/이동되지
  //    않도록 반드시 외부화 (Sparticuz/chromium#bundler-configuration 권장)
  //  - puppeteer-core: chromium 과 함께 외부에 둠
  serverExternalPackages: ["unpdf", "@sparticuz/chromium", "puppeteer-core"],
  // @sparticuz/chromium 은 bin/ 바이너리를 런타임 동적 경로(../../bin)로 읽어
  // NFT 정적 분석이 못 따라가 누락된다. export 라우트들에 bin/*.br 을 강제 포함.
  outputFileTracingIncludes: {
    "/api/export/**": ["./node_modules/@sparticuz/chromium/bin/**"],
  },
};

export default nextConfig;
