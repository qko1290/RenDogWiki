// =============================================
// File: app/components/editor/Leaf.tsx
// =============================================

/**
 * Slate.js 인라인 텍스트(leaf) 렌더링 컴포넌트
 * - bold/italic/underline/strikethrough, color/fontSize/backgroundColor 등 중첩 지원
 * - 마크는 children 중첩, 스타일(color 등)은 style로 처리
 */

'use client';

import React from 'react';
import { RenderLeafProps } from 'slate-react';

const Leaf = ({ attributes, children, leaf }: RenderLeafProps) => {
  // 텍스트 스타일(색상, 크기, 배경)
  const style: React.CSSProperties = {};
  if (leaf.color) style.color = leaf.color;
  if (leaf.fontSize) style.fontSize = leaf.fontSize;
  if (leaf.backgroundColor) style.backgroundColor = leaf.backgroundColor;

  // 텍스트 마크(굵게, 이탤릭, 밑줄, 취소선)
  if (leaf.bold) children = <strong>{children}</strong>;
  if (leaf.italic) children = <em>{children}</em>;
  if (leaf.underline) children = <u>{children}</u>;
  if (leaf.strikethrough) children = <s>{children}</s>;

  return (
    <span {...attributes} style={style}>
      {children}
    </span>
  );
};

export default Leaf;
