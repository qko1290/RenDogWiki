import React from 'react';

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
  openPaths: number[][];
  closingPaths: number[][];
  togglePath: (path: number[]) => void;
  toggleArrowOnly: (path: number[]) => void;
  isPathOpen: (path: number[]) => boolean;
};

const CategoryTree: React.FC<Props> = ({
  categories, categoryIdMap, categoryIdToPathMap,
  selectedDocPath, selectedCategoryPath,
  setSelectedDocPath, setSelectedDocId, setSelectedDocTitle, setSelectedCategoryPath,
  fetchDoc, allDocuments,
  openPaths, closingPaths, togglePath, toggleArrowOnly, isPathOpen
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
      const isOpen = isPathOpen(currentPath);
      const docs = getDocumentsForCategory(currentPath);

      const isCategoryActive =
        node.document_id != null &&
        selectedCategoryPath &&
        JSON.stringify(selectedCategoryPath) === JSON.stringify(currentPath);

      return (
        <li key={`cat-${node.id}`}>
          <button
            className={`wiki-nav-item ${isCategoryActive ? 'active' : ''}`}
            onClick={async () => {
              if (node.document_id != null) {
                const isActive =
                  selectedCategoryPath &&
                  JSON.stringify(selectedCategoryPath) === JSON.stringify(currentPath);
                if (!isActive) {
                  await togglePath(currentPath); // 대표문서 열기
                } else {
                  toggleArrowOnly(currentPath); // 펼침/접힘
                }
              } else {
                toggleArrowOnly(currentPath);
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
            {(node.children?.length || docs.length) > 0 && (
              <span
                className="wiki-category-arrow"
                style={{ cursor: 'pointer', opacity: node.document_id != null ? 1 : 0.5 }}
                onClick={e => {
                  e.stopPropagation();
                  if (node.document_id != null) {
                    const isActive =
                      selectedCategoryPath &&
                      JSON.stringify(selectedCategoryPath) === JSON.stringify(currentPath);
                    if (!isActive) {
                      togglePath(currentPath);
                    } else {
                      toggleArrowOnly(currentPath);
                    }
                  }
                }}
              >
                {isOpen ? '▼' : '▶'}
              </span>
            )}
          </button>
          <ul
            className={
              openPaths.some((p) => JSON.stringify(p) === JSON.stringify(currentPath))
                ? "wiki-doc-list open"
                : closingPaths.some((p) => JSON.stringify(p) === JSON.stringify(currentPath))
                ? "wiki-doc-list closing"
                : "wiki-doc-list"
            }
          >
            {(isOpen || closingPaths.some((p) => JSON.stringify(p) === JSON.stringify(currentPath))) && (
              <>
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
                {node.children && renderTree(node.children, currentPath)}
              </>
            )}
          </ul>
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
