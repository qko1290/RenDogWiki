// =============================================
// File: app/wiki/lib/extractHeadings.ts
// =============================================
/**
 * Descendant(슬레이트 문서 트리)에서 heading(제목) 노드만 추출
 * - heading 레벨/텍스트/아이콘/id 등 목차 데이터로 변환
 * - id 규칙은 텍스트 기반 슬러그로 통일
 * - icon은 항상 string으로 반환(없으면 빈 문자열)
 */

import { Descendant, Element as SlateElement, Node } from "slate";

export type Heading = {
  id: string;
  level: 1 | 2 | 3;
  text: string;
  icon: string; // ✅ 필수 string
};

function toHeadingIdFromText(text: string): string {
  // ❗ 한글 첫 글자를 잘라먹던 부분 수정
  //  - 예전: /^[^\w\s]|[\u{1F300}-\u{1F6FF}]/
  //    → \w 에 한글이 포함되지 않아 "강화석" → "화석"
  //
  //  - 지금: 이모지(1F300~1FAFF)만 지우고, 나머지 글자는 그대로 둠
  //    → "강화석" 그대로 유지
  const cleaned = text
    .replace(/[\u{1F300}-\u{1FAFF}]/gu, "") // 이모지만 제거
    .trim();

  const slug =
    cleaned.toLowerCase().replace(/\s+/g, "-") ||
    `untitled-${Math.random().toString(36).slice(2, 6)}`;

  return `heading-${slug}`;
}

export function extractHeadings(value: Descendant[]): Heading[] {
  const result: Heading[] = [];

  const visit = (nodes: Descendant[]) => {
    for (const node of nodes) {
      if (!SlateElement.isElement(node)) continue;

      if (
        node.type === "heading-one" ||
        node.type === "heading-two" ||
        node.type === "heading-three"
      ) {
        const level: 1 | 2 | 3 =
          node.type === "heading-one"
            ? 1
            : node.type === "heading-two"
            ? 2
            : 3;

        const text = Node.string(node).trim();
        const id = toHeadingIdFromText(text);
        const icon = String((node as any).icon ?? ""); // ✅ 항상 string

        result.push({ id, level, text, icon });
      }

      if ((node as any).children) {
        visit((node as any).children as Descendant[]);
      }
    }
  };

  visit(value);
  return result;
}
