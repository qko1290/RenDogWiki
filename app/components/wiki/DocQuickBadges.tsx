'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

export type DocQuickBadgeItem = {
  /** 버튼에 표시될 아이콘(이모지 1개 권장) */
  icon: string;
  /** 알약 확장 시 보일 제목 */
  title: string;
  /** 이동할 URL (예: /wiki?path=123&title=문서명) */
  href: string;
};

type Props = {
  items: [DocQuickBadgeItem, DocQuickBadgeItem, DocQuickBadgeItem];
  /** 메인(기본) 원 아이콘 */
  mainIcon?: string;
  /** 메인(기본) 원 라벨 (hover 시) */
  mainTitle?: string;
  /** 숨김 처리 */
  hidden?: boolean;
};

export default function DocQuickBadges({
  items,
  mainIcon = '📌',
  mainTitle = '바로가기',
  hidden,
}: Props) {
  const router = useRouter();

  // “마우스를 가까이 대면” 느낌: 실제로는 좌하단에 넉넉한 히트박스를 두고,
  // 그 영역에 들어오면 펼치도록 처리 (가장 안정적)
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
    // 살짝 딜레이로 “스치면 닫히는” 느낌 완화
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

  const onGo = (href: string) => {
    router.push(href, { scroll: false });
  };

  const stack = useMemo(() => items.slice(0, 3), [items]);

  if (hidden) return null;

  return (
    <div
      className="qbd-root"
      onMouseEnter={safeOpen}
      onMouseLeave={safeClose}
      // 키보드 접근성: 탭으로 들어오면 펼치기
      onFocusCapture={safeOpen}
      onBlurCapture={(e) => {
        // 내부 포커스 이동이면 닫지 않음
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        safeClose();
      }}
      aria-label="문서 바로가기"
    >
      {/* 히트박스(가까이 대면 펼쳐지는 느낌) */}
      <div className="qbd-hitbox" />

      {/* 메인 버튼(항상 보임) */}
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
        <span className="qbd-pill">
          <span className="qbd-pill-text">{mainTitle}</span>
        </span>
      </button>

      {/* 펼쳐지는 3개 버튼 */}
      <div className="qbd-stack" aria-hidden={!open}>
        {stack.map((it, idx) => (
          <button
            key={`${it.href}-${idx}`}
            type="button"
            className={`qbd-btn qbd-item ${open ? 'is-open' : ''}`}
            style={{
              // 위로 3개 쌓기 (간격 56px)
              transform: open ? `translateY(${-56 * (idx + 1)}px)` : 'translateY(0px)',
            }}
            onClick={() => onGo(it.href)}
            aria-label={it.title}
            title={it.title}
          >
            <span className="qbd-ic" aria-hidden>
              {it.icon}
            </span>
            <span className="qbd-pill">
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
          z-index: 80; /* 위키 내부 모달/헤더보다 낮고, 일반 UI보다 높게 */
          width: 280px; /* 알약 확장 공간 */
          height: 220px; /* 히트박스 포함 */
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

        .qbd-btn {
          position: absolute;
          left: 0;
          bottom: 0;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 10px;

          width: 46px;
          height: 46px;
          border-radius: 999px;

          border: 1px solid rgba(0, 0, 0, 0.08);
          background: rgba(255, 255, 255, 0.92);
          box-shadow: 0 10px 22px rgba(0, 0, 0, 0.12);
          backdrop-filter: blur(6px);

          cursor: pointer;
          user-select: none;

          transition:
            transform 220ms cubic-bezier(0.2, 0.9, 0.2, 1),
            opacity 160ms ease,
            box-shadow 160ms ease,
            background 160ms ease;
        }

        .qbd-btn:hover {
          box-shadow: 0 12px 26px rgba(0, 0, 0, 0.16);
          background: rgba(255, 255, 255, 0.98);
        }

        .qbd-btn:active {
          transform: translateY(1px);
        }

        .qbd-btn:focus-visible {
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
        }

        /* 알약(hover 시 오른쪽 확장) */
        .qbd-pill {
          position: absolute;
          left: 100%;
          margin-left: 10px;
          height: 38px;

          display: inline-flex;
          align-items: center;

          border-radius: 999px;
          border: 1px solid rgba(0, 0, 0, 0.08);
          background: rgba(255, 255, 255, 0.96);
          box-shadow: 0 8px 18px rgba(0, 0, 0, 0.1);

          padding: 0 0; /* 기본 0 */
          width: 0; /* 기본 숨김 */
          opacity: 0;
          overflow: hidden;

          transition:
            width 180ms cubic-bezier(0.2, 0.9, 0.2, 1),
            padding 180ms cubic-bezier(0.2, 0.9, 0.2, 1),
            opacity 140ms ease;
          pointer-events: none;
          white-space: nowrap;
        }

        .qbd-pill-text {
          font-size: 13px;
          font-weight: 700;
          color: #111827;
          padding: 0 14px;
        }

        .qbd-btn:hover .qbd-pill,
        .qbd-btn:focus-visible .qbd-pill {
          width: 180px; /* 제목 길면 여기 조절 */
          padding: 0 0;
          opacity: 1;
        }

        /* 펼쳐지는 버튼은 닫혀 있을 때 클릭 방지 */
        .qbd-item {
          opacity: 0;
          pointer-events: none;
        }
        .qbd-item.is-open {
          opacity: 1;
          pointer-events: auto;
        }

        /* 메인 버튼은 항상 */
        .qbd-main {
          opacity: 1;
          pointer-events: auto;
        }

        /* 모바일/터치: hover 없으니 최소한 open 토글로 동작 */
        @media (hover: none) {
          .qbd-pill {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}