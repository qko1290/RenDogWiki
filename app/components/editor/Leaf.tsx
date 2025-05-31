// File: app/components/editor/Leaf.tsx

/**
 * 인라인 텍스트(leaf) 렌더 컴포넌트
 * - bold/italic/underline/strikethrough, color/fontSize/background 등
 * - Slate.js 에디터에서 여러 텍스트 스타일(마크, 색상 등)을 동시에 중첩 적용해 렌더링하는 컴포넌트
 * - 다양한 효과가 동시에 적용되어도 한 번에 합쳐서 충돌 없이 출력함
 */

'use client';

import React from 'react';
import { RenderLeafProps } from 'slate-react';

// 인라인 텍스트(leaf) 렌더 함수
const Leaf = ({ attributes, children, leaf }: RenderLeafProps) => {
  // CSS 스타일 속성 정의
  const style: React.CSSProperties = {};
  if (leaf.color) style.color = leaf.color;
  if (leaf.fontSize) style.fontSize = leaf.fontSize;
  if (leaf.backgroundColor) style.backgroundColor = leaf.backgroundColor;

  // 텍스트 마크(중첩 렌더)
  if (leaf.bold) children = <strong>{children}</strong>;
  if (leaf.italic) children = <em>{children}</em>;
  if (leaf.underline) children = <u>{children}</u>;
  if (leaf.strikethrough) children = <s>{children}</s>;

  // 최종 span 반환
  return (
    <span {...attributes} style={style}>
      {children}
    </span>
  );
};

export default Leaf;
