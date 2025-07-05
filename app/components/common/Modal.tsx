// =============================================
// File: components/common/Modal.tsx
// =============================================
/**
 * 공통 Modal 컴포넌트
 * - props로 열림/닫힘(open), 닫기 콜백(onClose), 제목(title), 내용(children), 너비(width) 지정
 * - 포커스 트랩/배경 클릭시 닫힘, 모달 내용 클릭시 버블링 차단
 */

import React from "react";

// Props 타입 선언
type ModalProps = {
  open: boolean;              // 모달 열림/닫힘 상태
  onClose: () => void;        // 닫기 콜백
  title?: string;             // 모달 상단 제목
  children: React.ReactNode;  // 모달 내부 내용
  width?: string;             // 모달 최소 너비
};

// 메인 컴포넌트
export default function Modal({
  open, onClose, title, children, width = "400px"
}: ModalProps) {
  // 1. 모달 미열림시 렌더링 없음 
  if (!open) return null;

  // 모달 전체 오버레이 + 본문 구조
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}            // 배경 클릭시 닫기
      aria-modal                   // 접근성
      tabIndex={-1}                // 접근성(tab 진입 허용)
    >
      {/* 모달 본문: 이벤트 버블링 차단(닫기방지) */}
      <div
        className="bg-white rounded-xl shadow-lg p-6 relative"
        style={{ minWidth: width, maxWidth: "90vw" }}
        onClick={e => e.stopPropagation()} // 내부 클릭시 배경닫기 무시
      >
        {/* 우측 상단 닫기 버튼 */}
        <button
          className="absolute top-3 right-4 text-xl font-bold text-gray-400 hover:text-gray-700"
          onClick={onClose}
          aria-label="닫기"
        >
          ×
        </button>
        {/* 제목( */}
        {title && <div className="text-lg font-bold mb-3">{title}</div>}
        {/* 본문/slot(폼/알림 등) */}
        {children}
      </div>
    </div>
  );
}
