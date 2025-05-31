// File: app/components/editor/helpers/getHeadingId.ts

/**
 * - heading의 텍스트를 기반으로 "heading-슬러그" 형태 id 생성
 * - 이모지/특수기호 제거, 공백은 "-"로 치환, 중복/빈값이면 랜덤문자 보충
 */

import { Element as SlateElement, Node } from 'slate';

export const getHeadingId = (element: SlateElement) => {
  // Node.string: heading 전체 텍스트 추출(하위 child까지 합침)
  const raw = Node.string(
    element || { type: 'paragraph', children: [{ text: '' }] } as any
  ).trim();

  // 이모지·기호 제거, 앞뒤 공백 제거
  const cleaned = raw.replace(/^[^\w\s]|[\u{1F300}-\u{1F6FF}]/gu, '').trim();

  // 소문자·공백은 '-'로 치환, 빈값이면 랜덤문자 보충
  const slug =
    cleaned.toLowerCase().replace(/\s+/g, '-') ||
    `untitled-${Math.random().toString(36).slice(2, 6)}`;

  // heading-id 최종 반환
  return `heading-${slug}`;
};
