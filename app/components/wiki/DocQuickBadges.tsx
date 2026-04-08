'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faDollarSign,
  faScroll,
  faCube,
  faBoltLightning,
  faCalculator,
  faBookOpen,
  faStar,
} from '@fortawesome/free-solid-svg-icons';

import type { DocBadgeMode } from '@/wiki/lib/docFavorites';

export type DocQuickBadgeItem = {
  icon?: 'price' | 'quest' | 'head' | 'collection' | 'calc';
  emoji?: string;
  id?: number;
  title: string;
  href: string;
  external?: boolean;
  disabled?: boolean;
};

type Props = {
  items: DocQuickBadgeItem[];
  favoriteItems?: DocQuickBadgeItem[];
  mode?: DocBadgeMode;
  onFavoriteRemove?: (item: DocQuickBadgeItem) => void;
  hidden?: boolean;
  expandWidth?: number;
  hoverBg?: string;
  hoverCooldownMs?: number;
  topOffset?: number;
};

function iconByKey(key: NonNullable<DocQuickBadgeItem['icon']>) {
  switch (key) {
    case 'price':
      return faDollarSign;
    case 'quest':
      return faScroll;
    case 'head':
      return faCube;
    case 'collection':
      return faBookOpen;
    case 'calc':
      return faCalculator;
  }
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

export default function DocQuickBadges({
  items,
  favoriteItems = [],
  mode = 'quick',
  onFavoriteRemove,
  hidden = false,
  expandWidth = 150,
  hoverBg = 'rgb(255, 69, 69)',
  hoverCooldownMs = 220,
  topOffset = 92,
}: Props) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement | null>(null);

  const [open, setOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);

  const [hoverLock, setHoverLock] = useState(false);
  const hoverLockTimerRef = useRef<number | null>(null);
  const prevOpenRef = useRef(false);

  const isFavoritesMode = mode === 'favorites';
  const activeItems = useMemo(() => {
    if (!isFavoritesMode) return items.slice(0, 5);
    return favoriteItems.slice(0, 10);
  }, [favoriteItems, isFavoritesMode, items]);

  const mainTitle = isFavoritesMode ? '즐겨찾기' : '바로가기';
  const mainButtonTitle = mainTitle;
  const activeExpandWidth = isFavoritesMode ? Math.max(expandWidth, 220) : expandWidth;
  const rootHeight = Math.max(120, 90 + Math.max(activeItems.length, 1) * 56);

  const go = (item: DocQuickBadgeItem) => {
    if (hidden || item.disabled) return;

    if (item.external) {
      window.open(item.href, '_blank', 'noopener,noreferrer');
      return;
    }

    router.push(item.href, { scroll: false });
  };


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
    const wasOpen = prevOpenRef.current;
    prevOpenRef.current = open;

    if (!open) {
      setHoverLock(false);
      if (hoverLockTimerRef.current) {
        window.clearTimeout(hoverLockTimerRef.current);
        hoverLockTimerRef.current = null;
      }
      return;
    }

    if (!wasOpen && open) {
      setHoverLock(true);
      if (hoverLockTimerRef.current) window.clearTimeout(hoverLockTimerRef.current);
      hoverLockTimerRef.current = window.setTimeout(() => {
        setHoverLock(false);
        hoverLockTimerRef.current = null;
      }, hoverCooldownMs);
    }
  }, [open, hoverCooldownMs]);

  useEffect(() => {
    if (!hidden) return;

    setOpen(false);
    setHoverLock(false);

    if (hoverLockTimerRef.current) {
      window.clearTimeout(hoverLockTimerRef.current);
      hoverLockTimerRef.current = null;
    }
  }, [hidden]);

  useEffect(() => {
    setOpen(false);
  }, [mode]);

  // 감지 영역
  // 왼쪽 100 / 오른쪽 50 / 위 50 / 아래는 현재 아이템 수만큼 동적 확장
  useEffect(() => {
    let raf = 0;

    const onMove = (e: MouseEvent) => {
      if (hidden) return;

      const el = rootRef.current;
      if (!el) return;

      const rect = el.getBoundingClientRect();

      const cx = rect.left + 23;
      const cy = rect.top + 23;

      const x = e.clientX;
      const y = e.clientY;

      const maxY = cy + 70 + activeItems.length * 56;
      const inside = x >= cx - 100 && x <= cx + 60 && y >= cy - 50 && y <= maxY;

      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setOpen(inside));
    };

    window.addEventListener('mousemove', onMove, { passive: true });
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('mousemove', onMove);
    };
  }, [activeItems.length, hidden]);

  const badgeBaseBg = isDarkMode ? 'rgba(255, 255, 255, 0.96)' : 'rgb(20, 20, 20)';
  const badgeBaseFg = isDarkMode ? '#111827' : '#ffffff';
  const badgeBorder = isDarkMode ? '1px solid rgba(255, 255, 255, 0.55)' : '1px solid rgba(255, 255, 255, 0.08)';
  const badgeShadow = isDarkMode
    ? '0px 0px 24px rgba(0, 0, 0, 0.28)'
    : '0px 0px 20px rgba(0, 0, 0, 0.164)';
  const bubbleBg = isDarkMode ? 'rgba(255, 255, 255, 0.98)' : 'rgb(20, 20, 20)';
  const bubbleFg = isDarkMode ? '#111827' : '#ffffff';
  const bubbleBorder = isDarkMode ? '1px solid rgba(255, 255, 255, 0.55)' : '1px solid rgba(255, 255, 255, 0.08)';

  return (
    <div
      ref={rootRef}
      className={`qbd-root ${hoverLock ? 'hover-lock' : ''} ${hidden ? 'is-hidden' : ''}`}
      aria-hidden={hidden}
      data-mode={mode}
      style={
        {
          ['--qbd-expand' as any]: `${activeExpandWidth}px`,
          ['--qbd-hover-bg' as any]: isFavoritesMode ? '#6f4cff' : hoverBg,
          ['--qbd-top' as any]: `${topOffset}px`,
          ['--qbd-base-bg' as any]: badgeBaseBg,
          ['--qbd-base-fg' as any]: badgeBaseFg,
          ['--qbd-base-border' as any]: badgeBorder,
          ['--qbd-base-shadow' as any]: badgeShadow,
          ['--qbd-bubble-bg' as any]: bubbleBg,
          ['--qbd-bubble-fg' as any]: bubbleFg,
          ['--qbd-bubble-border' as any]: bubbleBorder,
          ['--qbd-root-height' as any]: `${rootHeight}px`,
          ['--qbd-label-size' as any]: isFavoritesMode ? '15px' : '20px',
        } as React.CSSProperties
      }
    >
      <button
        type="button"
        className={`qbd-btn qbd-main ${open ? 'is-hidden' : ''}`}
        onClick={() => {
          if (hidden) return;
          setOpen((v) => !v);
        }}
        aria-label={mainButtonTitle}
        title={mainButtonTitle}
        data-label={mainTitle}
        disabled={hidden}
      >
        <span className="qbd-ic" aria-hidden>
          <FontAwesomeIcon icon={isFavoritesMode ? faStar : faBoltLightning} />
        </span>
      </button>

      <div className={`qbd-bubble ${open ? 'is-hidden' : ''}`} aria-hidden={open || hidden}>
        <span className="qbd-bubble-text">{mainTitle}</span>
      </div>

      <div className="qbd-stack" aria-hidden={!open || hidden}>
        {activeItems.map((it, idx) => (
          <button
            key={`${it.href}-${idx}`}
            type="button"
            className={`qbd-btn qbd-item ${open ? 'is-open' : ''} ${it.disabled ? 'is-disabled' : ''}`}
            style={{
              transform: open ? `translateY(${56 * idx}px)` : 'translateY(0px)',
              transitionDelay: open ? `${idx * 55}ms` : '0ms',
            }}
            onClick={() => go(it)}
            onContextMenu={(e) => {
              if (!isFavoritesMode || !it.id || !onFavoriteRemove || hidden || it.disabled) return;
              e.preventDefault();
              e.stopPropagation();
              onFavoriteRemove(it);
            }}
            aria-label={it.title}
            title={isFavoritesMode && onFavoriteRemove && !it.disabled ? `${it.title} (우클릭으로 해제)` : it.title}
            data-label={it.title}
            disabled={hidden || it.disabled}
          >
            <span className="qbd-ic" aria-hidden>
              {it.emoji ? (
                <span className="qbd-emoji">{it.emoji}</span>
              ) : it.icon ? (
                <FontAwesomeIcon icon={iconByKey(it.icon)} />
              ) : (
                <FontAwesomeIcon icon={faStar} />
              )}
            </span>
          </button>
        ))}
      </div>

      <style jsx>{`
        .qbd-root {
          position: fixed;
          left: 18px;
          top: var(--qbd-top);
          z-index: 80;
          pointer-events: none;
          width: 110px;
          height: var(--qbd-root-height);
          transition:
            opacity 0.18s ease,
            visibility 0.18s ease;
        }

        .qbd-root.is-hidden {
          opacity: 0;
          visibility: hidden;
        }

        .qbd-btn,
        .qbd-stack,
        .qbd-bubble {
          pointer-events: auto;
        }

        .qbd-root.is-hidden .qbd-btn,
        .qbd-root.is-hidden .qbd-stack,
        .qbd-root.is-hidden .qbd-bubble {
          pointer-events: none;
        }

        .qbd-stack {
          position: absolute;
          left: 0;
          top: 0;
          width: 1px;
          height: 1px;
        }

        .qbd-btn {
          position: absolute;
          left: 0;
          top: 0;
          width: 46px;
          height: 46px;
          border-radius: 999px;
          border: none;
          background: transparent;
          cursor: pointer;
          user-select: none;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: visible;
          transition: transform 520ms cubic-bezier(0.22, 1, 0.36, 1), opacity 220ms ease;
        }

        .qbd-btn::before {
          content: '';
          position: absolute;
          inset: 0;
          width: 46px;
          height: 46px;
          border-radius: 999px;
          background-color: var(--qbd-base-bg);
          border: var(--qbd-base-border);
          box-shadow: var(--qbd-base-shadow);
          transition:
            width 320ms cubic-bezier(0.22, 1, 0.36, 1),
            border-radius 320ms cubic-bezier(0.22, 1, 0.36, 1),
            background-color 240ms ease,
            box-shadow 240ms ease,
            border-color 240ms ease;
        }

        .qbd-btn::after {
          content: attr(data-label);
          position: absolute;
          left: 46px;
          top: 50%;
          transform: translateY(-50%);
          color: white;
          font-weight: 700;
          font-size: 2px;
          opacity: 0;
          padding-right: 12px;
          white-space: nowrap;
          pointer-events: none;
          transition: opacity 220ms ease, font-size 240ms ease, transform 240ms ease;
        }

        .qbd-main::after {
          content: '';
          opacity: 0 !important;
          font-size: 0 !important;
        }

        .qbd-root:not(.hover-lock):not(.is-hidden) .qbd-btn:not(.qbd-main):not(.is-disabled):hover::before,
        .qbd-root:not(.hover-lock):not(.is-hidden) .qbd-btn:not(.qbd-main):not(.is-disabled):focus-visible::before {
          width: calc(46px + var(--qbd-expand));
          border-radius: 50px;
          background-color: var(--qbd-hover-bg);
          border-color: transparent;
          box-shadow: 0px 0px 22px rgba(0, 0, 0, 0.22);
        }

        .qbd-root:not(.hover-lock):not(.is-hidden) .qbd-btn:not(.qbd-main):hover::after,
        .qbd-root:not(.hover-lock):not(.is-hidden) .qbd-btn:not(.qbd-main):focus-visible::after {
          opacity: 1;
          font-size: var(--qbd-label-size);
          transform: translateY(-50%);
        }

        .qbd-item.is-disabled {
          cursor: default;
        }

        .qbd-item.is-disabled::before {
          background-color: ${isDarkMode ? 'rgba(255,255,255,0.92)' : 'rgba(20,20,20,0.92)'};
        }

        .qbd-item.is-disabled::after {
          opacity: 1;
          font-size: 14px;
          color: ${isDarkMode ? '#6b7280' : 'rgba(255,255,255,0.82)'};
          transform: translateY(-50%);
        }

        .qbd-ic {
          position: absolute;
          left: 0;
          top: 0;
          width: 46px;
          height: 46px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: var(--qbd-base-fg);
          font-size: 24px;
          z-index: 2;
          transition: color 240ms ease;
        }

        .qbd-emoji {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 22px;
          line-height: 1;
        }

        .qbd-root:not(.hover-lock):not(.is-hidden) .qbd-btn:not(.qbd-main):not(.is-disabled):hover .qbd-ic,
        .qbd-root:not(.hover-lock):not(.is-hidden) .qbd-btn:not(.qbd-main):not(.is-disabled):focus-visible .qbd-ic {
          color: #fff;
        }

        .qbd-main.is-hidden {
          opacity: 0;
          pointer-events: none;
        }

        .qbd-item {
          opacity: 0;
          pointer-events: none;
        }

        .qbd-item.is-open {
          opacity: 1;
          pointer-events: auto;
        }

        .qbd-bubble {
          position: absolute;
          left: 23px;
          top: 58px;
          transform: translateX(-50%);
          background: var(--qbd-bubble-bg);
          color: var(--qbd-bubble-fg);
          border: var(--qbd-bubble-border);
          font-size: 13px;
          line-height: 1;
          padding: 8px 12px;
          border-radius: 8px;
          white-space: nowrap;
          box-shadow: 0 10px 18px rgba(0, 0, 0, 0.16);
          opacity: 1;
          pointer-events: none;
          transition:
            opacity 220ms ease,
            transform 220ms ease,
            background-color 240ms ease,
            color 240ms ease,
            border-color 240ms ease;
        }

        .qbd-bubble-text {
          display: inline-block;
          font-size: ${isDarkMode ? '14px' : '13px'};
          font-weight: ${isDarkMode ? 800 : 700};
          letter-spacing: ${isDarkMode ? '-0.15px' : '0'};
          text-shadow: ${isDarkMode ? '0 0 0.35px currentColor' : 'none'};
        }

        .qbd-bubble::before {
          position: absolute;
          content: '';
          width: 8px;
          height: 8px;
          background: var(--qbd-bubble-bg);
          border-left: var(--qbd-bubble-border);
          border-top: var(--qbd-bubble-border);
          top: -5px;
          left: 50%;
          transform: translateX(-50%) rotate(45deg);
        }

        .qbd-bubble.is-hidden {
          opacity: 0;
          transform: translateX(-50%) translateY(-6px);
        }

        @media (hover: none) {
          .qbd-btn::after {
            display: none;
          }
        }

        .qbd-main .qbd-ic {
          font-size: ${isDarkMode ? '25px' : '24px'};
          font-weight: ${isDarkMode ? 800 : 700};
        }

        .qbd-main .qbd-ic :global(svg) {
          filter: ${isDarkMode
            ? 'drop-shadow(0 0 0.45px currentColor) drop-shadow(0 0 0.45px currentColor)'
            : 'none'};
        }
      `}</style>
    </div>
  );
}
