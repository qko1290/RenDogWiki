// =============================================
// File: app/components/editor/helpers/extractHeadings.ts
// =============================================
/**
 * Slate 에디터 json(본문 value)에서 모든 heading 요소 추출 유틸
 * - value(Descendant[]) 전체를 재귀 탐색하여 heading-one/two/three 노드만 추출
 * - heading level/텍스트/아이콘/unique id(slug) 등 목차 정보 구성
 * - slug(id)는 텍스트 기반 자동 생성, 동일 텍스트 중복시 -1, -2 등 유니크 처리
 * - icon: heading-three 등 custom icon 지원
 */

import { Descendant, Element as SlateElement, Text } from 'slate';

// heading 타입별 기본 아이콘
const headingIcons = {
  'heading-one': '📌',
  'heading-two': '🔖',
  'heading-three': '📝',
} as const;

/**
 * [heading 추출 함수]
 * - value: Descendant[] (슬레이트 본문 json)
 * - 반환: { text, id, level, icon }[]
 */
export const extractHeadings = (value: Descendant[]) => {
  // 목차 결과 저장
  const headings: { text: string; id: string; level: 1 | 2 | 3; icon: string }[] = [];

  // slug 중복 방지: baseSlug -> count 맵
  const slugMap = new Map<string, number>();

  /**
   * [재귀 탐색 함수]
   * - 모든 노드 순회, heading-one/two/three만 추출
   */
  const walk = (nodes: Descendant[]) => {
    for (const node of nodes) {
      // 1. Slate element 타입인지 확인
      if (!SlateElement.isElement(node)) continue;

      // 2. heading 노드 판별(1/2/3)
      if (
        node.type === 'heading-one' ||
        node.type === 'heading-two' ||
        node.type === 'heading-three'
      ) {
        // heading의 텍스트만 추출
        const textOnly = (node.children ?? [])
          .filter(child => Text.isText(child))
          .map(child => child.text)
          .join('')
          .trim();

        // slug/id 생성: 이모지/기호 제거 후, 공백 -> - 변환
        // (slug가 공백/기호/이모지만 있으면 untitled-랜덤)
        const cleanText = textOnly.replace(/^[^\w\s]|[\u{1F300}-\u{1F6FF}]/gu, '').trim();
        const baseSlug = cleanText.toLowerCase().replace(/\s+/g, '-');

        // 동일 slug 중복 체크(숫자 붙여 유니크 보장)
        const count = slugMap.get(baseSlug) || 0;
        slugMap.set(baseSlug, count + 1);

        const uniqueSlug =
          count > 0
            ? `${baseSlug}-${count}`
            : baseSlug || `untitled-${Math.random().toString(36).slice(2, 6)}`;

        // heading 레벨, 아이콘(커스텀 있으면 사용, 없으면 기본값)
        const level = node.type === 'heading-one' ? 1 : node.type === 'heading-two' ? 2 : 3;
        const icon = (node as any).icon || headingIcons[node.type];

        // 결과 추가
        headings.push({
          text: textOnly,
          id: `heading-${uniqueSlug}`,
          level,
          icon,
        });
      }

      // 3. 하위(children) 재귀 탐색
      if (node.children) {
        walk(node.children as Descendant[]);
      }
    }
  };

  // 본문 전체 재귀 탐색 시작
  walk(value);

  // 결과 반환
  return headings;
};
