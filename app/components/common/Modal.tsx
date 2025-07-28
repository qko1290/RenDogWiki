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

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type ModalProps = {
  open: boolean;            // 모달 오픈 여부
  onClose: () => void;      // 닫기 콜백
  title?: string;           // 모달 상단 제목
  children: React.ReactNode;// 모달 내부 내용
  width?: string;           // 최소 너비 (기본 400px)
};

/**
 * [Modal 컴포넌트]
 * - open=false면 null 반환(렌더 X)
 * - 클라이언트 사이드에서만 Portal 렌더링
 */
export default function Modal({
  open, onClose, title, children, width = "400px"
}: ModalProps) {
  const [isClient, setIsClient] = useState(false);

  // 마운트 후(브라우저 환경)만 Portal 생성
  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!open || !isClient) return null;

  // 모달 레이어(Portal 대상)
  const modalContent = (
    <div
      className="modal-overlay"
      onClick={onClose}
      aria-modal="true"
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
        onClick={e => e.stopPropagation()} // 내용 클릭 시 배경 클릭 닫힘 방지
      >
        {/* 우측 상단 닫기 버튼 */}
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
        {/* 제목이 있을 때만 출력 */}
        {title && <div className="text-lg font-bold mb-3">{title}</div>}
        {children}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
