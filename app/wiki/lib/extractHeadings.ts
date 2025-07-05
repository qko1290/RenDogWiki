// =============================================
// File: app/wiki/lib/extractHeadings.ts
// =============================================
/**
 * Descendant(슬레이트 문서 트리)에서 heading(제목) 노드만 추출
 * - heading 레벨/텍스트/아이콘/id 등 목차 데이터로 변환
 * - TableOfContents, 문서 목차 등에서 공통 사용
 */

import { Descendant } from 'slate';

export function extractHeadings(value: Descendant[]) {
  // 목차 결과 저장 배열
  const result: { id: string; level: number; text: string; icon?: string }[] = [];

  // 재귀적으로 트리를 탐색
  const visit = (nodes: Descendant[]) => {
    for (const node of nodes) {
      // heading 타입만 필터링
      if ('type' in node && node.type?.startsWith('heading')) {
        // heading 레벨 계산
        const level =
          node.type === 'heading-one' ? 1 :
          node.type === 'heading-two' ? 2 : 3;

        // 자식의 text 모두 합침(한 heading 내부에 여러 조각 가능)
        const text = node.children.map((c: any) => c.text).join('');

        // heading id: 텍스트 기준으로 마크다운/슬러그형 생성
        const id = 'heading-' + text
          .replace(/<[^>]*>/g, '')      // 태그 제거
          .replace(/\s+/g, '-')         // 공백을 -
          .toLowerCase();

        // heading 정보 추가
        result.push({
          id,
          level,
          text,
          icon: (node as any).icon || '',
        });
      }

      // 하위 children도 재귀 탐색
      if ('children' in node) visit(node.children as Descendant[]);
    }
  };

  // 문서 트리 전체 순회
  visit(value);

  // 최종 목차 데이터 반환
  return result;
}
