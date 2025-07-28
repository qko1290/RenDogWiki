// =============================================
// File: app/components/editor/helpers/extractHeadings.ts
// =============================================
/**
 * Slate 에디터의 본문(Descendant[])에서 heading 요소만 추출해
 * 목차용 배열로 반환하는 유틸리티 함수.
 * - heading-one, heading-two, heading-three 타입만 대상으로 삼음
 * - 각 heading의 level, 텍스트, 아이콘, 고유 id(slug) 등 반환
 * - slug는 동일 텍스트가 있으면 -1, -2 등으로 유니크 보장
 * - heading-three는 custom icon(커스텀 아이콘)도 허용
 */

import { Descendant, Element as SlateElement, Text } from 'slate';

// heading 레벨별 기본 아이콘
const headingIcons = {
  'heading-one': '📌',
  'heading-two': '🔖',
  'heading-three': '📝',
} as const;

/**
 * [extractHeadings]
 * - Slate 에디터 value(Descendant[])에서 목차 정보 추출
 * - 반환: [{ text, id, level, icon }]
 */
export const extractHeadings = (value: Descendant[]) => {
  // 추출된 heading 정보 저장 배열
  const headings: { text: string; id: string; level: 1 | 2 | 3; icon: string }[] = [];

  // slug 유니크 보장용 맵
  const slugMap = new Map<string, number>();

  /**
   * [walk]
   * - Slate 노드(Descendant[])를 순회하며 heading 노드를 추출
   * - heading이 아니면 children 재귀 탐색
   */
  const walk = (nodes: Descendant[]) => {
    for (const node of nodes) {
      // Slate Element만 검사
      if (!SlateElement.isElement(node)) continue;

      // heading 노드(1,2,3)만 처리
      if (
        node.type === 'heading-one' ||
        node.type === 'heading-two' ||
        node.type === 'heading-three'
      ) {
        // 텍스트만 추출 (children에 text가 여러 개일 수도 있음)
        const textOnly = (node.children ?? [])
          .filter(child => Text.isText(child))
          .map(child => child.text)
          .join('')
          .trim();

        // slug/id 생성: 이모지, 기호 등 제거, 공백 → -
        // (공백/이모지/기호만 있을 경우 untitled-xxxx로 대체)
        const cleanText = textOnly.replace(/^[^\w\s]|[\u{1F300}-\u{1F6FF}]/gu, '').trim();
        const baseSlug = cleanText.toLowerCase().replace(/\s+/g, '-');

        // 동일 slug 중복 처리 (baseSlug-1, -2, ...)
        const count = slugMap.get(baseSlug) || 0;
        slugMap.set(baseSlug, count + 1);
        const uniqueSlug =
          count > 0
            ? `${baseSlug}-${count}`
            : baseSlug || `untitled-${Math.random().toString(36).slice(2, 6)}`;

        // heading 레벨: 1, 2, 3
        const level = node.type === 'heading-one' ? 1 : node.type === 'heading-two' ? 2 : 3;

        // 아이콘: 커스텀(icon 필드)이 있으면 사용, 없으면 기본값
        const icon = (node as any).icon || headingIcons[node.type];

        // headings 배열에 추가
        headings.push({
          text: textOnly,
          id: `heading-${uniqueSlug}`,
          level,
          icon,
        });
      }

      // 자식이 있으면 재귀 순회
      if (node.children) {
        walk(node.children as Descendant[]);
      }
    }
  };

  // 전체 본문에서 heading 추출 시작
  walk(value);

  // 최종 목차 배열 반환
  return headings;
};
