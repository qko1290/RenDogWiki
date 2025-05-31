// File: app/components/editor/TableOfContents.tsx

/**
 * Slate 기반 에디터/위키의 목차 컴포넌트
 * - heading(제목) 목록을 받아서 화면 우측에 트리처럼 출력
 * - 클릭 시 해당 heading id로 스크롤 이동(smooth)
 * - heading level(1/2/3)에 따라 들여쓰기 표시
 */

'use client';

import React from 'react';

type Heading = {
  text: string;
  id: string;
  level: 1 | 2 | 3;
  icon: string;
};

type Props = {
  headings: Heading[];
};

// 목차 컴포넌트
const TableOfContents = ({ headings }: Props) => {
  return (
    <div style={{ position: 'fixed', right: '20px', top: '100px', width: '200px' }}>
      <h3>📚 목차</h3>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {headings.map((heading) => (
          <li
            key={heading.id}
            style={{
              marginLeft: `${(heading.level - 1) * 20}px`,
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
              }}
            >
              {heading.icon} {heading.text}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default TableOfContents;
