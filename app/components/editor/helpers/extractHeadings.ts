// File: app/components/editor/helpers/extractHeadings.ts

/**
 * 에디터에서 사용하는 json 파일에서 모든 heading 요소 추출 유틸
 * - 에디터 본문 전체를 재귀 탐색, heading 레벨/텍스트/아이콘/unique id를를 추출
 * - 목차/네비게이션/자동 스크롤 등에서 활용
 * - slug(id)는 텍스트 기반 자동 생성, 중복시 번호 붙여 유니크 보장
 */

import { Descendant, Element as SlateElement, Text } from 'slate';

// 헤딩별 기본 아이콘
const headingIcons = {
  'heading-one': '📌',
  'heading-two': '🔖',
  'heading-three': '📝',
} as const;

export const extractHeadings = (value: Descendant[]) => {
  // 목차 배열 (레벨/텍스트/유니크id/아이콘)
  const headings: { text: string; id: string; level: 1 | 2 | 3; icon: string }[] = [];

  // heading id 유니크 보장용
  const slugMap = new Map<string, number>();

  // 재귀 탐색: 본문의 모든 노드 순회
  const walk = (nodes: Descendant[]) => {
    for (const node of nodes) {
      if (!SlateElement.isElement(node)) continue;

      // heading 노드 판별
      if (
        node.type === 'heading-one' ||
        node.type === 'heading-two' ||
        node.type === 'heading-three'
      ) {
        // 텍스트만 추출
        const textOnly = (node.children ?? [])
          .filter(child => Text.isText(child))
          .map(child => child.text)
          .join('')
          .trim();

        // 슬러그용 텍스트(이모지/기호 제거)
        const cleanText = textOnly.replace(/^[^\w\s]|[\u{1F300}-\u{1F6FF}]/gu, '').trim();
        const baseSlug = cleanText.toLowerCase().replace(/\s+/g, '-');

        // 유니크 id 보장(동일 heading 중복시 slug-1, slug-2 ...)
        const count = slugMap.get(baseSlug) || 0;
        slugMap.set(baseSlug, count + 1);

        const uniqueSlug =
          count > 0
            ? `${baseSlug}-${count}`
            : baseSlug || `untitled-${Math.random().toString(36).slice(2, 6)}`;

        // heading 레벨, 아이콘(커스텀 우선, 없으면 기본값)
        const level = node.type === 'heading-one' ? 1 : node.type === 'heading-two' ? 2 : 3;
        const icon = (node as any).icon || headingIcons[node.type];

        headings.push({
          text: textOnly,
          id: `heading-${uniqueSlug}`,
          level,
          icon,
        });
      }

      // 하위 노드 재귀 탐색
      if (node.children) {
        walk(node.children as Descendant[]);
      }
    }
  };

  walk(value);
  return headings;
};
