// app/components/manager/EmptyState.tsx
// 빈 상태 표시 컴포넌트
// - text prop 또는 children으로 메시지를 표시
// - 아이콘/클래스 커스터마이즈 가능

import React from 'react';

type EmptyStateProps = {
  /** 텍스트 메시지 (children 대신 사용 가능) */
  text?: React.ReactNode;
  /** 좌측 아이콘/이모지/이미지 등 */
  icon?: React.ReactNode;
  /** 외부 스타일 추가 */
  className?: string;
  /** 자유로운 커스텀 렌더링 시 사용 */
  children?: React.ReactNode;
};

export default function EmptyState({
  text,
  icon,
  className = '',
  children,
}: EmptyStateProps) {
  return (
    <div
      className={`npc-detail-empty ${className}`}
      style={{ display: 'flex', alignItems: 'center', gap: 8 }}
    >
      {icon ? <span style={{ fontSize: 18 }}>{icon}</span> : null}
      <span>{text ?? children}</span>
    </div>
  );
}
