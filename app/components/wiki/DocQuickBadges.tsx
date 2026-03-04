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

  /** “가까이 대면 펼쳐짐” 반경(px) */
  openRadius?: number; // default 90

  /** 닫힘 히스테리시스(깜빡임 방지) */
  closePadding?: number; // default 18
};

export default function DocQuickBadges({
  items,
  mainIcon = '📌',
  mainTitle = '바로가기',
  hidden,
  expandWidth = 170,
  openRadius = 90,
  closePadding = 18,
}: Props) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement | null>(null);

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
    }, 160);
  };

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    };
  }, []);

  // ✅ “가까이 대면 펼쳐짐”을 히트박스(div)로 하지 않고
  //    커서 좌표 기반 거리 계산으로 처리 → 카테고리 클릭 방해 0%
  useEffect(() => {
    let raf = 0;

    const onMove = (e: MouseEvent) => {
      const el = rootRef.current;
      if (!el) return;

      const rect = el.getBoundingClientRect();

      // 메인 원(46px)의 중심이 root의 좌하단에 위치한다고 가정
      const cx = rect.left + 23; // 46/2
      const cy = rect.bottom - 23;

      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        setOpen((prev) => {
          if (!prev) return dist <= openRadius;
          return dist <= openRadius + closePadding;
        });
      });
    };

    window.addEventListener('mousemove', onMove, { passive: true });
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('mousemove', onMove);
    };
  }, [openRadius, closePadding]);

  const stack = useMemo(() => items.slice(0, 3), [items]);

  const go = (href: string) => {
    router.push(href, { scroll: false });
  };

  if (hidden) return null;

  return (
    <div
      ref={rootRef}
      className="qbd-root"
      // ✅ 키보드 접근성: 포커스 들어오면 열고, 빠지면 닫기
      onFocusCapture={safeOpen}
      onBlurCapture={(e) => {
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        safeClose();
      }}
      style={{ ['--qbd-expand' as any]: `${expandWidth}px` } as React.CSSProperties}
      aria-label="문서 바로가기"
    >
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
              transitionDelay: open ? `${idx * 55}ms` : '0ms', // ✅ 더 느린 stagger
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

          /* ✅ root가 화면 클릭을 절대 먹지 않게 */
          pointer-events: none;

          /* ✅ 최소 영역만 차지 (카테고리 클릭 방해 방지) */
          width: 64px;
          height: 220px;
        }

        /* ✅ 실제 클릭 가능한 건 버튼들만 */
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
           버튼: 아이콘 위치 고정
           배경(알약)은 ::before가 확장
           ========================= */
        .qbd-btn {
          position: absolute;
          left: 0;
          bottom: 0;

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

          overflow: visible;

          /* ✅ 위로 펼쳐짐: 더 느리고 부드럽게 */
          transition:
            transform 520ms cubic-bezier(0.22, 1, 0.36, 1),
            opacity 260ms ease;
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

          /* ✅ 오른쪽 확장: 더 부드럽게 */
          transition:
            width 340ms cubic-bezier(0.22, 1, 0.36, 1),
            border-radius 340ms cubic-bezier(0.22, 1, 0.36, 1),
            background 220ms ease,
            box-shadow 220ms ease;
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
          transform: none;
        }

        /* 텍스트: 오른쪽에 숨겨두고, hover 시 나타남 */
        .qbd-text {
          position: absolute;
          left: 46px;
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

          /* ✅ 텍스트도 부드럽게 */
          transition: opacity 240ms ease;
          transition-delay: 0ms;
        }

        .qbd-btn:hover .qbd-text,
        .qbd-btn:focus-visible .qbd-text {
          opacity: 1;
          transition-delay: 90ms;
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