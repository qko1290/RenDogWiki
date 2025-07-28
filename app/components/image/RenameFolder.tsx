// =============================================
// File: app/components/image/RenameFolder.tsx
// =============================================
/**
 * 폴더 이름 변경 버튼 컴포넌트
 * - 클릭 시 onStart() 콜백(모달/폼 등) 호출
 * - props: onStart(필수), disabled(선택), className(선택)
 */

import React from 'react';

type Props = {
  onStart: () => void;         // 이름 변경 시작 콜백
  disabled?: boolean;          // 비활성화
  className?: string;          // 버튼 커스텀 스타일
};

// 폴더 이름 변경 버튼(불필요 렌더/로직 없음, 최적 구조)
export default function RenameFolder({ onStart, disabled = false, className = "" }: Props) {
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
