// =============================================
// File: app/components/editor/TableOfContents.tsx
// =============================================
/**
 * 에디터/위키의 목차 컴포넌트
 * - heading(제목) 목록을 받아 화면 우측에 트리처럼 출력
 * - 각 heading 클릭 시 해당 id로 스크롤 이동
 * - heading 레벨(1/2/3)에 따라 자동 들여쓰기, 아이콘/텍스트 동시 표시
 */

'use client';

import React from 'react';

// 타입 선언
type Heading = {
  text: string;          // 제목 텍스트
  id: string;            // heading id
  level: 1 | 2 | 3;      // heading 레벨
  icon: string;          // heading 아이콘
};

type Props = {
  headings: Heading[];   // heading 배열(목차 데이터)
};

// 목차 메인 컴포넌트
const TableOfContents = ({ headings }: Props) => {
  return (
    <div
      style={{
        position: 'fixed',
        right: '20px',
        top: '100px',
        width: '200px',
      }}
    >
      <h3>📚 목차</h3>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {headings.map((heading) => (
          <li
            key={heading.id}
            style={{
              marginLeft: `${(heading.level - 1) * 20}px`,  // level별 들여쓰기
              marginBottom: '8px',
            }}
          >
            <button
              onClick={e => {
                e.preventDefault();
                const el = document.getElementById(heading.id);
                if (el) {
                  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
              }}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                textAlign: 'left',
                cursor: 'pointer',
                fontSize: '14px',
                display: 'flex',          // ⭐️ 가로 배치 핵심
                alignItems: 'center',     // 세로 중앙정렬
                gap: 8,                   // 아이콘-텍스트 간격
              }}
            >
              {heading.icon?.startsWith('http') ? (
                <img src={heading.icon} alt="icon" style={{
                  width: 18,
                  height: 18,
                  verticalAlign: 'middle',
                  objectFit: 'contain'
                }} />
              ) : (
                <span style={{ fontSize: 18 }}>{heading.icon}</span>
              )}
              <span>{heading.text}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default TableOfContents;
