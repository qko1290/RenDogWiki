// =============================================
// File: app/components/common/Header.tsx
// =============================================
'use client';

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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

// 단일 모드만 사용: newbie
const ONLY_MODE = { label: '뉴비', tag: 'newbie' as const };

export default function WikiHeader({ user }: WikiHeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // 초기 모드: URL > localStorage > null(전체)
  const initialMode = useMemo(() => {
    if (typeof window === 'undefined') return null;
    const urlMode = new URLSearchParams(window.location.search).get('mode');
    const stored = window.localStorage.getItem('wiki:mode') || '';
    const base = urlMode ?? (stored || null);
    return base === ONLY_MODE.tag ? base : null;
  }, []);
  const [mode, setMode] = useState<string | null>(initialMode);

  // Esc로 햄버거 닫기
  useEffect(() => {
    if (!isMenuOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsMenuOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isMenuOpen]);

  // 모드 적용: URL/로컬스토리지/이벤트 동기화
  const applyMode = (next: string | null) => {
    setMode(next);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (next) url.searchParams.set('mode', next);
      else url.searchParams.delete('mode');
      window.history.replaceState({}, '', url);

      if (next) localStorage.setItem('wiki:mode', next);
      else localStorage.removeItem('wiki:mode');

      window.dispatchEvent(new CustomEvent('wiki-mode-change', { detail: { mode: next } }));
    }
  };

  async function handleLogout() {
    try {
      const res = await fetch('/api/auth/logout', { method: 'POST' });
      if (res.ok) window.location.href = '/';
      else alert('로그아웃 실패');
    } catch {
      alert('로그아웃 요청 오류');
    }
  }

  const isNewbie = mode === ONLY_MODE.tag;

  return (
    <header className="wiki-header">
      {/* 로고 */}
      <Link href="/wiki" className="wiki-logo flex items-center gap-2 no-underline">
        <Image src={logo} alt="RDWIKI" width={45} height={40} />
        <span>RDWIKI</span>
      </Link>

      {/* 모드 옵션: All / 뉴비 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          marginLeft: 12,
          marginRight: 12,
          flexShrink: 0,
        }}
        aria-label="모드 선택"
      >
        <button
          type="button"
          onClick={() => applyMode(null)}
          aria-pressed={mode === null}
          title="전체 보기"
          style={{
            background: 'transparent',
            border: 0,
            padding: 0,
            fontSize: 15,
            fontWeight: mode === null ? 800 : 600,
            letterSpacing: 0.2,
            color: mode === null ? '#6f4cff' : '#6b7280', // active: 거의 검정, inactive: 회색
            cursor: 'pointer',
          }}
        >
          All
        </button>
        <button
          type="button"
          onClick={() => applyMode(isNewbie ? null : ONLY_MODE.tag)}
          aria-pressed={isNewbie}
          title="뉴비만 보기"
          style={{
            background: 'transparent',
            border: 0,
            padding: 0,
            fontSize: 15,
            fontWeight: isNewbie ? 800 : 600,
            letterSpacing: 0.2,
            color: isNewbie ? '#6f4cff' : '#6b7280',
            cursor: 'pointer',
          }}
        >
          {ONLY_MODE.label}
        </button>
      </div>

      {/* 검색 */}
      <div className="wiki-search-container">
        <SearchBox />
      </div>

      {/* 햄버거 */}
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
        uuid={undefined}
        onLogout={handleLogout}
      />
    </header>
  );
}
