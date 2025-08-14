// =============================================
// File: app/components/manager/ManagerLayout.tsx
// =============================================
import React from 'react';

/**
 * 공통 3단 매니저 레이아웃
 * - 기본 사용: <ManagerLayout sidebar={} list={} detail={} />
 * - 예외 지원: children으로 [sidebar, list, detail]를 전달해도 동일하게 렌더
 * - 외부 API/클래스/구조를 변경하지 않고 배치만 담당
 */

type ManagerLayoutProps = {
  /** 좌측 사이드바 영역 */
  sidebar?: React.ReactNode;
  /** 중앙 목록 영역 */
  list?: React.ReactNode;
  /** 우측 상세 영역 */
  detail?: React.ReactNode;
  /** [sidebar, list, detail] 형태로 전달 시 fallback */
  children?: React.ReactNode;
  /** 컨테이너에 추가할 클래스 */
  className?: string;
};

export default function ManagerLayout({
  sidebar,
  list,
  detail,
  children,
  className = '',
}: ManagerLayoutProps) {
  let sb = sidebar;
  let ls = list;
  let dt = detail;

  // children으로 [sidebar, list, detail] 전달한 경우에도 동작하도록 지원
  if (!sb && !ls && !dt && children) {
    const arr = React.Children.toArray(children);
    sb = arr[0] ?? null;
    ls = arr[1] ?? null;
    dt = arr[2] ?? null;
  }

  return (
    <div className={`npc-manager-container ${className}`}>
      <aside className="npc-sidebar">{sb}</aside>
      <main className="npc-list-area">{ls}</main>
      <section className="npc-detail-area">{dt}</section>
    </div>
  );
}
