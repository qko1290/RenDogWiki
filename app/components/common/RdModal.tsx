'use client';

import * as React from 'react';
import '@/wiki/css/image.css'; // rd-* 스타일 (오버레이/카드/버튼/입력)

export function BareModal({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div
      className="rd-overlay"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {children}
    </div>
  );
}

/** ImageManage의 ModalCard를 그대로 사용 + width 옵션만 추가 */
export function ModalCard({
  open,
  onClose,
  title,
  children,
  actions,
  width = 420,        // 필요시 크기 조절
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
      <div className="rd-card" role="dialog" aria-labelledby="rdm-title" style={{ width }}>
        <button className="rd-exit-btn" onClick={onClose} aria-label="닫기">
          <svg height="20" viewBox="0 0 384 512">
            <path d="M342.6 150.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L192 210.7 86.6 105.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L146.7 256 41.4 361.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L192 301.3 297.4 406.6c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L237.3 256 342.6 150.6z"/>
          </svg>
        </button>
        <div className="rd-card-content">
          <p className="rd-card-heading" id="rdm-title">{title}</p>
          {children}
        </div>
        {actions && <div className="rd-card-button-wrapper">{actions}</div>}
      </div>
    </BareModal>
  );
}
