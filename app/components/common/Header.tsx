// =============================================
// File: app/components/common/Header.tsx
// =============================================
'use client';

/**
 * RDWIKI 최상단 헤더 컴포넌트
 * - 로고(홈 이동), 검색창, 햄버거 메뉴(≡) 버튼 포함
 * - 우측 상단에서 HamburgerMenu 열기/닫기 관리
 * - 로그인 상태/유저 정보 등 HamburgerMenu에 prop으로 전달
 */

import Link from "next/link";
import { useState } from "react";
import HamburgerMenu from "@/components/common/HamburgerMenu";
import '@/wiki/css/header.css';

// Props 및 타입 선언
type WikiHeaderProps = {
  user: {
    id: number;
    username: string;
    minecraft_name: string;
    email: string;
  } | null;
};

// 메인 컴포넌트
export default function WikiHeader({ user }: WikiHeaderProps) {
  // 1. 햄버거 메뉴(사이드바) 오픈 상태 관리
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // 렌더링: 로고, 검색창, 메뉴버튼, HamburgerMenu
  return (
    <header className="wiki-header">
      {/* 1. 로고(클릭시 홈 이동) */}
      <Link href="/wiki" className="wiki-logo">RDWIKI</Link>

      {/* 2. 검색창 */}
      <div className="wiki-search-container">
        <div className="flex items-center justify-center gap-4 w-full">
          <input
            type="text"
            placeholder="검색어를 입력하세요..."
            className="w-1/2 px-4 py-2 rounded bg-slate-700 text-white placeholder-gray-400"
          />
        </div>
      </div>

      {/* 3. 햄버거(≡) 버튼: 클릭시 메뉴 오픈 */}
      <button
        onClick={() => setIsMenuOpen(true)}
        className="text-black text-2xl absolute top-4 right-4"
      >
        ☰
      </button>

      {/* 4. HamburgerMenu: isMenuOpen true면 오픈 */}
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
