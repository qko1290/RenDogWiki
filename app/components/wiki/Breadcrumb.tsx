// =============================================
// File: app/components/wiki/Breadcrumb.tsx
// (전체 코드)
// - 현재 문서의 상위 카테고리 브레드크럼 표시
// - 루트 카테고리는 표시하지 않음
// - 각 브레드크럼 클릭 시 해당 카테고리의 대표 문서로 이동
// - 대표 문서가 없으면 클릭 비활성화
// =============================================

import React, { useMemo } from 'react';
import { toProxyUrl } from '@lib/cdn';

type CategoryNode = {
  id: number;
  name: string;
  icon?: string;
  document_id?: number;
  children?: CategoryNode[];
};

type BreadcrumbItem = {
  id: number;
  name: string;
  icon?: string;
  document_id?: number;
  path: number[];
};

type Props = {
  selectedDocPath: number[] | null;
  categories: CategoryNode[];
  onNavigateCategoryDoc?: (path: number[], docId: number) => void;
};

function getCategoryPathItems(tree: CategoryNode[], path: number[]) {
  const items: BreadcrumbItem[] = [];
  let currentTree = tree;
  let currentPath: number[] = [];

  for (const id of path) {
    const match = currentTree.find((n) => n.id === id);
    if (!match) break;

    currentPath = [...currentPath, match.id];

    items.push({
      id: match.id,
      name: match.name,
      icon: match.icon,
      document_id: match.document_id,
      path: [...currentPath],
    });

    currentTree = match.children || [];
  }

  return items;
}

const isImageUrl = (v?: string) => !!v && v.startsWith('http');

const Breadcrumb: React.FC<Props> = ({
  selectedDocPath,
  categories,
  onNavigateCategoryDoc,
}) => {
  const pathItems = useMemo(() => {
    if (!selectedDocPath || selectedDocPath.length === 0) return [];

    // selectedDocPath 전체는 [루트카테고리, ..., 현재카테고리] 구조라고 보고,
    // 루트 카테고리는 브레드크럼에서 제외
    const full = getCategoryPathItems(categories, selectedDocPath);
    if (full.length <= 1) return [];

    return full.slice(1);
    // 현재 요구사항:
    // "루트 카테고리를 제외한 소속/상위 카테고리"
    // => 루트 제외 + 현재 카테고리 제외 + 상위 카테고리들만 표시
    //
    // 만약 "현재 카테고리도 포함"하고 싶으면 full.slice(1) 로 바꾸면 됨.
  }, [categories, selectedDocPath]);

  if (!selectedDocPath || pathItems.length === 0) return null;

  return (
    <nav className="wiki-breadcrumb" aria-label="Breadcrumb">
      <div className="wiki-breadcrumb-flex">
        {pathItems.map((item, i) => {
          const clickable =
            !!onNavigateCategoryDoc &&
            Number.isFinite(Number(item.document_id)) &&
            Number(item.document_id) > 0;

          return (
            <React.Fragment key={item.id}>
              {i > 0 && <span className="wiki-breadcrumb-sep">{'>'}</span>}

              <button
                type="button"
                className={`wiki-breadcrumb-item${clickable ? '' : ' is-disabled'}`}
                onClick={() => {
                  if (!clickable) return;
                  onNavigateCategoryDoc?.(item.path, Number(item.document_id));
                }}
                disabled={!clickable}
                aria-disabled={!clickable}
                title={
                  clickable
                    ? `${item.name} 대표 문서로 이동`
                    : '대표 문서가 없습니다'
                }
              >
                {item.icon &&
                  (isImageUrl(item.icon) ? (
                    <img
                      src={toProxyUrl(item.icon)}
                      alt=""
                      aria-hidden="true"
                      loading="lazy"
                      decoding="async"
                      draggable={false}
                      style={{
                        width: 20,
                        height: 20,
                        marginRight: 5,
                        verticalAlign: 'middle',
                        objectFit: 'contain',
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

      <style jsx>{`
        .wiki-breadcrumb-flex {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 6px;
        }

        .wiki-breadcrumb-sep {
          color: #9ca3af;
          font-size: 13px;
          user-select: none;
        }

        .wiki-breadcrumb-item {
          display: inline-flex;
          align-items: center;
          border: none;
          background: transparent;
          padding: 0;
          color: #4b5563;
          cursor: pointer;
          font-size: 14px;
          line-height: 1.4;
        }

        .wiki-breadcrumb-item:hover {
          color: #2563eb;
        }

        .wiki-breadcrumb-item.is-disabled,
        .wiki-breadcrumb-item:disabled {
          color: #9ca3af;
          cursor: default;
          pointer-events: none;
        }
      `}</style>
    </nav>
  );
};

export default Breadcrumb;