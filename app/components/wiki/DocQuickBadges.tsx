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

  /** 알약 확장 길이(텍스트 영역 포함) */
  expandWidth?: number; // default 170
};

export default function DocQuickBadges({
  items,
  mainIcon = '📌',
  mainTitle = '바로가기',
  hidden,
  expandWidth = 170,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const closeTimerRef = useRef<number | null>(null);

  const safeOpen = () => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setOpen(true);
  };

  const safeClose = () => {
    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = window.setTimeout(() => {
      setOpen(false);
      closeTimerRef.current = null;
    }, 140);
  };

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    };
  }, []);

  const stack = useMemo(() => items.slice(0, 3), [items]);

  const go = (href: string) => {
    router.push(href, { scroll: false });
  };

  if (hidden) return null;

  return (
    <div
      className="qbd-root"
      onMouseEnter={safeOpen}
      onMouseLeave={safeClose}
      onFocusCapture={safeOpen}
      onBlurCapture={(e) => {
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        safeClose();
      }}
      style={{ ['--qbd-expand' as any]: `${expandWidth}px` } as React.CSSProperties}
    >
      {/* “가까이 대면 펼쳐짐” 히트박스 */}
      <div className="qbd-hitbox" />

      {/* 메인 */}
      <button
        type="button"
        className={`qbd-btn qbd-main ${open ? 'is-open' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={mainTitle}
        title={mainTitle}
      >
        <span className="qbd-ic" aria-hidden>
          {mainIcon}
        </span>
        <span className="qbd-text">{mainTitle}</span>
      </button>

      {/* 3개 */}
      <div className="qbd-stack" aria-hidden={!open}>
        {stack.map((it, idx) => (
          <button
            key={`${it.href}-${idx}`}
            type="button"
            className={`qbd-btn qbd-item ${open ? 'is-open' : ''}`}
            style={{
              transform: open ? `translateY(${-56 * (idx + 1)}px)` : 'translateY(0px)',
              transitionDelay: open ? `${idx * 40}ms` : '0ms',
            }}
            onClick={() => go(it.href)}
            aria-label={it.title}
            title={it.title}
          >
            <span className="qbd-ic" aria-hidden>
              {it.icon}
            </span>
            <span className="qbd-text">{it.title}</span>
          </button>
        ))}
      </div>

      <style jsx>{`
        .qbd-root {
          position: fixed;
          left: 18px;
          bottom: 18px;
          z-index: 80;
          pointer-events: none;
          width: 64px;
          height: 220px;
          pointer-events: auto;
        }

        .qbd-hitbox,
        .qbd-btn,
        .qbd-stack {
        pointer-events: auto;
        }

        .qbd-hitbox {
          position: absolute;
          width: 170px;
          height: 170px;
          left: -8px;
          bottom: -8px;
          border-radius: 999px;
          background: transparent;
        }

        .qbd-stack {
          position: absolute;
          left: 0;
          bottom: 0;
          width: 1px;
          height: 1px;
        }

        /* =========================
           버튼: 아이콘 위치 고정
           배경(알약)은 ::before가 확장
           ========================= */
        .qbd-btn {
          position: absolute;
          left: 0;
          bottom: 0;

          /* ✅ 버튼 자체는 '원 크기' 그대로 유지 */
          width: 46px;
          height: 46px;
          border-radius: 999px;

          border: 1px solid rgba(0, 0, 0, 0.08);
          background: transparent;
          cursor: pointer;
          user-select: none;

          display: flex;
          align-items: center;
          justify-content: center;

          /* 확장 배경을 버튼 뒤로 */
          overflow: visible;

          transition:
            transform 420ms cubic-bezier(0.22, 1, 0.36, 1),
            opacity 220ms ease;
        }

        /* 확장되는 배경(알약) */
        .qbd-btn::before {
          content: '';
          position: absolute;
          inset: 0;
          width: 46px;
          height: 46px;
          border-radius: 999px;

          background: rgba(255, 255, 255, 0.92);
          box-shadow: 0 10px 22px rgba(0, 0, 0, 0.12);
          backdrop-filter: blur(6px);

          border: 1px solid rgba(0, 0, 0, 0.08);

          transition:
            width 260ms cubic-bezier(0.22, 1, 0.36, 1),
            border-radius 260ms cubic-bezier(0.22, 1, 0.36, 1),
            background 200ms ease,
            box-shadow 200ms ease;
        }

        .qbd-btn:hover::before,
        .qbd-btn:focus-visible::before {
          width: calc(46px + var(--qbd-expand));
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.98);
          box-shadow: 0 12px 26px rgba(0, 0, 0, 0.16);
        }

        .qbd-btn:focus-visible {
          outline: none;
        }
        .qbd-btn:focus-visible::before {
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.22), 0 12px 26px rgba(0, 0, 0, 0.16);
        }

        /* 아이콘: 절대 고정 위치(원 중심) */
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
          transform: none; /* ✅ hover에도 이동 금지 */
        }

        /* 텍스트: 오른쪽에 숨겨두고, hover 시 나타남 */
        .qbd-text {
          position: absolute;
          left: 46px; /* 원 바로 옆부터 */
          top: 50%;
          transform: translateY(-50%);

          height: 38px;
          display: inline-flex;
          align-items: center;

          font-size: 13px;
          font-weight: 800;
          color: #111827;

          padding-left: 12px;
          padding-right: 14px;

          opacity: 0;
          pointer-events: none;
          white-space: nowrap;
          z-index: 2;

          transition: opacity 200ms ease;
          transition-delay: 40ms;
        }

        .qbd-btn:hover .qbd-text,
        .qbd-btn:focus-visible .qbd-text {
          opacity: 1;
        }

        /* 펼침 버튼은 닫혀 있으면 클릭 불가 */
        .qbd-item {
          opacity: 0;
          pointer-events: none;
        }
        .qbd-item.is-open {
          opacity: 1;
          pointer-events: auto;
        }

        /* 모바일: hover 없음 → 텍스트 숨김 유지 */
        @media (hover: none) {
          .qbd-text {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}