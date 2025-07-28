// =============================================
// File: app/components/editor/TableOfContents.tsx
// =============================================
/**
 * 에디터 및 문서 뷰의 목차(TOC) 컴포넌트
 * - heading 목록을 우측에 계층 구조로 표시
 * - heading 클릭 시 해당 id 위치로 스크롤 이동
 * - heading 레벨(1/2/3)에 따라 들여쓰기
 * - heading 아이콘/텍스트 모두 출력
 */

'use client';

import React from 'react';

// Heading 데이터 구조: 텍스트/아이디/레벨/아이콘
type Heading = {
  text: string;      // heading 본문 텍스트
  id: string;        // heading 요소 id (스크롤 이동용)
  level: 1 | 2 | 3;  // heading 계층(level 1=h1, 2=h2, ...)
  icon: string;      // heading 앞 아이콘(이모지 또는 이미지)
};

type Props = {
  headings: Heading[];  // 추출된 heading 데이터 배열
};

// 목차 트리 컴포넌트
const TableOfContents = ({ headings }: Props) => (
  <div
    style={{
      position: 'fixed',     // 화면 고정 위치(우측)
      right: 20,
      top: 100,
      width: 200,
    }}
  >
    <h3>📚 목차</h3>
    <ul style={{ listStyle: 'none', padding: 0 }}>
      {headings.map((heading) => (
        <li
          key={heading.id}
          style={{
            marginLeft: (heading.level - 1) * 20, // 레벨별 들여쓰기
            marginBottom: 8,
          }}
        >
          {/* 각 heading은 버튼(클릭 시 스크롤) */}
          <button
            onClick={e => {
              e.preventDefault();
              // 해당 heading id로 스크롤
              const el = document.getElementById(heading.id);
              if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              textAlign: 'left',
              cursor: 'pointer',
              fontSize: 14,
              display: 'flex',        // 아이콘+텍스트 가로배치
              alignItems: 'center',   // 세로 정렬
              gap: 8,                 // 간격
            }}
          >
            {/* 아이콘: 이미지 또는 이모지 지원 */}
            {heading.icon?.startsWith('http') ? (
              <img
                src={heading.icon}
                alt="icon"
                style={{
                  width: 18,
                  height: 18,
                  verticalAlign: 'middle',
                  objectFit: 'contain',
                }}
              />
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

export default TableOfContents;
