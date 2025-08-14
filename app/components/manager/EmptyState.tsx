// =============================================
// File: app/components/manager/EmptyState.tsx
// =============================================
/**
 * 빈 상태 표시 컴포넌트
 * - text prop 또는 children으로 메시지 출력
 * - 아이콘/클래스 커스터마이즈 가능
 * - 외부 API/레이아웃 유지 (npc-detail-empty 클래스에 의존)
 */

'use client';

import React from 'react';

export type EmptyStateProps = {
  /** 텍스트 메시지 (children 대신 사용 가능) */
  text?: React.ReactNode;
  /** 좌측 아이콘/이모지/이미지 등 */
  icon?: React.ReactNode;
  /** 외부 스타일 추가 */
  className?: string;
  /** 자유로운 커스텀 렌더링 시 사용 */
  children?: React.ReactNode;
};

const EmptyState = React.memo(function EmptyState({
  text,
  icon,
  className = '',
  children,
}: EmptyStateProps) {
  const content = text ?? children;

  return (
    <div
      className={['npc-detail-empty', className].filter(Boolean).join(' ')}
      style={{ display: 'flex', alignItems: 'center', gap: 8 }}
      role="note"
    >
      {icon ? <span style={{ fontSize: 18 }}>{icon}</span> : null}
      <span>{content}</span>
    </div>
  );
});

export default EmptyState;
