// =============================================
// File: app/components/common/Header.tsx
// (전체 코드)
// - 데스크탑 관리자 햄버거 메뉴 복원
// - 모바일에서는 다크모드 스위치를 카테고리 버튼 왼쪽에 배치
// - 즐겨찾기/바로가기 모드 스위치는 아이콘 전용 버튼
// - 모드 스위치는 다크모드에 따라 색상 변경, 테마 스위치와 간격 확대
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
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      <path d="M13.5 2.75 6.8 12.1h4.85L10.5 21.25l6.7-9.35h-4.85l1.15-9.15Z" />
    </svg>
  );
}

function OutlineStarIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      <path d="m12 3.35 2.68 5.43 5.99.87-4.33 4.22 1.02 5.96L12 17.01l-5.36 2.82 1.03-5.96L3.34 9.65l5.98-.87L12 3.35Z" />
    </svg>
  );
}

function detectDarkMode() {
  if (typeof window === 'undefined') return false;

  const html = document.documentElement;
  const body = document.body;

  const hasExplicitDark =
    html.classList.contains('dark') ||
    body?.classList.contains('dark') ||
    html.getAttribute('data-theme') === 'dark' ||
    body?.getAttribute('data-theme') === 'dark' ||
    html.getAttribute('data-color-mode') === 'dark' ||
    body?.getAttribute('data-color-mode') === 'dark';

  if (hasExplicitDark) return true;

  const hasExplicitLight =
    html.classList.contains('light') ||
    body?.classList.contains('light') ||
    html.getAttribute('data-theme') === 'light' ||
    body?.getAttribute('data-theme') === 'light' ||
    html.getAttribute('data-color-mode') === 'light' ||
    body?.getAttribute('data-color-mode') === 'light';

  if (hasExplicitLight) return false;

  return window.matchMedia('(prefers-color-scheme: dark)').matches;
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
  const [isDarkMode, setIsDarkMode] = useState(false);

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

    const apply = () => setIsDarkMode(detectDarkMode());
    apply();

    const html = document.documentElement;
    const body = document.body;

    const observer = new MutationObserver(() => apply());
    observer.observe(html, {
      attributes: true,
      attributeFilter: ['class', 'data-theme', 'data-color-mode', 'style'],
    });

    if (body) {
      observer.observe(body, {
        attributes: true,
        attributeFilter: ['class', 'data-theme', 'data-color-mode', 'style'],
      });
    }

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onMediaChange = () => apply();

    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', onMediaChange);
    } else {
      media.addListener(onMediaChange);
    }

    return () => {
      observer.disconnect();
      if (typeof media.removeEventListener === 'function') {
        media.removeEventListener('change', onMediaChange);
      } else {
        media.removeListener(onMediaChange);
      }
    };
  }, []);

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

  const docBadgeButtonColor = isDarkMode ? '#ffffff' : '#111111';
  const docBadgeButtonHoverColor = isDarkMode ? '#ffffff' : '#000000';

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
              <span
                className="wiki-doc-badge-mode-btn__icon"
                aria-hidden
                style={{ color: docBadgeButtonColor }}
              >
                {docBadgeMode === 'favorites' ? <OutlineStarIcon /> : <OutlineBoltIcon />}
              </span>
            </button>

            <div className="wiki-doc-badge-theme-gap">
              <ThemeToggle />
            </div>
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
              <span
                className="wiki-doc-badge-mode-btn__icon"
                aria-hidden
                style={{ color: docBadgeButtonColor }}
              >
                {docBadgeMode === 'favorites' ? <OutlineStarIcon /> : <OutlineBoltIcon />}
              </span>
            </button>

            <div className="wiki-mobile-theme-toggle wiki-doc-badge-theme-gap--mobile">
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
          width: 38px;
          height: 38px;
          min-width: 38px;
          min-height: 38px;
          padding: 0;
          margin: 0;
          border: none;
          background: transparent;
          box-shadow: none;
          cursor: pointer;
          flex-shrink: 0;
          transition: transform 0.15s ease, opacity 0.15s ease;
        }

        .wiki-doc-badge-mode-btn:hover {
          transform: translateY(-1px);
        }

        .wiki-doc-badge-mode-btn:active {
          transform: translateY(0);
        }

        .wiki-doc-badge-mode-btn__icon {
          width: 28px;
          height: 28px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          line-height: 1;
          transition: color 0.18s ease, opacity 0.18s ease;
        }

        .wiki-doc-badge-mode-btn:hover .wiki-doc-badge-mode-btn__icon,
        .wiki-doc-badge-mode-btn:focus-visible .wiki-doc-badge-mode-btn__icon {
          color: ${docBadgeButtonHoverColor};
        }

        .wiki-doc-badge-mode-btn__icon :global(svg) {
          width: 28px;
          height: 28px;
          display: block;
        }

        .wiki-doc-badge-theme-gap {
          display: flex;
          align-items: center;
          margin-left: 10px;
        }

        .wiki-doc-badge-theme-gap--mobile {
          margin-left: 6px;
        }

        .wiki-doc-badge-mode-btn--mobile {
          width: 36px;
          height: 36px;
          min-width: 36px;
          min-height: 36px;
        }

        .wiki-doc-badge-mode-btn--mobile .wiki-doc-badge-mode-btn__icon,
        .wiki-doc-badge-mode-btn--mobile .wiki-doc-badge-mode-btn__icon :global(svg) {
          width: 26px;
          height: 26px;
        }

        @media (max-width: 768px) {
          .wiki-admin-menu-btn--desktop {
            display: none !important;
          }

          .wiki-mobile-right-tools {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-left: auto;
            flex-shrink: 0;
          }
        }
      `}</style>
    </>
  );
}
