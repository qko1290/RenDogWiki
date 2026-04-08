// =============================================
// File: app/components/common/Header.tsx
// (전체 코드)
// - 데스크탑 관리자 햄버거 메뉴 복원
// - 모바일에서는 다크모드 스위치를 카테고리 버튼 왼쪽에 배치
// - HamburgerMenu는 실제로 열릴 때만 마운트
// =============================================
'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, type SVGProps } from 'react';
import HamburgerMenu from '@/components/common/HamburgerMenu';
import ThemeToggle from '@/components/common/ThemeToggle';
import '@/wiki/css/header.css';
import SearchBox from '@/components/common/SearchBox';
import logo from '../../image/logo.png';
import Image from 'next/image';
import { ModalCard } from '@/components/common/Modal';
import {
  DOC_BADGE_MODE_EVENT,
  DOC_BADGE_MODE_STORAGE_KEY,
  readDocBadgeMode,
  writeDocBadgeMode,
  type DocBadgeMode,
} from '@/wiki/lib/docFavorites';


function OutlineBoltIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      <path d="M13.5 2.75 6.8 12.1h4.85L10.5 21.25l6.7-9.35h-4.85l1.15-9.15Z" />
    </svg>
  );
}

function OutlineStarIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      <path d="m12 3.35 2.68 5.43 5.99.87-4.33 4.22 1.02 5.96L12 17.01l-5.36 2.82 1.03-5.96L3.34 9.65l5.98-.87L12 3.35Z" />
    </svg>
  );
}

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
  const [docBadgeMode, setDocBadgeMode] = useState<DocBadgeMode>('quick');

  const initialMode = useMemo(() => {
    if (typeof window === 'undefined') return DEFAULT_MODE;

    const urlModeRaw = new URLSearchParams(window.location.search).get(MODE_PARAM);
    const storedRaw = window.localStorage.getItem(MODE_STORAGE) || '';

    const urlMode = urlModeRaw && MODE_TAG_SET.has(urlModeRaw as any) ? urlModeRaw : null;
    const stored = storedRaw && MODE_TAG_SET.has(storedRaw as any) ? storedRaw : null;

    return (urlMode ?? stored ?? DEFAULT_MODE) as string;
  }, []);

  const [mode, setMode] = useState<string>(initialMode);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const syncMode = () => setDocBadgeMode(readDocBadgeMode());
    syncMode();

    const onBadgeModeChange = (event: Event) => {
      const next = (event as CustomEvent<{ mode?: DocBadgeMode }>).detail?.mode;
      setDocBadgeMode(next === 'favorites' ? 'favorites' : 'quick');
    };

    const onStorage = (event: StorageEvent) => {
      if (event.key !== DOC_BADGE_MODE_STORAGE_KEY) return;
      syncMode();
    };

    window.addEventListener(DOC_BADGE_MODE_EVENT, onBadgeModeChange as EventListener);
    window.addEventListener('storage', onStorage);

    return () => {
      window.removeEventListener(DOC_BADGE_MODE_EVENT, onBadgeModeChange as EventListener);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  useEffect(() => {
    if (!isMenuOpen) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsMenuOpen(false);
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isMenuOpen]);

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

  const handleModeClick = (next: string) => {
    if (next !== DEFAULT_MODE) {
      setComingSoonOpen(true);
      return;
    }
    applyMode(next);
  };

  const handleToggleDocBadgeMode = () => {
    const nextMode: DocBadgeMode = docBadgeMode === 'favorites' ? 'quick' : 'favorites';
    setDocBadgeMode(nextMode);
    writeDocBadgeMode(nextMode);
  };


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

            <button
              type="button"
              className="wiki-doc-badge-mode-btn"
              onClick={handleToggleDocBadgeMode}
              aria-pressed={docBadgeMode === 'favorites'}
              aria-label={docBadgeMode === 'favorites' ? '즐겨찾기 모드 사용 중. 클릭하면 바로가기 모드로 전환' : '바로가기 모드 사용 중. 클릭하면 즐겨찾기 모드로 전환'}
              title={docBadgeMode === 'favorites' ? '즐겨찾기 모드' : '바로가기 모드'}
            >
              <span className="wiki-doc-badge-mode-btn__icon" aria-hidden>
                {docBadgeMode === 'favorites' ? <OutlineStarIcon /> : <OutlineBoltIcon />}
              </span>
            </button>

            <ThemeToggle />
          </div>

          {!hideAdminMenu && (
            <button
              type="button"
              onClick={() => setIsMenuOpen(true)}
              className="wiki-admin-menu-btn wiki-admin-menu-btn--desktop"
              aria-label="사이드 메뉴 열기"
            >
              ☰
            </button>
          )}

          <div className="wiki-mobile-right-tools">
            <button
              type="button"
              className="wiki-doc-badge-mode-btn wiki-doc-badge-mode-btn--mobile"
              onClick={handleToggleDocBadgeMode}
              aria-pressed={docBadgeMode === 'favorites'}
              aria-label={docBadgeMode === 'favorites' ? '즐겨찾기 모드 사용 중. 클릭하면 바로가기 모드로 전환' : '바로가기 모드 사용 중. 클릭하면 즐겨찾기 모드로 전환'}
              title={docBadgeMode === 'favorites' ? '즐겨찾기 모드' : '바로가기 모드'}
            >
              <span className="wiki-doc-badge-mode-btn__icon" aria-hidden>
                {docBadgeMode === 'favorites' ? <OutlineStarIcon /> : <OutlineBoltIcon />}
              </span>
            </button>

            <div className="wiki-mobile-theme-toggle">
              <ThemeToggle />
            </div>

            <button
              type="button"
              className="wiki-mobile-category-btn"
              onClick={onToggleMobileCategory}
              aria-label={mobileCategoryOpen ? '카테고리 닫기' : '카테고리 열기'}
              aria-expanded={mobileCategoryOpen}
            >
              ☰
            </button>
          </div>

          {isMenuOpen && !hideAdminMenu && (
            <HamburgerMenu
              isOpen={isMenuOpen}
              onClose={() => setIsMenuOpen(false)}
              isLoggedIn={!!user}
              username={user?.minecraft_name || ''}
              uuid={undefined}
              onLogout={handleLogout}
            />
          )}
        </div>
      </header>

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

      <style jsx>{`
        .wiki-admin-menu-btn--desktop {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .wiki-mobile-right-tools {
          display: none;
        }

        .wiki-mobile-theme-toggle {
          display: flex;
          align-items: center;
        }

        .wiki-mobile-theme-toggle :global(.wiki-theme-switch) {
          --width-of-switch: 3.05em;
          --height-of-switch: 1.72em;
          --size-of-icon: 1.16em;
          --slider-offset: 0.28em;
          margin: 0;
        }

        .wiki-doc-badge-mode-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 34px;
          height: 34px;
          padding: 0;
          border-radius: 999px;
          border: 1px solid rgba(111, 76, 255, 0.2);
          background: rgba(255, 255, 255, 0.92);
          color: #6f4cff;
          cursor: pointer;
          box-shadow: 0 8px 20px rgba(17, 24, 39, 0.08);
          transition:
            transform 0.15s ease,
            box-shadow 0.15s ease,
            border-color 0.15s ease,
            background 0.15s ease,
            color 0.15s ease;
        }

        .wiki-doc-badge-mode-btn:hover {
          transform: translateY(-1px);
          border-color: rgba(111, 76, 255, 0.34);
          box-shadow: 0 10px 22px rgba(79, 70, 229, 0.14);
        }

        .wiki-doc-badge-mode-btn:active {
          transform: translateY(0);
        }

        .wiki-doc-badge-mode-btn__icon {
          width: 18px;
          height: 18px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          line-height: 1;
        }

        .wiki-doc-badge-mode-btn__icon :global(svg) {
          width: 18px;
          height: 18px;
          display: block;
        }

        :global(html[data-theme='dark']) .wiki-doc-badge-mode-btn {
          background: rgba(30, 35, 55, 0.96);
          color: #ddd6fe;
          border-color: rgba(167, 139, 250, 0.28);
          box-shadow: 0 10px 24px rgba(0, 0, 0, 0.22);
        }

        :global(html[data-theme='dark']) .wiki-doc-badge-mode-btn:hover {
          border-color: rgba(196, 181, 253, 0.38);
          background: rgba(40, 46, 70, 0.98);
        }

        .wiki-doc-badge-mode-btn--mobile {
          width: 32px;
          height: 32px;
        }

        @media (max-width: 768px) {
          .wiki-admin-menu-btn--desktop {
            display: none !important;
          }

          .wiki-mobile-right-tools {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-left: auto;
            flex-shrink: 0;
          }
          .wiki-doc-badge-mode-btn--mobile {
            min-width: 32px;
            width: 32px;
            height: 32px;
            padding: 0;
          }
        }
      `}</style>
    </>
  );
}