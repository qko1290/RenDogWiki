// =============================================
// File: app/components/editor/helpers/getHeadingId.ts
// =============================================
/**
 * heading element의 텍스트 내용을 기반으로 목차/앵커용 id("heading-슬러그")를 생성하는 유틸리티 함수
 * - Slate heading 노드에서 전체 텍스트 추출
 * - 이모지/특수문자/기호를 모두 제거, 공백은 '-'로 변환, 소문자 처리
 * - 슬러그가 비면 untitled-xxxx로 대체하여 항상 유니크 id 보장
 */

import { Element as SlateElement, Node } from 'slate';

/**
 * getHeadingId
 * - Slate heading 엘리먼트에서 "heading-슬러그" 형태의 id를 생성
 * @param element Slate heading element (heading-one/two/three 등)
 * @returns string ("heading-슬러그" 형식)
 */
export const getHeadingId = (element: SlateElement) => {
  // 1. 해당 heading의 전체 텍스트 추출 (자식이 여러 개일 경우 모두 합침)
  const raw = Node.string(
    element || { type: 'paragraph', children: [{ text: '' }] } as any
  ).trim();

  // 2. 이모지/기호/특수문자 제거, 앞뒤 공백 제거
  const cleaned = raw.replace(/^[^\w\s]|[\u{1F300}-\u{1F6FF}]/gu, '').trim();

  // 3. 소문자화 및 공백을 '-'로 변환
  //    (slug가 비면 'untitled-xxxx' 형태의 난수로 대체)
  const slug =
    cleaned.toLowerCase().replace(/\s+/g, '-') ||
    `untitled-${Math.random().toString(36).slice(2, 6)}`;

  // 4. 최종 heading id 반환
  return `heading-${slug}`;
};
