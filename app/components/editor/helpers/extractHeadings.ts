// =============================================
// File: app/components/editor/helpers/extractHeadings.ts
// =============================================
/**
 * Slate 에디터의 본문(Descendant[])에서 heading 요소만 추출해
 * 목차용 배열로 반환하는 유틸리티 함수.
 * - heading-one/two/three만 대상
 * - 텍스트는 Node.string으로 안전 추출
 * - id는 getHeadingId 규칙으로 통일
 * - icon은 항상 string으로 반환(없으면 빈 문자열)
 */

import { Descendant, Element as SlateElement, Node } from 'slate';
import { getHeadingId } from './getHeadingId';

export type Heading = {
  id: string;
  level: 1 | 2 | 3;
  text: string;
  icon: string; // ✅ 필수 string
};

export function extractHeadings(value: Descendant[]): Heading[] {
  const result: Heading[] = [];

  const walk = (nodes: Descendant[]) => {
    for (const node of nodes) {
      if (!SlateElement.isElement(node)) continue;

      if (
        node.type === 'heading-one' ||
        node.type === 'heading-two' ||
        node.type === 'heading-three'
      ) {
        const level: 1 | 2 | 3 =
          node.type === 'heading-one' ? 1 :
          node.type === 'heading-two' ? 2 : 3;

        const text = Node.string(node).trim();
        const id = getHeadingId(node as any);
        const icon = String((node as any).icon ?? ''); // ✅ 항상 string

        result.push({ id, level, text, icon });
      }

      if (node.children) {
        walk(node.children as Descendant[]);
      }
    }
  };

  walk(value);
  return result;
}