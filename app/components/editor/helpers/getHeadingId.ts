// File: app/components/editor/helpers/getHeadingId.ts
// =============================================
// 목적: heading 요소의 텍스트로 목차/앵커용 id("heading-슬러그") 생성
// 사용처: 문서 본문 TOC, 내부 앵커 링크
// - 텍스트 추출: Node.string (안전)
// - 정규화: 전각/호환 문자 NFKC 정규화
// - 규칙: 모든 언어의 글자/숫자는 유지, 그 외 문자는 하이픈으로 치환
//   · 하이픈 연속 -> 1개로 압축, 앞뒤 하이픈 제거
//   · 슬러그가 비면 untitled-난수 부여(기존 동작 유지)
// - 공개 인터페이스/스키마 불변
// =============================================

import { Element as SlateElement, Node } from 'slate';

/**
 * getHeadingId
 * - Slate heading 엘리먼트에서 "heading-슬러그" 형태의 id를 생성
 * @param element Slate heading element (heading-one/two/three 등)
 * @returns string ("heading-슬러그" 형식)
 */
export const getHeadingId = (element: SlateElement) => {
  // 1) 해당 heading의 전체 텍스트 추출 (자식이 여러 개일 경우 모두 합침)
  const raw = Node.string(
    // 타입 시그니처는 그대로 두고, 방어적 폴백만 유지
    (element as any) || ({ type: 'paragraph', children: [{ text: '' }] } as any)
  ).trim();

  // 2) 유니코드 정규화(NFKC) 후 소문자화
  //    - 한글/다국어는 보존되고, 호환 문자 형태를 표준화
  const normalized = raw.normalize('NFKC').toLowerCase();

  // 3) 글자(모든 언어)·숫자·언더스코어·하이픈만 남기고 나머지는 하이픈으로 치환
  //    - 공백/기호/이모지 등은 하이픈으로 수렴
  let slug = normalized
    .replace(/[^\p{L}\p{N}_-]+/gu, '-') // 비허용 문자를 하이픈으로
    .replace(/-+/g, '-')                // 하이픈 연속 → 1개
    .replace(/^-+|-+$/g, '');           // 양끝 하이픈 제거

  // 4) 슬러그가 비면 untitled-xxxx로 대체(항상 문자열 반환)
  if (!slug) {
    slug = `untitled-${Math.random().toString(36).slice(2, 6)}`;
  }

  // 5) 최종 heading id 반환
  return `heading-${slug}`;
};
