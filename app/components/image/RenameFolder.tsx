// =============================================
// File: app/components/image/RenameFolder.tsx
// =============================================
/**
 * 폴더 이름 변경 버튼 컴포넌트
 * - "이름변경" 클릭 시 onStart() 콜백을 실행
 * - props: onStart(필수), disabled(비활성화), className(스타일)
 */

import React from 'react';

type Props = {
  onStart: () => void;         // 이름 변경 시작 콜백(모달/폼 오픈 등)
  disabled?: boolean;          // 비활성화 상태(선택)
  className?: string;          // 버튼 커스텀 스타일(선택)
};

// 메인 컴포넌트
export default function RenameFolder({ onStart, disabled, className }: Props) {
  return (
    <button
      type="button"
      className={className}
      onClick={onStart}
      disabled={disabled}
      title="이름 변경"
    >
      ✏️ 이름변경
    </button>
  );
}
