// =============================================
// File: components/wiki/CategoryTree.tsx
// =============================================
/**
 * 카테고리 + 문서 트리 재귀 컴포넌트
 * - 트리 구조로 카테고리 및 문서 목록 렌더링
 * - 클릭 시 문서/카테고리 열기
 */

import React from 'react';

// 타입 정의
type CategoryNode = {
  id: number;
  name: string;
  icon?: string;
  order?: number;
  document_id?: number;
  children?: CategoryNode[];
};
type Document = {
  id: number;
  title: string;
  path: string | number;
  icon?: string;
  fullPath?: number[];
  is_featured?: boolean;
};

// Props
type Props = {
  categories: CategoryNode[];
  categoryIdMap: Record<number, CategoryNode>;
  categoryIdToPathMap: Record<number, number[]>;
  selectedDocPath: number[] | null;
  selectedCategoryPath: number[] | null;
  setSelectedDocPath: (path: number[] | null) => void;
  setSelectedDocId: (id: number | null) => void;
  setSelectedDocTitle: (title: string | null) => void;
  setSelectedCategoryPath: (path: number[] | null) => void;
  fetchDoc: (categoryPath: number[], docTitle: string, docId?: number, options?: { clearCategoryPath?: boolean }) => void;
  allDocuments: Document[];
};

// 실제 트리 컴포넌트
const CategoryTree: React.FC<Props> = ({
  categories, categoryIdMap, categoryIdToPathMap,
  selectedDocPath, selectedCategoryPath,
  setSelectedDocPath, setSelectedDocId, setSelectedDocTitle, setSelectedCategoryPath,
  fetchDoc, allDocuments,
}) => {
  // 특정 카테고리의 문서 목록 필터
  const getDocumentsForCategory = (pathArr: number[]) => {
    return allDocuments.filter(
      doc => JSON.stringify(doc.fullPath) === JSON.stringify(pathArr) && !doc.is_featured
    );
  };

  // 트리 재귀 렌더
  const renderTree = (nodes: CategoryNode[], parentPath: number[] = []) => {
    return nodes.map(node => {
      const currentPath = [...parentPath, node.id];
      const docs = getDocumentsForCategory(currentPath);

      // 선택 상태(강조)
      const isCategoryActive =
        node.document_id != null &&
        selectedCategoryPath &&
        JSON.stringify(selectedCategoryPath) === JSON.stringify(currentPath);

      return (
        <li key={`cat-${node.id}`}>
          <button
            className={`wiki-nav-item ${isCategoryActive ? 'active' : ''}`}
            onClick={() => {
              if (node.document_id != null) {
                const isActive =
                  selectedCategoryPath &&
                  JSON.stringify(selectedCategoryPath) === JSON.stringify(currentPath);

                if (!isActive) {
                  fetchDoc(currentPath, categoryIdMap[node.id]?.name || '', node.document_id);
                }
              }
            }}
          >
            {node.icon && (
              <span className="wiki-category-icon" style={{ marginRight: '0.3em' }}>
                {node.icon.startsWith('http') ? (
                  <img src={node.icon} alt="icon" style={{ width: '1em', verticalAlign: 'middle' }} />
                ) : (
                  node.icon
                )}
              </span>
            )}
            <span className="wiki-category-label">{node.name}</span>
          </button>
          {node.children && node.children.length > 0 && (
            <ul>
              {renderTree(node.children, currentPath)}
            </ul>
          )}
          {docs && docs.length > 0 && (
            <ul>
              {docs.map(doc => (
                <li
                  key={`doc-${doc.title}`}
                  className={`wiki-doc-item`}
                  onClick={() => fetchDoc(currentPath, doc.title, doc.id, { clearCategoryPath: true })}
                >
                  <span style={{ marginRight: '0.3em' }}>
                    {doc.icon?.startsWith('http') ? (
                      <img src={doc.icon} alt="icon" style={{ width: '1em', verticalAlign: 'middle' }} />
                    ) : (
                      doc.icon || '📄'
                    )}
                  </span>
                  {doc.title}
                </li>
              ))}
            </ul>
          )}
        </li>
      );
    });
  };

  return (
    <ul className="wiki-nav-list">
      {renderTree(categories)}
    </ul>
  );
};

export default CategoryTree;
