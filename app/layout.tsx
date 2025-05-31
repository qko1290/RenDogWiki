// File: app/layout.tsx

/**
 * Next.js 앱 전체 레이아웃
 * - 글로벌 폰트/스타일/메타데이터 설정
 * - 인증(세션) AuthProviderWrapper로 감쌈
 */

import type { Metadata } from "next";
import { Inter } from 'next/font/google';
import "./globals.css";
import { AuthProviderWrapper } from "./providers";

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: "RenDog Wiki",
  description: "Microsoft OAuth 기반 인증 적용 중",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className={inter.className}>
        <AuthProviderWrapper>{children}</AuthProviderWrapper>
      </body>
    </html>
  );
}
