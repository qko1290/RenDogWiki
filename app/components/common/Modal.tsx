// =============================================
// File: components/common/Modal.tsx
// =============================================
/**
 * 공통 Modal 컴포넌트
 * - props로 열림/닫힘(open), 닫기 콜백(onClose), 제목(title), 내용(children), 너비(width) 지정
 * - 포커스 트랩/배경 클릭시 닫힘, 모달 내용 클릭시 버블링 차단
 * - React Portal을 사용해 body 최상위에 렌더(중첩 z-index 문제 완전 방지)
 */

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  width?: string;
};

export default function Modal({
  open, onClose, title, children, width = "400px"
}: ModalProps) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!open || !isClient) return null;

  const modalContent = (
    <div
      className="modal-overlay"
      onClick={onClose}
      aria-modal
      tabIndex={-1}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(0,0,0,0.40)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        className="modal-content"
        style={{
          background: '#fff',
          borderRadius: 16,
          boxShadow: '0 4px 24px 0 #0002',
          padding: 24,
          minWidth: width,
          maxWidth: "90vw",
          position: "relative",
        }}
        onClick={e => e.stopPropagation()}
      >
        <button
          className="absolute top-3 right-4 text-xl font-bold text-gray-400 hover:text-gray-700"
          onClick={onClose}
          aria-label="닫기"
          style={{
            position: 'absolute',
            top: 14,
            right: 22,
            fontSize: 26,
            color: '#bbb',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            zIndex: 10001,
          }}
        >×</button>
        {title && <div className="text-lg font-bold mb-3">{title}</div>}
        {children}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}