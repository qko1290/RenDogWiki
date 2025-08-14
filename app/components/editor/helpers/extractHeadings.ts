// File: app/components/editor/helpers/extractHeadings.ts
// =============================================
// 목적: Slate 본문(Descendant[])에서 heading 요소만 뽑아 목차 데이터로 변환
// 사용처: 문서 상세 화면의 목차(TOC) 생성
// - 대상: heading-one / heading-two / heading-three
// - 텍스트: Node.string으로 안전 추출
// - id: getHeadingId 규칙 사용(호출처와 일관성 유지)
// - icon: 항상 string으로 강제(없으면 빈 문자열)
// =============================================

import { Descendant, Element as SlateElement, Node } from 'slate';
import { getHeadingId } from './getHeadingId';

export type Heading = {
  id: string;
  level: 1 | 2 | 3;
  text: string;
  icon: string;
};

// 내부 전용 타입: 우리가 관심 있는 heading 엘리먼트의 모양만 좁혀서 사용
type HeadingElement = SlateElement & {
  type: 'heading-one' | 'heading-two' | 'heading-three';
  icon?: unknown;
  children: Descendant[];
};

export function extractHeadings(value: Descendant[]): Heading[] {
  const result: Heading[] = [];

  const walk = (nodes: Descendant[]) => {
    for (const node of nodes) {
      if (!SlateElement.isElement(node)) continue;

      // 관심 있는 heading 타입만 선별
      const t = node.type as string;
      if (t === 'heading-one' || t === 'heading-two' || t === 'heading-three') {
        const el = node as HeadingElement;
        const level: 1 | 2 | 3 = t === 'heading-one' ? 1 : t === 'heading-two' ? 2 : 3;

        // 텍스트는 Slate가 보장하는 집계 API로 추출
        const text = Node.string(el).trim();

        // id는 별도 규칙 적용(호출처와 동일 규칙 유지)
        const id = getHeadingId(el);

        // icon은 어떤 타입이 와도 문자열로 강제
        const icon =
          typeof el.icon === 'string' ? el.icon : String(el.icon ?? '');

        result.push({ id, level, text, icon });
      }

      // 하위 노드 재귀 순회
      if ((node as any).children) {
        walk((node as any).children as Descendant[]);
      }
    }
  };

  walk(value);
  return result;
}
