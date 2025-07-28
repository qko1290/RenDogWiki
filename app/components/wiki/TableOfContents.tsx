// =============================================
// File: components/wiki/TableOfContents.tsx
// =============================================
/**
 * 본문 heading(목차) 출력 컴포넌트
 */

import React from 'react';

type Heading = {
  id: string;
  text: string;
  icon?: string;
  level: number;
};

const TableOfContents = ({ headings }: { headings: Heading[] }) => (
  headings.length > 0 ? (
    <ul>
      {headings.map((heading, idx) => (
        <li
          key={idx}
          style={{ marginLeft: `${(heading.level - 1) * 16}px`, lineHeight: 1.8 }}
        >
          <a
            href={`#${heading.id}`}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              textDecoration: 'none', color: 'inherit', minHeight: 24, marginBottom: 6
            }}
          >
            {heading.icon?.startsWith('http') ? (
              <img src={heading.icon} alt="icon" style={{
                width: 26, height: 26, verticalAlign: 'middle', marginRight: 3, objectFit: 'contain', display: 'inline-block'
              }} />
            ) : (
              <span style={{ fontSize: 20, marginRight: 3 }}>{heading.icon}</span>
            )}
            <span style={{ fontSize: 20, fontWeight: 'bold' }}>{heading.text}</span>
          </a>
        </li>
      ))}
    </ul>
  ) : (
    <div style={{ color: '#bbb', padding: '1rem', fontSize: '0.96em', textAlign: 'center' }}>
      목차 없음
    </div>
  )
);

export default TableOfContents;
