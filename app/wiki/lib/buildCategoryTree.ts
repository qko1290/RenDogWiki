// File: app/wiki/lib/buildCategoryTree.ts

/**
 * DB에서 flat(1차원)으로 가져온 카테고리 목록을
 * - 트리형 CategoryNode 구조로 변환해주는 유틸 함수
 * - 하위 children 연결 및 order 기준 정렬까지 수행
 * - 카테고리 트리 렌더/검색/이동/정렬 등에서 공통 사용
 */

// 타입 정의
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

// 트리 빌드 함수
export function buildCategoryTree(flatList: Category[]): CategoryNode[] {
  const map = new Map<number, CategoryNode>();
  const roots: CategoryNode[] = [];

  // 1. 각 카테고리 노드를 id 기준으로 map에 등록
  for (const item of flatList) {
    map.set(item.id, { ...item, children: [] });
  }

  // 2. parent_id 기준으로 트리 구조 연결
  for (const item of flatList) {
    const node = map.get(item.id)!;
    if (item.parent_id === null) {
      roots.push(node);
    } else {
      const parent = map.get(item.parent_id);
      parent?.children.push(node);
    }
  }

  // 3. 각 레벨별 order 기준 정렬, 재귀 호출 하여 자식까지 정렬
  const sortChildren = (nodes: CategoryNode[]) => {
    nodes.sort((a, b) => a.order - b.order);
    nodes.forEach(child => sortChildren(child.children));
  };
  sortChildren(roots);

  // 4. 최상위 루트 노드 리스트 반환
  return roots;
}
