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

// ✅ 모드 옵션 확장
const MODE_OPTIONS = [
  { label: 'RPG', tag: 'RPG' as const },
  { label: '렌독런', tag: '렌독런' as const },
  { label: '마인팜', tag: '마인팜' as const },
  { label: '부엉이타운', tag: '부엉이타운' as const },
] as const;

const MODE_TAG_SET = new Set(MODE_OPTIONS.map(m => m.tag));
const MODE_PARAM = 'mode';
const MODE_STORAGE = 'wiki:mode';
const MODE_EVENT = 'wiki-mode-change';

export default function WikiHeader({ user }: WikiHeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // 초기 모드: URL > localStorage > null(전체)
  const initialMode = useMemo(() => {
    if (typeof window === 'undefined') return null;
    const urlMode = new URLSearchParams(window.location.search).get(MODE_PARAM);
    const stored = window.localStorage.getItem(MODE_STORAGE) || '';
    const base = urlMode ?? (stored || null);
    return base && MODE_TAG_SET.has(base as any) ? base : null;
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
      if (next) url.searchParams.set(MODE_PARAM, next);
      else url.searchParams.delete(MODE_PARAM);
      window.history.replaceState({}, '', url);

      if (next) localStorage.setItem(MODE_STORAGE, next);
      else localStorage.removeItem(MODE_STORAGE);

      window.dispatchEvent(new CustomEvent(MODE_EVENT, { detail: { mode: next } }));
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

  return (
    <header className="wiki-header">
      <div className="wiki-header-inner">
        {/* 로고 */}
        <Link href="/wiki" className="wiki-logo flex items-center gap-2 no-underline">
          <Image src={logo} alt="RDWIKI" width={45} height={40} />
          <span>RDWIKI</span>
        </Link>

        {/* ✅ 모드 옵션: All + 4개 */}
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
              color: mode === null ? '#6f4cff' : '#6b7280',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            All
          </button>

          {MODE_OPTIONS.map((m) => {
            const active = mode === m.tag;
            return (
              <button
                key={m.tag}
                type="button"
                onClick={() => applyMode(active ? null : m.tag)}
                aria-pressed={active}
                title={`${m.label}만 보기`}
                style={{
                  background: 'transparent',
                  border: 0,
                  padding: 0,
                  fontSize: 15,
                  fontWeight: active ? 800 : 600,
                  letterSpacing: 0.2,
                  color: active ? '#6f4cff' : '#6b7280',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {m.label}
              </button>
            );
          })}
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
      </div>
    </header>
  );
}