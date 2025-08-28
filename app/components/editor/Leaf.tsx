// =============================================
// File: app/components/editor/Leaf.tsx
// =============================================
/**
 * Slate.js 인라인 텍스트(leaf) 렌더링 컴포넌트
 * - bold/italic/underline/strikethrough, color/fontSize/backgroundColor/fontFamily 지원
 * - 폰트 크기 보정: 손글씨 계열은 기본보다 살짝 크게 렌더
 */

'use client';

import React from 'react';
import { RenderLeafProps } from 'slate-react';

/** 숫자/문자 폰트크기를 px·em·rem 그대로 허용하되 숫자면 px 부여 */
function normalizeFontSize(v: unknown): string | number | undefined {
  if (v == null) return undefined;
  if (typeof v === 'number') return Math.max(1, v);
  if (typeof v === 'string') {
    const s = v.trim();
    if (!s) return undefined;
    if (/(px|rem|em|%|vh|vw)$/i.test(s)) return s;
    if (/^\d+(\.\d+)?$/.test(s)) return `${s}px`;
    return s; // 그 외는 그대로
  }
  return undefined;
}

/** px 값 추출 (px 또는 number만 파싱) */
function toPxNumber(v: string | number | undefined): number | undefined {
  if (v == null) return undefined;
  if (typeof v === 'number') return v;
  const m = /^(-?\d+(?:\.\d+)?)px$/i.exec(v);
  return m ? parseFloat(m[1]) : undefined;
}

/** 손글씨 등 특정 family는 살짝 키워서 보정 */
const HANDWRITING_SCALE: Record<string, number> = {
  BareunHippy: 1.18,                    // 나눔손글씨 바른히피
  NanumHandwritingMiddleSchool: 1.14,   // 나눔손글씨 중학생
};

const Leaf = ({ attributes, children, leaf }: RenderLeafProps) => {
  // ── 스타일 기본값 구성 ──────────────────────────────────
  const style: React.CSSProperties = {};

  // 글자색/배경
  if (leaf.color) style.color = String(leaf.color);
  if (leaf.backgroundColor) style.backgroundColor = String(leaf.backgroundColor);

  // 폰트 패밀리
  const family = leaf.fontFamily ? String(leaf.fontFamily) : undefined;
  if (family) style.fontFamily = family;

  // 폰트 크기 + 손글씨 보정
  const normalized = normalizeFontSize(leaf.fontSize);
  const basePx = toPxNumber(normalized);
  const scale =
    family && HANDWRITING_SCALE[family] ? HANDWRITING_SCALE[family] : 1;

  if (scale !== 1) {
    if (typeof basePx === 'number') {
      // px 기반 크기가 지정되어 있으면 그 값에 스케일 곱
      style.fontSize = `${Math.round(basePx * scale)}px`;
    } else if (normalized !== undefined) {
      // px 이외 단위(rem/em/%)가 들어온 경우는 건드리지 않음
      style.fontSize = normalized as any;
    } else {
      // 별도 크기 지정이 없으면 손글씨만 기본을 약간 키움
      style.fontSize = `${scale}em`;
    }
    // 손글씨는 줄간 조금 넉넉하게
    style.lineHeight = style.lineHeight ?? 1.35;
  } else {
    if (normalized !== undefined) style.fontSize = normalized as any;
  }

  // 텍스트 마크(굵게/이탤릭/밑줄/취소선)
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
