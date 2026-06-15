import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/layout/Sidebar";
import MobileTabBar from "@/components/layout/MobileTabBar";

export const metadata: Metadata = {
  title: "총무야 — 모임 경비 관리",
  description:
    "등산·취미 모임의 회차별 경비 일지와 연간 결산을 관리하는 웹 서비스",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" className="h-full">
      <head>
        {/* Pretendard CDN */}
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css"
        />
      </head>
      <body className="min-h-full bg-white text-[#111827]">
        <div className="flex min-h-screen">
          {/* 데스크톱 사이드바 */}
          <Sidebar />
          {/* 본문 (모바일은 하단 탭바 높이만큼 여백) */}
          <main className="flex-1 min-w-0 pb-20 md:pb-0">
            <div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-8 md:py-10">
              {children}
            </div>
          </main>
        </div>
        {/* 모바일 하단 탭바 */}
        <MobileTabBar />
      </body>
    </html>
  );
}
