// =============================================
// File: components/common/Modal.tsx
// (FIX) 모달 포커스 트랩 안정화: onClose 의존성 제거 + ref 사용
// =============================================
'use client';

import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import '@/wiki/css/image.css';

type BaseProps = {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
};

function Overlay({
  onClose,
  children,
}: {
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rd-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        display: 'grid',
        placeItems: 'center',
        position: 'fixed',
        inset: 0,
        zIndex: 5000,
      }}
    >
      {children}
    </div>
  );
}

export default function Modal({ open, onClose, children }: BaseProps) {
  if (!open) return null;
  return createPortal(
    <Overlay onClose={onClose}>
      <div onMouseDown={(e) => e.stopPropagation()}>{children}</div>
    </Overlay>,
    document.body
  );
}

export function ModalCard({
  open,
  onClose,
  title,
  children,
  actions,
  width = 420,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children?: React.ReactNode;
  actions?: React.ReactNode;
  width?: number;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const lastActiveRef = useRef<HTMLElement | null>(null);

  // 최신 onClose를 ref로 유지(의존성에서 제거)
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;

    // 열릴 때 포커스 진입 지점 기억 + 스크롤 잠금
    lastActiveRef.current = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const panel = panelRef.current!;
    const getFocusables = () =>
      panel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
      );

    // 첫 포커스
    const firstSet = getFocusables();
    (firstSet[0] ?? panel).focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key === 'Tab') {
        const f = getFocusables(); // 매번 최신 목록으로
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        const active = document.activeElement as HTMLElement | null;

        if (e.shiftKey) {
          if (active === first || !panel.contains(active)) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (active === last || !panel.contains(active)) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', onKeyDown);
      // 닫힐 때만 이전 포커스로 복귀
      lastActiveRef.current?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <Overlay onClose={() => onCloseRef.current()}>
      <div
        ref={panelRef}
        className="rd-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width,
          maxWidth: 'calc(100vw - 40px)',
          borderRadius: 20,
        }}
      >
        <button
          className="rd-exit-btn"
          onClick={() => onCloseRef.current()}
          aria-label="닫기"
          type="button"
        >
          <svg height="20" viewBox="0 0 384 512">
            <path d="M342.6 150.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L192 210.7 86.6 105.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L146.7 256 41.4 361.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L192 301.3 297.4 406.6c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L237.3 256 342.6 150.6z"/>
          </svg>
        </button>

        <div className="rd-card-content">
          <p className="rd-card-heading" id={titleId}>{title}</p>
          {children}
        </div>

        {actions && <div className="rd-card-button-wrapper">{actions}</div>}
      </div>
    </Overlay>,
    document.body
  );
}
