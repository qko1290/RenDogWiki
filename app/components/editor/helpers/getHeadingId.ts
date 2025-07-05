// =============================================
// File: app/components/editor/helpers/getHeadingId.ts
// =============================================
/**
 * heading element의 텍스트를 기반으로 "heading-슬러그" 형태의 id 생성 유틸
 * - Slate heading 노드 전체 텍스트 추출
 * - 이모지/기호 제거, 공백 -> '-', 모두 소문자화
 * - slug가 빈값일 경우 랜덤문자 보충
 */

import { Element as SlateElement, Node } from 'slate';

/**
 * [heading id 생성 함수]
 * - 입력: Slate heading element
 * - 반환: "heading-슬러그"
 */
export const getHeadingId = (element: SlateElement) => {
  // 1. heading 전체 텍스트 추출
  const raw = Node.string(
    element || { type: 'paragraph', children: [{ text: '' }] } as any
  ).trim();

  // 2. 이모지/기호 제거, 앞뒤 공백 제거
  const cleaned = raw.replace(/^[^\w\s]|[\u{1F300}-\u{1F6FF}]/gu, '').trim();

  // 3. 소문자/공백→'-', 빈값이면 랜덤문자 보충
  const slug =
    cleaned.toLowerCase().replace(/\s+/g, '-') ||
    `untitled-${Math.random().toString(36).slice(2, 6)}`;

  // 4. heading id 반환
  return `heading-${slug}`;
};
