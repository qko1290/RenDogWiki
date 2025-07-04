'use client';

import Link from "next/link";
import { useState } from "react";
import HamburgerMenu from "@/components/common/HamburgerMenu";
import '@/wiki/css/header.css';

type WikiHeaderProps = {
  user: {
    id: number;
    username: string;
    minecraft_name: string;
    email: string;
  } | null;
  // 페이지마다 검색기능/로고 클릭시 이동 등 필요하면 prop으로 확장
};

export default function WikiHeader({ user }: WikiHeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header className="wiki-header">
      <Link href="/" className="wiki-logo">RDWIKI</Link>
      <div className="wiki-search-container">
        <div className="flex items-center justify-center gap-4 w-full">
          <input
            type="text"
            placeholder="검색어를 입력하세요..."
            className="w-1/2 px-4 py-2 rounded bg-slate-700 text-white placeholder-gray-400"
            // onChange={...} 등 검색 커스텀 기능 필요시 prop으로 전달
          />
        </div>
      </div>
      <button
        onClick={() => setIsMenuOpen(true)}
        className="text-black text-2xl absolute top-4 right-4"
      >
        ☰
      </button>
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
