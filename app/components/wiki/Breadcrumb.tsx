// =============================================
// File: components/wiki/Breadcrumb.tsx
// =============================================
import React, { useMemo } from 'react';

/**
 * 브레드크럼
 * - 카테고리 트리를 기반으로 현재 문서의 경로를 표시
 * - 조각 클릭 시 해당 카테고리로 이동(선택된 문서 제목/내용 초기화)
 */

type CategoryNode = {
  id: number;
  name: string;
  icon?: string;
  children?: CategoryNode[];
};

type Props = {
  selectedDocPath: number[] | null;
  categories: CategoryNode[];
  // 선택 시 상위로 이동할 때 외부 상태 초기화용(선택)
  setSelectedDocPath?: (path: number[] | null) => void;
  setSelectedDocTitle?: (t: string | null) => void;
  setDocContent?: (c: any) => void;
};

function getCategoryPathWithIcon(tree: CategoryNode[], path: number[]) {
  const items: { name: string; icon?: string; id: number }[] = [];
  let currentTree = tree;
  for (const id of path) {
    const match = currentTree.find((n) => n.id === id);
    if (!match) break;
    items.push({ name: match.name, icon: match.icon, id: match.id });
    currentTree = match.children || [];
  }
  return items;
}

const isImageUrl = (v?: string) => !!v && v.startsWith('http');

const Breadcrumb: React.FC<Props> = ({
  selectedDocPath,
  categories,
  setSelectedDocPath,
  setSelectedDocTitle,
  setDocContent,
}) => {
  // 경로 계산 캐시
  const pathItems = useMemo(() => {
    if (!selectedDocPath || selectedDocPath.length === 0) return [];
    return getCategoryPathWithIcon(categories, selectedDocPath);
  }, [categories, selectedDocPath]);

  if (!selectedDocPath || pathItems.length === 0) return null;

  const onCrumbClick = (idx: number) => {
    if (!setSelectedDocPath) return;
    const nextPath = selectedDocPath.slice(0, idx + 1);
    setSelectedDocPath(nextPath);
    setSelectedDocTitle?.(null);
    setDocContent?.(null);
  };

  return (
    <nav className="wiki-breadcrumb" aria-label="Breadcrumb">
      <div className="wiki-breadcrumb-flex">
        {pathItems.map((item, i) => {
          const isLast = i === pathItems.length - 1;
          return (
            <React.Fragment key={item.id}>
              {i > 0 && <span className="wiki-breadcrumb-sep">{'>'}</span>}
              <button
                type="button"
                className="wiki-breadcrumb-item"
                onClick={() => onCrumbClick(i)}
                aria-current={isLast ? 'page' : undefined}
              >
                {item.icon &&
                  (isImageUrl(item.icon) ? (
                    <img
                      src={item.icon}
                      alt=""
                      aria-hidden="true"
                      style={{
                        width: 20,
                        height: 20,
                        marginRight: 5,
                        verticalAlign: 'middle',
                      }}
                    />
                  ) : (
                    <span
                      style={{ marginRight: 4, fontSize: 20 }}
                      aria-hidden="true"
                    >
                      {item.icon}
                    </span>
                  ))}
                {item.name}
              </button>
            </React.Fragment>
          );
        })}
      </div>
    </nav>
  );
};

export default Breadcrumb;
