// =============================================
// File: app/components/common/Header.tsx
// =============================================
'use client';

/**
 * RDWIKI 최상단 헤더 컴포넌트
 * - 로고(홈 이동), 검색창, 햄버거 메뉴(≡) 버튼 포함
 * - 햄버거 메뉴(사이드바) 열기/닫기 상태 관리
 * - 로그인 상태/유저 정보 등 HamburgerMenu에 prop으로 전달
 */

import Link from "next/link";
import { useState } from "react";
import HamburgerMenu from "@/components/common/HamburgerMenu";
import '@/wiki/css/header.css';
import SearchBox from "@/components/common/SearchBox";

// 유저 타입 정의
type WikiHeaderProps = {
  user: {
    id: number;
    username: string;
    minecraft_name: string;
    email: string;
  } | null;
};

/**
 * [WikiHeader 컴포넌트]
 * - RDWIKI 상단 고정 헤더(로고, 검색창, 햄버거 메뉴 버튼)
 * - 햄버거 메뉴 오픈/닫기 상태 관리
 */
export default function WikiHeader({ user }: WikiHeaderProps) {
  // 햄버거 메뉴 오픈 상태
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // 렌더링: 로고, 검색창, 햄버거 버튼, HamburgerMenu
  return (
    <header className="wiki-header">
      {/* 로고: 클릭시 위키 홈 이동 */}
      <Link href="/wiki" className="wiki-logo">
        RDWIKI
      </Link>

      {/* 중앙 검색창 */}
      <div className="wiki-search-container">
        <SearchBox />
      </div>

      {/* 우측 햄버거(≡) 버튼 */}
      <button
        onClick={() => setIsMenuOpen(true)}
        className="text-black text-2xl absolute top-4 right-4"
        aria-label="사이드 메뉴 열기"
      >
        ☰
      </button>

      {/* 햄버거 메뉴: isMenuOpen true일 때만 표시 */}
      {isMenuOpen && (
        <HamburgerMenu
          onClose={() => setIsMenuOpen(false)}
          isLoggedIn={!!user}
          username={user?.minecraft_name || ''}
          uuid={''}
        />
      )}
    </header>
  );
}
