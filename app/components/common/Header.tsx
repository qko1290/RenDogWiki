// =============================================
// File: app/components/common/Header.tsx
// =============================================
'use client';

import Link from "next/link";
import { useEffect, useState } from "react";
import HamburgerMenu from "@/components/common/HamburgerMenu";
import '@/wiki/css/header.css';
import SearchBox from "@/components/common/SearchBox";
import logo from '../../image/logo.png';
import Image from 'next/image';

type WikiHeaderProps = {
  user: {
    id: number;
    username: string;
    minecraft_name: string;
    email: string;
  } | null;
};

export default function WikiHeader({ user }: WikiHeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Esc 키로 닫기
  useEffect(() => {
    if (!isMenuOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsMenuOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isMenuOpen]);

  async function handleLogout() {
    try {
      const res = await fetch('/api/auth/logout', { method: 'POST' });
      if (res.ok) {
        window.location.href = '/';
      } else {
        alert('로그아웃 실패');
      }
    } catch {
      alert('로그아웃 요청 오류');
    }
  }

  return (
    <header className="wiki-header">
      {/* 로고 전체를 하나의 링크로 */}
      <Link href="/wiki" className="wiki-logo flex items-center gap-2 no-underline">
        <Image src={logo} alt="RDWIKI" width={45} height={40} />
        <span>RDWIKI</span>
      </Link>

      <div className="wiki-search-container">
        <SearchBox />
      </div>

      <button
        type="button"
        onClick={() => setIsMenuOpen(true)}
        className="text-black text-2xl absolute top-4 right-4"
        aria-label="사이드 메뉴 열기"
      >
        ☰
      </button>

      <HamburgerMenu
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        isLoggedIn={!!user}
        username={user?.minecraft_name || ''}
        // uuid는 모르면 아예 넘기지 않거나 undefined로
        uuid={undefined}
        onLogout={handleLogout}
      />
    </header>
  );
}
