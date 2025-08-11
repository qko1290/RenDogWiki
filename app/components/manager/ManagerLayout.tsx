// 전체 코드
import React from 'react';

/**
 * 공통 3단 레이아웃
 * - sidebar / list / detail 를 props로 넘기는 방식을 기본으로 합니다.
 * - 혹시 children으로 [sidebar, list, detail]을 넘겨도 동작하도록 fallback 지원.
 */
type ManagerLayoutProps = {
  sidebar?: React.ReactNode;
  list?: React.ReactNode;
  detail?: React.ReactNode;
  children?: React.ReactNode; // [sidebar, list, detail]로 넘겨도 됨
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

  // children으로 들어온 경우도 지원 (안전장치)
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
