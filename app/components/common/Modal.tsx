// components/common/Modal.tsx

import React from "react";

type ModalProps = {
  open: boolean;              // 모달 열림/닫힘 상태
  onClose: () => void;        // 닫기 콜백
  title?: string;             // 모달 상단 제목
  children: React.ReactNode;  // 내용 (폼 등)
  width?: string;             // 너비 (선택)
};

export default function Modal({ open, onClose, title, children, width = "400px" }: ModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
      aria-modal
      tabIndex={-1}
    >
      {/* 모달 내용은 클릭 이벤트 버블링 막음 */}
      <div
        className="bg-white rounded-xl shadow-lg p-6 relative"
        style={{ minWidth: width, maxWidth: "90vw" }}
        onClick={e => e.stopPropagation()}
      >
        <button
          className="absolute top-3 right-4 text-xl font-bold text-gray-400 hover:text-gray-700"
          onClick={onClose}
          aria-label="닫기"
        >
          ×
        </button>
        {title && <div className="text-lg font-bold mb-3">{title}</div>}
        {children}
      </div>
    </div>
  );
}
