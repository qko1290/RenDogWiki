'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faDollarSign,
  faScroll,
  faCube,
  faCalculator,
  faBookOpen,
} from '@fortawesome/free-solid-svg-icons';

export type DocQuickBadgeItem = {
  icon: 'price' | 'quest' | 'head' | 'collection' | 'calc';
  title: string;
  href: string;
  external?: boolean;
};

type Props = {
  items: [
    DocQuickBadgeItem,
    DocQuickBadgeItem,
    DocQuickBadgeItem,
    DocQuickBadgeItem,
    DocQuickBadgeItem
  ];
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
  hidden = false,
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

  const go = (item: DocQuickBadgeItem) => {
    if (hidden) return;

    if (item.external) {
      window.open(item.href, '_blank', 'noopener,noreferrer');
      return;
    }

    router.push(item.href, { scroll: false });
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

      if (hoverLockTimerRef.current) {
        window.clearTimeout(hoverLockTimerRef.current);
      }

      hoverLockTimerRef.current = window.setTimeout(() => {
        setHoverLock(false);
        hoverLockTimerRef.current = null;
      }, hoverCooldownMs);
    }
  }, [open, hoverCooldownMs]);

  // hidden 상태가 되면 언마운트하지 않고 닫기만 함
  useEffect(() => {
    if (!hidden) return;
    setOpen(false);
    setHoverLock(false);

    if (hoverLockTimerRef.current) {
      window.clearTimeout(hoverLockTimerRef.current);
      hoverLockTimerRef.current = null;
    }
  }, [hidden]);

  // 감지 영역
  // 왼쪽 100 / 오른쪽 50 / 위 50 / 아래 250
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

      const inside =
        x >= cx - 100 &&
        x <= cx + 50 &&
        y >= cy - 50 &&
        y <= cy + 250;

      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setOpen(inside));
    };

    window.addEventListener('mousemove', onMove, { passive: true });

    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('mousemove', onMove);
    };
  }, [hidden]);

  return (
    <>
      <div
        ref={rootRef}
        className={`doc-quick-badges ${hidden ? 'is-hidden' : ''} ${open ? 'is-open' : ''}`}
        style={{ top: `${topOffset}px` }}
        aria-hidden={hidden}
      >
        {/* 메인 버튼 */}
        <button
          type="button"
          className="dqb-main"
          onClick={() => {
            if (hidden) return;
            setOpen((v) => !v);
          }}
          aria-label={mainTitle}
          title={mainTitle}
          data-label={mainTitle}
          disabled={hidden}
        >
          <span className="dqb-main-text">바로가기</span>
        </button>

        {/* 하위 버튼 */}
        <div className="dqb-stack">
          {stack.map((it, idx) => (
            <button
              key={`${it.title}-${idx}`}
              type="button"
              className="dqb-item"
              onClick={() => go(it)}
              aria-label={it.title}
              title={it.title}
              data-label={it.title}
              disabled={hidden}
              style={
                open
                  ? {
                      transform: `translateY(${(idx + 1) * 52}px)`,
                      opacity: 1,
                    }
                  : {
                      transform: 'translateY(0px)',
                      opacity: 0,
                    }
              }
            >
              <FontAwesomeIcon icon={iconByKey(it.icon)} />
            </button>
          ))}
        </div>
      </div>

      <style jsx>{`
        .doc-quick-badges {
          position: fixed;
          right: 24px;
          z-index: 120;
          width: 46px;
          height: 46px;
          transition:
            opacity 0.18s ease,
            visibility 0.18s ease,
            transform 0.18s ease;
        }

        .doc-quick-badges.is-hidden {
          opacity: 0;
          visibility: hidden;
          pointer-events: none;
          transform: translateY(4px);
        }

        .dqb-main,
        .dqb-item {
          position: absolute;
          right: 0;
          width: 46px;
          height: 46px;
          border: none;
          border-radius: 9999px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: #fff;
          box-shadow: 0 8px 20px rgba(0, 0, 0, 0.18);
          transition:
            transform 0.18s ease,
            opacity 0.18s ease,
            background 0.15s ease,
            width 0.18s ease;
          overflow: hidden;
          white-space: nowrap;
        }

        .dqb-main {
          background: #3b82f6;
        }

        .dqb-main:hover {
          background: #2563eb;
        }

        .dqb-main-text {
          font-size: 13px;
          font-weight: 700;
        }

        .dqb-stack {
          position: absolute;
          inset: 0;
        }

        .dqb-item {
          background: ${hoverBg};
          will-change: transform, opacity;
        }

        .dqb-item:hover {
          width: ${expandWidth}px;
          justify-content: flex-start;
          padding-left: 16px;
        }

        .dqb-item::after {
          content: attr(data-label);
          margin-left: 10px;
          font-size: 13px;
          font-weight: 700;
          opacity: 0;
          transition: opacity 0.12s ease;
        }

        .dqb-item:hover::after {
          opacity: 1;
        }

        .dqb-item:disabled,
        .dqb-main:disabled {
          cursor: default;
        }

        @media (max-width: 768px) {
          .doc-quick-badges {
            right: 14px;
            bottom: 92px;
            top: auto !important;
          }

          .dqb-item:hover {
            width: 46px;
            justify-content: center;
            padding-left: 0;
          }

          .dqb-item::after {
            display: none;
          }
        }
      `}</style>
    </>
  );
}