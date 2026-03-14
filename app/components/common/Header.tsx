// =============================================
// File: app/components/common/Header.tsx
// (전체 코드)
// =============================================
'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import HamburgerMenu from '@/components/common/HamburgerMenu';
import '@/wiki/css/header.css';
import SearchBox from '@/components/common/SearchBox';
import logo from '../../image/logo.png';
import Image from 'next/image';
import { ModalCard } from '@/components/common/Modal';

type WikiHeaderProps = {
  user: {
    id: number;
    username: string;
    minecraft_name: string;
    email: string;
  } | null;
  onQuestNpcClick?: (id: number) => void;
  mobileCategoryOpen?: boolean;
  onToggleMobileCategory?: () => void;
  hideAdminMenu?: boolean;
};

// ✅ 모드 옵션 (All 제거)
const MODE_OPTIONS = [
  { label: 'RPG', tag: 'RPG' as const },
  { label: '렌독런', tag: '렌독런' as const },
  { label: '마인팜', tag: '마인팜' as const },
  { label: '부엉이타운', tag: '부엉이타운' as const },
] as const;

const DEFAULT_MODE = 'RPG';
const MODE_TAG_SET = new Set(MODE_OPTIONS.map((m) => m.tag));

const MODE_PARAM = 'mode';
const MODE_STORAGE = 'wiki:mode';
const MODE_EVENT = 'wiki-mode-change';

export default function WikiHeader({
  user,
  mobileCategoryOpen = false,
  onToggleMobileCategory,
  hideAdminMenu = false,
  onQuestNpcClick,
}: WikiHeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [comingSoonOpen, setComingSoonOpen] = useState(false);

  // ✅ 초기 모드: URL > localStorage > DEFAULT_MODE
  const initialMode = useMemo(() => {
    if (typeof window === 'undefined') return DEFAULT_MODE;

    const urlModeRaw = new URLSearchParams(window.location.search).get(MODE_PARAM);
    const storedRaw = window.localStorage.getItem(MODE_STORAGE) || '';

    const urlMode = urlModeRaw && MODE_TAG_SET.has(urlModeRaw as any) ? urlModeRaw : null;
    const stored = storedRaw && MODE_TAG_SET.has(storedRaw as any) ? storedRaw : null;

    return (urlMode ?? stored ?? DEFAULT_MODE) as string;
  }, []);

  const [mode, setMode] = useState<string>(initialMode);

  // Esc로 관리자 햄버거 닫기
  useEffect(() => {
    if (!isMenuOpen) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsMenuOpen(false);
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isMenuOpen]);

  // ✅ 모드 적용: 항상 유효 태그만
  const applyMode = (next: string) => {
    const safe = MODE_TAG_SET.has(next as any) ? next : DEFAULT_MODE;

    setMode(safe);

    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set(MODE_PARAM, safe);
      window.history.replaceState({}, '', url);

      window.localStorage.setItem(MODE_STORAGE, safe);

      window.dispatchEvent(
        new CustomEvent(MODE_EVENT, { detail: { mode: safe } })
      );
    }
  };

  // ✅ RPG 외 모드는 준비중 모달 띄우고 차단
  const handleModeClick = (next: string) => {
    if (next !== DEFAULT_MODE) {
      setComingSoonOpen(true);
      return;
    }
    applyMode(next);
  };

  // ✅ 최초 렌더에서 URL/LS가 비어있으면 기본값 반영
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const url = new URL(window.location.href);
    const cur = url.searchParams.get(MODE_PARAM);

    if (!cur || !MODE_TAG_SET.has(cur as any)) {
      const safe = mode || DEFAULT_MODE;
      url.searchParams.set(MODE_PARAM, safe);
      window.history.replaceState({}, '', url);
      window.localStorage.setItem(MODE_STORAGE, safe);
      window.dispatchEvent(
        new CustomEvent(MODE_EVENT, { detail: { mode: safe } })
      );
    }
  }, [mode]);

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
    <>
      <header className="wiki-header">
        <div className="wiki-header-inner">
          {/* 로고 */}
          <Link href="/wiki" className="wiki-logo flex items-center gap-2 no-underline">
            <Image
              src={logo}
              alt="RDWIKI"
              width={45}
              height={40}
              style={{ imageRendering: 'auto' }}
            />
            <span>RDWIKI</span>
          </Link>

          {/* ✅ 데스크톱에서만 보일 영역 */}
          <div className="wiki-header-desktop-tools">
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
              {MODE_OPTIONS.map((m) => {
                const active = mode === m.tag;
                const isBlocked = m.tag !== DEFAULT_MODE;

                return (
                  <button
                    key={m.tag}
                    type="button"
                    onClick={() => handleModeClick(m.tag)}
                    aria-pressed={active}
                    title={isBlocked ? `${m.label} 준비중` : `${m.label} 보기`}
                    className={`wiki-mode-chip ${active ? 'active' : ''}`}
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
                      opacity: isBlocked ? 0.72 : 1,
                    }}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>

            <div className="wiki-search-container">
              <SearchBox onQuestNpcClick={onQuestNpcClick} />
            </div>
          </div>

          {/* ✅ 모바일 카테고리 햄버거 */}
          <button
            type="button"
            className="wiki-mobile-category-btn"
            onClick={onToggleMobileCategory}
            aria-label={mobileCategoryOpen ? '카테고리 닫기' : '카테고리 열기'}
            aria-expanded={mobileCategoryOpen}
          >
            ☰
          </button>
          
          {/* ✅ 기존 관리자 메뉴 햄버거 */}
          {!hideAdminMenu && (
            <>
              <button
                type="button"
                onClick={() => setIsMenuOpen(true)}
                className="wiki-admin-menu-btn"
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
            </>
          )}
        </div>
      </header>

      {/* 준비중 모달 */}
      <ModalCard
        open={comingSoonOpen}
        onClose={() => setComingSoonOpen(false)}
        title="안내"
        actions={
          <button
            className="rd-btn danger"
            onClick={() => setComingSoonOpen(false)}
          >
            확인
          </button>
        }
        width={360}
      >
        <p
          className="rd-card-description"
          style={{ textAlign: 'center', whiteSpace: 'pre-line' }}
        >
          준비중입니다!
        </p>
      </ModalCard>
    </>
  );
}