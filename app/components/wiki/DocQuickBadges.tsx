'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

export type DocQuickBadgeItem = {
  icon: string; // FontAwesome class
  title: string;
  href: string;
};

type Props = {
  items: [DocQuickBadgeItem, DocQuickBadgeItem, DocQuickBadgeItem];
  mainIcon?: string;
  mainTitle?: string;
  hidden?: boolean;
  expandWidth?: number;
  hoverBg?: string;
  hoverCooldownMs?: number;
};

export default function DocQuickBadges({
  items,
  mainIcon = 'fas fa-bolt-lightning',
  mainTitle = '바로가기',
  hidden,
  expandWidth = 150,
  hoverBg = 'rgb(255, 69, 69)',
  hoverCooldownMs = 220,
}: Props) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement | null>(null);

  const [open, setOpen] = useState(false);
  const [hoverLock, setHoverLock] = useState(false);
  const hoverLockTimerRef = useRef<number | null>(null);
  const prevOpenRef = useRef(false);

  const stack = useMemo(() => items.slice(0, 3), [items]);

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

  useEffect(() => {
    let raf = 0;

    const onMove = (e: MouseEvent) => {
      const el = rootRef.current;
      if (!el) return;

      const rect = el.getBoundingClientRect();
      const cx = rect.left + 23;
      const cy = rect.bottom - 23;

      const x = e.clientX;
      const y = e.clientY;

      const inside =
        x >= cx - 100 &&
        x <= cx + 50 &&
        y <= cy &&
        y >= cy - 180;

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
    >
      {/* 메인 버튼 */}
      <button
        type="button"
        className={`qbd-btn qbd-main ${open ? 'is-hidden' : ''}`}
        onClick={() => setOpen((v) => !v)}
        data-label={mainTitle}
      >
        <span className="qbd-ic">
          <i className={mainIcon}></i>
        </span>
      </button>

      <div className="qbd-stack">
        {stack.map((it, idx) => (
          <button
            key={idx}
            type="button"
            className={`qbd-btn qbd-item ${open ? 'is-open' : ''}`}
            style={{
              transform: open ? `translateY(${-56 * idx}px)` : 'translateY(0px)',
              transitionDelay: open ? `${idx * 55}ms` : '0ms',
            }}
            onClick={() => go(it.href)}
            data-label={it.title}
          >
            <span className="qbd-ic">
              <i className={it.icon}></i>
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
        }

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
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: visible;
          transition: transform 520ms cubic-bezier(0.22, 1, 0.36, 1),
            opacity 220ms ease;
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
            background-color 240ms ease;
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
          transition: opacity 220ms ease, font-size 240ms ease;
        }

        .qbd-root:not(.hover-lock) .qbd-btn:not(.qbd-main):hover::before {
          width: calc(46px + var(--qbd-expand));
          border-radius: 50px;
          background-color: var(--qbd-hover-bg);
        }

        .qbd-root:not(.hover-lock) .qbd-btn:not(.qbd-main):hover::after {
          opacity: 1;
          font-size: 13px;
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

        .qbd-ic {
          width: 46px;
          height: 46px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 16px;
        }
      `}</style>
    </div>
  );
}