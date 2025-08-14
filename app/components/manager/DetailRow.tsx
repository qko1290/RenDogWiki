// =============================================
// File: C:\next\rdwiki\app\components\manager\DetailRow.tsx
// =============================================
/**
 * 상세 정보 한 줄(라벨 + 값 + 선택적 편집 버튼) 렌더 컴포넌트
 * - 외부 스타일(mgr-row, mgr-edit-btn, mgr-label)에 의존하는 레이아웃 보존
 * - 접근성: 라벨과 행 컨테이너를 programmatic하게 연결(aria-labelledby)
 * - 성능: 동일 props 시 재렌더 방지를 위해 React.memo 적용
 */

import React, { useId } from 'react';

type Props = {
  label: React.ReactNode;   // 좌측 라벨(텍스트/노드)
  value: React.ReactNode;   // 우측 값(텍스트/노드)
  onEdit?: () => void;      // 편집 호출 핸들러(있을 때만 버튼 노출)
  className?: string;       // 추가 클래스
};

const DetailRow = React.memo(function DetailRow({
  label,
  value,
  onEdit,
  className,
}: Props) {
  const labelId = `${useId()}-mgr-label`;

  return (
    <div
      className={['mgr-row', className].filter(Boolean).join(' ')}
      role="group"
      aria-labelledby={labelId}
    >
      {onEdit && (
        <button
          type="button"
          className="mgr-edit-btn"
          onClick={onEdit}
          title="수정"
          aria-label="수정"
        >
          🖉
        </button>
      )}
      <b id={labelId} className="mgr-label">
        {label}
      </b>
      {value}
    </div>
  );
});

export default DetailRow;
