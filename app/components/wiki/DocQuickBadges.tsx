'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

export type DocQuickBadgeItem = {
  icon: string;   // 이모지 1개 or 짧은 텍스트
  title: string;  // 표시 텍스트
  href: string;   // 이동 URL
};

type Props = {
  items: [DocQuickBadgeItem, DocQuickBadgeItem, DocQuickBadgeItem];
  mainIcon?: string;
  mainTitle?: string;
  hidden?: boolean;

  /** pill 최대 폭(텍스트 영역) */
  pillWidth?: number; // default 170
};

export default function DocQuickBadges({
  items,
  mainIcon = '📌',
  mainTitle = '바로가기',
  hidden,
  pillWidth = 170,
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
      aria-label="문서 바로가기"
      style={
        {
          // css 변수로 pillWidth 전달
          ['--qbd-pill-w' as any]: `${pillWidth}px`,
        } as React.CSSProperties
      }
    >
      {/* “가까이 대면 펼쳐짐” 히트박스 */}
      <div className="qbd-hitbox" />

      {/* 메인 원 */}
      <button
        type="button"
        className={`qbd-dot qbd-main ${open ? 'is-open' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={mainTitle}
        title={mainTitle}
      >
        <span className="qbd-ic" aria-hidden>
          {mainIcon}
        </span>

        {/* ✅ 아이콘은 고정, pill만 오른쪽 확장 */}
        <span className="qbd-pill" aria-hidden>
          <span className="qbd-pill-text">{mainTitle}</span>
        </span>
      </button>

      {/* 3개 스택 */}
      <div className="qbd-stack" aria-hidden={!open}>
        {stack.map((it, idx) => (
          <button
            key={`${it.href}-${idx}`}
            type="button"
            className={`qbd-dot qbd-item ${open ? 'is-open' : ''}`}
            style={{
              transform: open ? `translateY(${-56 * (idx + 1)}px)` : 'translateY(0px)',
            }}
            onClick={() => go(it.href)}
            aria-label={it.title}
            title={it.title}
          >
            <span className="qbd-ic" aria-hidden>
              {it.icon}
            </span>

            {/* ✅ 아이콘 고정 + pill 확장 */}
            <span className="qbd-pill" aria-hidden>
              <span className="qbd-pill-text">{it.title}</span>
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
          width: calc(56px + var(--qbd-pill-w)); /* 확장 공간 */
          height: 220px;
          pointer-events: auto;
        }

        .qbd-hitbox {
          position: absolute;
          left: -10px;
          bottom: -10px;
          width: 220px;
          height: 220px;
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

        /* ===== 원(아이콘 고정) ===== */
        .qbd-dot {
          position: absolute;
          left: 0;
          bottom: 0;

          width: 46px;
          height: 46px;
          border-radius: 999px;

          border: 1px solid rgba(0, 0, 0, 0.08);
          background: rgba(255, 255, 255, 0.92);
          box-shadow: 0 10px 22px rgba(0, 0, 0, 0.12);
          backdrop-filter: blur(6px);

          display: flex;
          align-items: center;
          justify-content: center;

          cursor: pointer;
          user-select: none;

          transition:
            transform 220ms cubic-bezier(0.2, 0.9, 0.2, 1),
            opacity 160ms ease,
            box-shadow 160ms ease,
            background 160ms ease;
        }

        .qbd-dot:hover {
          box-shadow: 0 12px 26px rgba(0, 0, 0, 0.16);
          background: rgba(255, 255, 255, 0.98);
        }

        .qbd-dot:focus-visible {
          outline: none;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.22), 0 12px 26px rgba(0, 0, 0, 0.16);
        }

        .qbd-ic {
          width: 22px;
          height: 22px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          line-height: 1;

          /* ✅ 아이콘 위치 고정(hover에도 안 움직임) */
          transform: translateY(0);
          transition: none;
        }

        /* ===== pill: “버튼이 커지는게 아니라”, 텍스트 영역만 오른쪽 확장 ===== */
        .qbd-pill {
          position: absolute;
          left: 100%;
          top: 50%;
          transform: translateY(-50%);
          margin-left: 10px;

          height: 38px;
          border-radius: 999px;
          border: 1px solid rgba(0, 0, 0, 0.08);
          background: rgba(255, 255, 255, 0.96);
          box-shadow: 0 8px 18px rgba(0, 0, 0, 0.1);

          display: inline-flex;
          align-items: center;

          /* ✅ 기본은 “접힘” */
          width: 0;
          padding: 0;
          opacity: 0;
          overflow: hidden;
          pointer-events: none;

          transition:
            width 180ms cubic-bezier(0.2, 0.9, 0.2, 1),
            padding 180ms cubic-bezier(0.2, 0.9, 0.2, 1),
            opacity 140ms ease;
          white-space: nowrap;
        }

        .qbd-pill-text {
          font-size: 13px;
          font-weight: 700;
          color: #111827;
          padding: 0 14px;
        }

        /* ✅ hover/focus 시 pill만 확장 */
        .qbd-dot:hover .qbd-pill,
        .qbd-dot:focus-visible .qbd-pill {
          width: var(--qbd-pill-w);
          padding: 0;
          opacity: 1;
        }

        /* ===== 스택 펼침 ===== */
        .qbd-item {
          opacity: 0;
          pointer-events: none;
        }
        .qbd-item.is-open {
          opacity: 1;
          pointer-events: auto;
        }

        /* 모바일: hover 없음 → pill 숨김 */
        @media (hover: none) {
          .qbd-pill {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}