// =============================================
// File: app/components/image/RenameFolder.tsx
// =============================================
/**
 * 폴더 이름 변경 버튼 컴포넌트
 * - 클릭 시 onStart() 콜백(모달/폼 등) 호출
 * - props: onStart(필수), disabled(선택), className(선택)
 * - 이벤트 핸들러를 사용하므로 클라이언트 컴포넌트로 지정
 */

'use client';

import React from 'react';

type Props = {
  onStart: () => void;         // 이름 변경 시작 콜백
  disabled?: boolean;          // 비활성화
  className?: string;          // 버튼 커스텀 스타일
};

// 폴더 이름 변경 버튼(불필요 렌더/로직 없음, 경량 구성)
function RenameFolder({ onStart, disabled = false, className = "" }: Props) {
  return (
    <button
      type="button"
      className={className}
      onClick={onStart}
      disabled={disabled}
      title="이름 변경"
      aria-label="폴더 이름 변경"
    >
      ✏️ 이름변경
    </button>
  );
}

export default React.memo(RenameFolder);
