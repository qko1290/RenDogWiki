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

/** 폰트 크기 보정: 숫자 또는 숫자문자 → px 단위로 정규화 */
function normalizeFontSize(v: unknown): string | number | undefined {
  if (v == null) return undefined;
  if (typeof v === 'number') return Math.max(1, v);         // 음수/0 방지
  if (typeof v === 'string') {
    const s = v.trim();
    if (!s) return undefined;
    // 이미 단위가 있으면 그대로 사용
    if (/(px|rem|em|%|vh|vw)$/i.test(s)) return s;
    // 숫자면 px로
    if (/^\d+(\.\d+)?$/.test(s)) return `${s}px`;
    return s;
  }
  return undefined;
}

const Leaf = ({ attributes, children, leaf }: RenderLeafProps) => {
  // 텍스트 스타일(색상, 크기, 배경)
  const style: React.CSSProperties = {};
  if (leaf.color) style.color = String(leaf.color);
  const fs = normalizeFontSize(leaf.fontSize);
  if (fs !== undefined) style.fontSize = fs as any;
  if (leaf.backgroundColor) style.backgroundColor = String(leaf.backgroundColor);

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
