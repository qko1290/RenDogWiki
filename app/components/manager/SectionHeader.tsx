// app/components/manager/SectionHeader.tsx
// 섹션 타이틀 + 우측 액션 영역
import React from 'react';

export type SectionHeaderProps = {
  /** 좌측 제목 */
  title: React.ReactNode;
  /** 기본 액션 버튼 라벨(선택) */
  actionLabel?: string;
  /** 기본 액션 버튼 클릭(선택) */
  onAction?: () => void;
  /** 기본 액션 버튼 비활성화(선택) */
  actionDisabled?: boolean;
  /** 기본 액션 버튼 title/tooltip(선택) */
  actionTitle?: string;

  /** 우측 전체를 직접 렌더링하고 싶을 때 사용(선택) */
  right?: React.ReactNode;

  className?: string;
};

export function SectionHeader({
  title,
  actionLabel,
  onAction,
  actionDisabled,
  actionTitle,
  right,
  className = '',
}: SectionHeaderProps) {
  return (
    <div
      className={`section-header ${className}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
      }}
    >
      <h3 style={{ margin: 0, fontSize: 16 }}>{title}</h3>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {right}
        {actionLabel ? (
          <button
            className="npc-sidebar-add-btn"
            onClick={onAction}
            disabled={!!actionDisabled}
            title={actionTitle}
          >
            {actionLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}

