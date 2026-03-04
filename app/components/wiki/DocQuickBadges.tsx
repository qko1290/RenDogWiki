'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

export type DocQuickBadgeItem = {
  icon: string;
  title: string;
  href: string;
};

type Props = {
  items: [DocQuickBadgeItem, DocQuickBadgeItem, DocQuickBadgeItem];
  mainIcon?: string;
  mainTitle?: string;
  hidden?: boolean;

  /** hover 시 알약 확장 폭(텍스트 영역 포함) */
  expandWidth?: number;

  /** hover 시 알약 배경색 */
  hoverBg?: string;

  /** 펼침 중 hover 잠금 시간(ms) */
  hoverCooldownMs?: number; // default 650
};

export default function DocQuickBadges({
  items,
  mainIcon = '📌',
  mainTitle = '바로가기',
  hidden,
  expandWidth = 150,
  hoverBg = 'rgb(255, 69, 69)',
  hoverCooldownMs = 650,
}: Props) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement | null>(null);

  const [open, setOpen] = useState(false);

  // ✅ 펼침 직후 hover 확장 잠금(깜빡임 방지)
  const [hoverLock, setHoverLock] = useState(false);
  const hoverLockTimerRef = useRef<number | null>(null);

  const stack = useMemo(() => items.slice(0, 3), [items]);

  const go = (href: string) => {
    router.push(href, { scroll: false });
  };

  // ✅ open이 true로 들어가면 일정 시간 hover 확장 막기
  useEffect(() => {
    if (!open) {
      setHoverLock(false);
      if (hoverLockTimerRef.current) {
        window.clearTimeout(hoverLockTimerRef.current);
        hoverLockTimerRef.current = null;
      }
      return;
    }

    setHoverLock(true);

    if (hoverLockTimerRef.current) window.clearTimeout(hoverLockTimerRef.current);
    hoverLockTimerRef.current = window.setTimeout(() => {
      setHoverLock(false);
      hoverLockTimerRef.current = null;
    }, hoverCooldownMs);

    return () => {
      if (hoverLockTimerRef.current) {
        window.clearTimeout(hoverLockTimerRef.current);
        hoverLockTimerRef.current = null;
      }
    };
  }, [open, hoverCooldownMs]);

  // ✅ 감지 영역(직사각형)
  // - 위로 180px
  // - 왼쪽 100px 허용
  // - 오른쪽 50px
  useEffect(() => {
    let raf = 0;

    const onMove = (e: MouseEvent) => {
      const el = rootRef.current;
      if (!el) return;

      const rect = el.getBoundingClientRect();

      // 메인 원(46px) 중심
      const cx = rect.left + 23;
      const cy = rect.bottom - 23;

      const x = e.clientX;
      const y = e.clientY;

      const inside = x >= cx - 100 && x <= cx + 50 && y <= cy && y >= cy - 180;

      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        setOpen(inside);
      });
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
        } as React.CSSProperties
      }
      aria-label="문서 바로가기"
    >
      {/* 메인: open 되면 숨김 */}
      <button
        type="button"
        className={`qbd-btn qbd-main ${open ? 'is-hidden' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={mainTitle}
        title={mainTitle}
        data-label={mainTitle}
      >
        <span className="qbd-ic" aria-hidden>
          {mainIcon}
        </span>
      </button>

      {/* 3개: “메인 원 위치(바닥)”부터 시작 */}
      <div className="qbd-stack" aria-hidden={!open}>
        {stack.map((it, idx) => (
          <button
            key={`${it.href}-${idx}`}
            type="button"
            className={`qbd-btn qbd-item ${open ? 'is-open' : ''}`}
            style={{
              transform: open ? `translateY(${-56 * idx}px)` : 'translateY(0px)',
              transitionDelay: open ? `${idx * 55}ms` : '0ms',
            }}
            onClick={() => go(it.href)}
            aria-label={it.title}
            title={it.title}
            data-label={it.title}
          >
            <span className="qbd-ic" aria-hidden>
              {it.icon}
            </span>
          </button>
        ))}
      </div>

      <style jsx>{`
        .qbd-root {
          position: fixed;
          left: 18px;
          bottom: 18px;
          z-index: 80;

          /* ✅ 화면 클릭 방해 금지 */
          pointer-events: none;

          width: 64px;
          height: 220px;
        }

        .qbd-btn,
        .qbd-stack {
          pointer-events: auto;
        }

        .qbd-stack {
          position: absolute;
          left: 0;
          bottom: 0;
          width: 1px;
          height: 1px;
        }

        /* =========================
           버튼(원) + 레퍼런스 알약 확장 스타일
           ========================= */
        .qbd-btn {
          position: absolute;
          left: 0;
          bottom: 0;

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

        /* 기본 원 배경 */
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
            background-color 240ms ease, box-shadow 240ms ease;
        }

        /* 텍스트 */
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

        /* ✅ 메인 원은 hover 확장/텍스트 표시 절대 금지 */
        .qbd-main::after {
          content: '';
          opacity: 0 !important;
          font-size: 0 !important;
        }

        /* ✅ hover 확장: 메인 제외 + (핵심) hover-lock 동안은 비활성 */
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
          font-size: 13px;
          transform: translateY(-50%);
        }

        .qbd-btn:focus-visible {
          outline: none;
        }

        /* 아이콘: 고정 */
        .qbd-ic {
          position: absolute;
          left: 0;
          top: 0;
          width: 46px;
          height: 46px;

          display: inline-flex;
          align-items: center;
          justify-content: center;

          font-size: 18px;
          line-height: 1;

          z-index: 2;
          color: white;
          transform: none;
        }

        /* open 시 메인 원 숨김 */
        .qbd-main.is-hidden {
          opacity: 0;
          pointer-events: none;
        }

        /* 펼침 버튼 visibility */
        .qbd-item {
          opacity: 0;
          pointer-events: none;
        }
        .qbd-item.is-open {
          opacity: 1;
          pointer-events: auto;
        }

        /* 모바일: hover 없음 → 텍스트 숨김 */
        @media (hover: none) {
          .qbd-btn::after {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}