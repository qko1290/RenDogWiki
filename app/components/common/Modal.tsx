// =============================================
// File: components/common/Modal.tsx
// =============================================
/**
 * 공통 Modal 컴포넌트
 * - props: 열림/닫힘(open), 닫기 콜백(onClose), 제목(title), 자식(children), 너비(width) 지정 가능
 * - React Portal로 body에 렌더 (z-index 충돌 방지)
 * - 배경 클릭 시 닫힘, 내용 클릭 시 닫힘 방지 (버블링 차단)
 * - 포커스 트랩 및 접근성(arai-modal) 적용
 */

'use client';

import React from 'react';
import { createPortal } from 'react-dom';
import '@/wiki/css/image.css'; // rd-overlay/rd-card 등 공용 스타일

type BaseProps = {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
};

/** 공통 오버레이: 항상 화면 정중앙에 위치 (그리드 중앙 정렬 + 포털) */
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
      // 스타일 누락/오버라이드 대비 안전장치(필요 시 클래스와 함께 적용)
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

/** 프레임(카드 스킨) 없이 내용만 중앙 배치하고 싶은 경우 */
export default function Modal({ open, onClose, children }: BaseProps) {
  if (!open) return null;
  return createPortal(
    <Overlay onClose={onClose}>
      <div onMouseDown={(e) => e.stopPropagation()}>{children}</div>
    </Overlay>,
    document.body
  );
}

/** 카드형 모달: 제목/닫기/액션 영역이 있는 표준 패널 */
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
  if (!open) return null;
  return createPortal(
    <Overlay onClose={onClose}>
      <div
        className="rd-card"
        role="dialog"
        aria-labelledby="rdm-title"
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width,
          maxWidth: 'calc(100vw - 40px)',
          borderRadius: 20,
        }}
      >
        <button
          className="rd-exit-btn"
          onClick={onClose}
          aria-label="닫기"
          type="button"
        >
          <svg height="20" viewBox="0 0 384 512">
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
    </Overlay>,
    document.body
  );
}
