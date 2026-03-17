// =============================================
// File: app/layout.tsx
// (전체 코드)
// - 기존 metadata / viewport / Analytics 유지
// - 전역 AuthProvider 추가
// =============================================

import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import "@/wiki/css/fonts-kor.css";
import { Analytics } from "@vercel/analytics/react";
import logoImg from "./image/logo.png";
import AuthProvider from "@/components/auth/AuthProvider";

export const dynamic = "force-dynamic";

// NOTE: 배포 도메인을 환경변수로 설정하면 메타데이터/OG에 반영됩니다.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://wiki.example.com";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "RenDog Wiki",
    template: "%s | RenDog Wiki",
  },
  description: "렌독 RPG 비공식 위키",
  applicationName: "RenDog Wiki",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  manifest: "/site.webmanifest",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "RenDog Wiki",
    title: "RenDog Wiki",
    description: "렌독 RPG 비공식 위키",
    locale: "ko_KR",
    images: [
      {
        url: logoImg.src,
        width: logoImg.width,
        height: logoImg.height,
        alt: "RenDog Wiki",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "RenDog Wiki",
    description: "렌독 RPG 비공식 위키",
    images: [logoImg.src],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
  appleWebApp: {
    capable: true,
    title: "RenDog Wiki",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#0ea5e9",
  width: "device-width",
  initialScale: 1,
  colorScheme: "light",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className={inter.className}>
        <AuthProvider>{children}</AuthProvider>
        <Analytics />
      </body>
    </html>
  );
}