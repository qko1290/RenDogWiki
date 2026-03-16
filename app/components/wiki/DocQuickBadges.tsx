'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDollarSign, faScroll, faCube, faBoltLightning, faCalculator, faBookOpen } from '@fortawesome/free-solid-svg-icons';

export type DocQuickBadgeItem = {
  icon: 'price' | 'quest' | 'head' | 'collection' | 'calc' ;
  title: string;
  href: string;
};

type Props = {
  items: [DocQuickBadgeItem, DocQuickBadgeItem, DocQuickBadgeItem, DocQuickBadgeItem, DocQuickBadgeItem];
  mainTitle?: string;
  hidden?: boolean;
  expandWidth?: number;
  hoverBg?: string;
  hoverCooldownMs?: number;
  topOffset?: number;
};

function iconByKey(key: DocQuickBadgeItem['icon']) {
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

export default function DocQuickBadges({
  items,
  mainTitle = '바로가기',
  hidden,
  expandWidth = 150,
  hoverBg = 'rgb(255, 69, 69)',
  hoverCooldownMs = 220,
  topOffset = 92,
}: Props) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement | null>(null);

  const [open, setOpen] = useState(false);

  const [hoverLock, setHoverLock] = useState(false);
  const hoverLockTimerRef = useRef<number | null>(null);
  const prevOpenRef = useRef(false);

  const stack = useMemo(() => items.slice(0, 5), [items]);

  const go = (href: string) => {
    router.push(href, { scroll: false });
  };

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

  // 감지 영역
  // 왼쪽 100 / 오른쪽 50 / 위 50 / 아래 180
  useEffect(() => {
    let raf = 0;

    const onMove = (e: MouseEvent) => {
      const el = rootRef.current;
      if (!el) return;

      const rect = el.getBoundingClientRect();

      const cx = rect.left + 23;
      const cy = rect.top + 23;

      const x = e.clientX;
      const y = e.clientY;

      const inside = x >= cx - 100 && x <= cx + 50 && y >= cy - 50 && y <= cy + 180;

      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setOpen(inside));
    };

    window.addEventListener('mousemove', onMove, { passive: true });
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('mousemove', onMove);
    };
  }, []);

  if (hidden) return null;

  return (
    <div
      ref={rootRef}
      className={`qbd-root ${hoverLock ? 'hover-lock' : ''}`}
      style={
        {
          ['--qbd-expand' as any]: `${expandWidth}px`,
          ['--qbd-hover-bg' as any]: hoverBg,
          ['--qbd-top' as any]: `${topOffset}px`,
        } as React.CSSProperties
      }
    >
      {/* 메인: open 되면 숨김 */}
      <button
        type="button"
        className={`qbd-btn qbd-main ${open ? 'is-hidden' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-label={mainTitle}
        title={mainTitle}
        data-label={mainTitle}
      >
        <span className="qbd-ic" aria-hidden>
          <FontAwesomeIcon icon={faBoltLightning} />
        </span>
      </button>

      {/* 메인 아래 말풍선 */}
      <div className={`qbd-bubble ${open ? 'is-hidden' : ''}`} aria-hidden={open}>
        바로가기
      </div>

      {/* 3개: 아래로 펼침 */}
      <div className="qbd-stack" aria-hidden={!open}>
        {stack.map((it, idx) => (
          <button
            key={`${it.href}-${idx}`}
            type="button"
            className={`qbd-btn qbd-item ${open ? 'is-open' : ''}`}
            style={{
              transform: open ? `translateY(${56 * idx}px)` : 'translateY(0px)',
              transitionDelay: open ? `${idx * 55}ms` : '0ms',
            }}
            onClick={() => go(it.href)}
            aria-label={it.title}
            title={it.title}
            data-label={it.title}
          >
            <span className="qbd-ic" aria-hidden>
              <FontAwesomeIcon icon={iconByKey(it.icon)} />
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
          height: 300px;
        }

        .qbd-btn,
        .qbd-stack,
        .qbd-bubble {
          pointer-events: auto;
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
          background-color: rgb(20, 20, 20);
          box-shadow: 0px 0px 20px rgba(0, 0, 0, 0.164);
          transition: width 320ms cubic-bezier(0.22, 1, 0.36, 1),
            border-radius 320ms cubic-bezier(0.22, 1, 0.36, 1),
            background-color 240ms ease,
            box-shadow 240ms ease;
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

        .qbd-root:not(.hover-lock) .qbd-btn:not(.qbd-main):hover::before,
        .qbd-root:not(.hover-lock) .qbd-btn:not(.qbd-main):focus-visible::before {
          width: calc(46px + var(--qbd-expand));
          border-radius: 50px;
          background-color: var(--qbd-hover-bg);
          box-shadow: 0px 0px 22px rgba(0, 0, 0, 0.22);
        }

        .qbd-root:not(.hover-lock) .qbd-btn:not(.qbd-main):hover::after,
        .qbd-root:not(.hover-lock) .qbd-btn:not(.qbd-main):focus-visible::after {
          opacity: 1;
          font-size: 20px;
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
          color: white;
          font-size: 24px;
          z-index: 2;
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

          /* ✅ 뱃지(46px) 중앙 기준 정렬 */
          left: 23px;
          top: 58px;
          transform: translateX(-50%);

          /* ✅ 뱃지 컬러와 맞춤 */
          background: rgb(20, 20, 20);
          color: #fff;

          font-size: 13px;
          font-weight: 700;
          line-height: 1;
          padding: 8px 12px;
          border-radius: 8px;
          white-space: nowrap;

          box-shadow: 0 10px 18px rgba(0, 0, 0, 0.16);
          opacity: 1;
          pointer-events: none;

          transition:
            opacity 220ms ease,
            transform 220ms ease;
        }

        .qbd-bubble::before {
          position: absolute;
          content: '';
          width: 8px;
          height: 8px;

          /* ✅ 말풍선 꼬리도 같은 컬러 */
          background: rgb(20, 20, 20);

          top: -4px;
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
      `}</style>
    </div>
  );
}