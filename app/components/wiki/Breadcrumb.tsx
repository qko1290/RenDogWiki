// =============================================
// File: components/wiki/Breadcrumb.tsx
// =============================================
/**
 * 브레드크럼(카테고리 경로) 출력 컴포넌트
 * - 최상위/중간 카테고리 경로 표시, ←(뒤로) 버튼 제공
 */

import React from 'react';

// 타입
type CategoryNode = {
  id: number;
  name: string;
  children?: CategoryNode[];
};
type Props = {
  selectedDocPath: number[] | null;
  categories: CategoryNode[];
  setSelectedDocPath: (path: number[] | null) => void;
  setSelectedDocTitle: (title: string | null) => void;
  setDocContent: (content: any) => void;
};

// 경로에서 카테고리 이름 추출
function getCategoryNamesFromPath(tree: CategoryNode[], path: number[]): string[] {
  const names: string[] = [];
  let currentTree = tree;
  for (const id of path) {
    const match = currentTree.find(node => node.id === id);
    if (!match) break;
    names.push(match.name);
    currentTree = match.children || [];
  }
  return names;
}

// 본문
const Breadcrumb: React.FC<Props> = ({
  selectedDocPath, categories,
  setSelectedDocPath, setSelectedDocTitle, setDocContent,
}) => (
  <div className="wiki-breadcrumb">
    {selectedDocPath ? (
      <div className="wiki-breadcrumb-flex">
        <button
          className="wiki-back-button"
          onClick={() => {
            setSelectedDocPath(null);
            setSelectedDocTitle(null);
            setDocContent([]);
          }}
        >
          ←
        </button>
        <span>{getCategoryNamesFromPath(categories, selectedDocPath).join(' > ')}</span>
      </div>
    ) : (
      <span>렌독 위키 - 문서 목록</span>
    )}
  </div>
);

export default Breadcrumb;
