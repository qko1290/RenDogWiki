// File: C:\next\rdwiki\app\components\common\RdModal.tsx
// =============================================
// 목적: RDWIKI 공용 모달(포털 미사용 버전)
// - BareModal: 오버레이 + 배경 클릭 시 닫힘(자식 클릭은 유지)
// - ModalCard: 제목/본문/액션을 갖는 카드형 모달(너비 지정 가능)
// 사용처: 간단한 확인/알림/폼 입력 등 (페이지 내 레이어로 띄움)
// 주의: 포털 미사용이므로 z-index/DOM 계층은 CSS로 관리
// =============================================

'use client';

import * as React from 'react';
import '@/wiki/css/image.css'; // rd-* 스타일 (오버레이/카드/버튼/입력)

/**
 * 오버레이 모달의 가장 얇은 레이어.
 * - 배경 클릭(자기 자신을 직접 클릭)시에만 닫힘
 * - ESC 키로 닫기 지원(접근성/편의성)
 * - 포털 미사용(현재 DOM 위치에 렌더)
 */
export function BareModal({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  // ESC 키로 닫기 (open일 때만 리스너 등록)
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="rd-overlay"
      onMouseDown={(e) => {
        // 배경 클릭시에만 닫기 (자식 클릭은 유지)
        if (e.target === e.currentTarget) onClose();
      }}
      // 접근성: 오버레이 자체는 모달 컨텍스트
      role="dialog"
      aria-modal="true"
    >
      {children}
    </div>
  );
}

/**
 * 카드형 모달(타이틀/본문/액션 슬롯 제공).
 * - width로 카드 폭 제어(기본 420)
 * - aria-labelledby로 제목 연결
 */
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
  return (
    <BareModal open={open} onClose={onClose}>
      <div
        className="rd-card"
        role="document"
        aria-labelledby="rdm-title"
        style={{ width }}
      >
        {/* 닫기 버튼(우상단) */}
        <button
          className="rd-exit-btn"
          onClick={onClose}
          aria-label="닫기"
          type="button"
        >
          <svg height="20" viewBox="0 0 384 512" aria-hidden="true" focusable="false">
            <path d="M342.6 150.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L192 210.7 86.6 105.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L146.7 256 41.4 361.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L192 301.3 297.4 406.6c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L237.3 256 342.6 150.6z"/>
          </svg>
        </button>

        <div className="rd-card-content">
          <p className="rd-card-heading" id="rdm-title">{title}</p>
          {children}
        </div>

        {actions && (
          <div className="rd-card-button-wrapper">{actions}</div>
        )}
      </div>
    </BareModal>
  );
}
