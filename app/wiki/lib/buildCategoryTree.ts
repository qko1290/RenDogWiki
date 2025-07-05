// =============================================
// File: app/wiki/lib/buildCategoryTree.ts
// =============================================
/**
 * DB에서 flat으로 가져온 카테고리 목록을
 * - 트리형 CategoryNode 구조로 변환해주는 유틸 함수
 * - 하위 children 연결 및 order 기준 정렬까지 수행
 * - 카테고리 트리 렌더/검색/이동/정렬 등에서 공통 사용
 */

// 타입 정의: 기본 Category + children 재귀 구조
type Category = {
  id: number;
  name: string;
  parent_id: number | null;
  order: number;
  document_path?: string;
  icon?: string;
};
type CategoryNode = Category & {
  children: CategoryNode[];
};

 // flatList -> 트리형 CategoryNode[] 변환 함수
export function buildCategoryTree(flatList: Category[]): CategoryNode[] {
  const map = new Map<number, CategoryNode>(); // id별 노드 캐싱
  const roots: CategoryNode[] = [];            // 루트 노드(최상위)

  // 1. id 기준으로 모든 카테고리를 map에 등록
  for (const item of flatList) {
    map.set(item.id, { ...item, children: [] });
  }

  // 2. parent_id 기준으로 부모-자식 트리 연결
  for (const item of flatList) {
    const node = map.get(item.id)!;
    if (item.parent_id === null) {
      // 루트(최상위) 노드
      roots.push(node);
    } else {
      // 부모 노드의 children에 현재 노드 추가
      const parent = map.get(item.parent_id);
      parent?.children.push(node);
    }
  }

  // 3. order(정렬 순서) 기준으로 자식들까지 정렬(재귀)
  const sortChildren = (nodes: CategoryNode[]) => {
    nodes.sort((a, b) => a.order - b.order);
    nodes.forEach(child => sortChildren(child.children));
  };
  sortChildren(roots);

  // 4. 최상위 루트 노드 배열 반환
  return roots;
}
