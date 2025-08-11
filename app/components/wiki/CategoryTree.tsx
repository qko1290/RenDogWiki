// =============================================
// File: components/wiki/CategoryTree.tsx
// (전체 코드 - StrictMode 대응/닫힘 애니메이션 가드 포함, 로그 제거)
// =============================================
"use client";

import React, { useRef, useLayoutEffect } from "react";

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
  selectedDocId: number | null;
  selectedDocPath: number[] | null;
  selectedCategoryPath: number[] | null;
  setSelectedDocPath: (path: number[] | null) => void;
  setSelectedDocId: (id: number | null) => void;
  setSelectedDocTitle: (title: string | null) => void;
  setSelectedCategoryPath: (path: number[] | null) => void;
  setDocContent: (content: any) => void;
  fetchDoc: (
    categoryPath: number[],
    docTitle: string,
    docId?: number,
    options?: { clearCategoryPath?: boolean }
  ) => void;
  allDocuments: Document[];
  openPaths: number[][];
  closingMap: Record<string, boolean>;
  closeTreeWithChildren: (node: CategoryNode, path: number[]) => Promise<void>;
  togglePath: (path: number[]) => void;
  handleArrowClick: (node: CategoryNode, path: number[]) => void;
  isPathOpen: (path: number[]) => boolean;
  isClosing: (path: number[]) => boolean;
  finalizeClose: (path: number[]) => void;
};

function pathToStr(path: number[]) {
  return path.join("/");
}

/**
 * CollapsibleList
 * - prevOpen을 기억해서 "실제 전환"시에만 애니메이션 수행
 * - 닫힘 애니메이션은 isClosing=true인 경우에만 수행 (StrictMode 재마운트/가짜 닫힘 방지)
 */
function CollapsibleList({
  isOpen,
  isClosing,
  onCollapseEnd,
  className,
  children,
}: {
  isOpen: boolean;
  isClosing: boolean;
  onCollapseEnd?: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLUListElement>(null);
  const firstRef = useRef(true);
  const prevOpenRef = useRef<boolean | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const D = 280;
    const E = "cubic-bezier(.2,.8,.2,1)";

    // 초기 세팅
    if (firstRef.current) {
      firstRef.current = false;
      if (isOpen) {
        el.style.height = "auto";
        el.style.opacity = "1";
        el.style.overflow = "hidden"; // margin-collapsing 방지
      } else {
        el.style.height = "0px";
        el.style.opacity = "0";
        el.style.overflow = "hidden";
      }
      prevOpenRef.current = isOpen;
      return;
    }

    const prevOpen = prevOpenRef.current;
    prevOpenRef.current = isOpen;

    if (prevOpen === isOpen) return;

    // 열기: 0 → full → 픽셀 고정 → (다음 프레임) auto
    if (isOpen && prevOpen === false) {
      const full = el.scrollHeight;
      el.style.overflow = "hidden";
      el.style.height = "0px";
      el.style.opacity = "0";

      requestAnimationFrame(() => {
        el.style.transition = `height ${D}ms ${E}, opacity 200ms ease`;
        el.style.height = full + "px";
        el.style.opacity = "1";
      });

      const onEnd = (e: TransitionEvent) => {
        if (e.propertyName !== "height") return;
        el.removeEventListener("transitionend", onEnd);

        // 트랜지션 해제하고 현재 픽셀값으로 잠깐 고정
        el.style.transition = "";
        const frozen = el.getBoundingClientRect().height;
        el.style.height = `${Math.ceil(frozen)}px`;
        // overflow는 hidden 유지 (마진 컬랩스 방지)

        const releaseToAuto = () => {
          if (!prevOpenRef.current) return; // 이미 닫히는 중이면 스킵
          requestAnimationFrame(() => {
            el.style.height = "auto"; // overflow는 계속 hidden
          });
        };

        const fonts = (document as any).fonts;
        if (fonts && fonts.status !== "loaded") {
          fonts.ready.then(releaseToAuto);
        } else {
          requestAnimationFrame(() => requestAnimationFrame(releaseToAuto));
        }
      };
      el.addEventListener("transitionend", onEnd);
      return;
    }

    // 닫기: full → 0 (closing일 때만)
    if (!isOpen && prevOpen === true) {
      if (!isClosing) {
        el.style.overflow = "hidden";
        el.style.height = "0px";
        el.style.opacity = "0";
        return;
      }
      const full = el.scrollHeight;
      el.style.overflow = "hidden";
      el.style.height = full + "px";
      el.style.opacity = "1";

      requestAnimationFrame(() => {
        el.style.transition = `height ${D}ms ${E}, opacity 180ms ease`;
        el.style.height = "0px";
        el.style.opacity = "0";
      });

      const onEnd = (e: TransitionEvent) => {
        if (e.propertyName !== "height") return;
        el.style.transition = "";
        el.removeEventListener("transitionend", onEnd);
        onCollapseEnd?.();
      };
      el.addEventListener("transitionend", onEnd);
    }
  }, [isOpen, isClosing, onCollapseEnd]);

  return (
    <ul ref={ref} className={className}>
      {children}
    </ul>
  );
}

const CategoryTree: React.FC<Props> = ({
  categories,
  categoryIdMap,
  categoryIdToPathMap,
  selectedDocPath,
  selectedCategoryPath,
  selectedDocId,
  setSelectedDocPath,
  setSelectedDocId,
  setSelectedDocTitle,
  setSelectedCategoryPath,
  setDocContent,
  fetchDoc,
  allDocuments,
  openPaths,
  closingMap,
  closeTreeWithChildren,
  togglePath,
  handleArrowClick,
  isPathOpen,
  isClosing,
  finalizeClose,
}) => {
  const getDocumentsForCategory = (pathArr: number[]) =>
    allDocuments.filter(
      (doc) =>
        JSON.stringify(doc.fullPath) === JSON.stringify(pathArr) &&
        !doc.is_featured
    );

  const isReallyOpen = (path: number[]) => isPathOpen(path) && !isClosing(path);

  const renderTree = (nodes: CategoryNode[], parentPath: number[] = []) =>
    nodes.map((node) => {
      const currentPath = [...parentPath, node.id];
      const key = pathToStr(currentPath);
      const docs = getDocumentsForCategory(currentPath);

      const open = isReallyOpen(currentPath); // 실열림
      const closing = isClosing(currentPath); // 닫힘 중
      const shouldRender = open || closing;   // 닫힘 중에도 컨텐츠 유지

      const isCategoryActive =
        !!selectedCategoryPath &&
        JSON.stringify(selectedCategoryPath) === JSON.stringify(currentPath);

      return (
        <li key={`cat-${node.id}`}>
          {/* === 카테고리 행 === */}
          <button
            className={`wiki-nav-item ${isCategoryActive ? "active" : ""}`}
            onClick={async () => {
              const isOpenNow = isPathOpen(currentPath);

              if (node.document_id != null) {
                if (isOpenNow) {
                  await closeTreeWithChildren(node, currentPath);
                } else {
                  await togglePath(currentPath);
                }
              } else {
                if (isOpenNow) {
                  await closeTreeWithChildren(node, currentPath);
                } else {
                  handleArrowClick(node, currentPath);
                }
              }
            }}
          >
            <span className="wiki-category-main">
              <span className="wiki-cat-icon-token">
                {node.icon?.startsWith("http") ? (
                  <img
                    src={node.icon}
                    alt="icon"
                    className="wiki-category-icon-img"
                  />
                ) : (
                  <span className="wiki-category-icon-emoji">
                    {node.icon || "📁"}
                  </span>
                )}
              </span>
              <span className="wiki-category-label-text">{node.name}</span>
            </span>

            {(node.children?.length || docs.length) > 0 && (
              <span
                className={`wiki-category-arrow${open ? " open" : ""}`}
                onClick={(e) => {
                  e.stopPropagation();
                  handleArrowClick(node, currentPath);
                }}
                style={{ display: "inline-block", verticalAlign: "middle" }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  style={{ display: "block" }}
                  className="wiki-arrow-svg"
                >
                  <polyline
                    points="5,4 11,8 5,12"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
            )}
          </button>

          {/* === 하위 문서/카테고리 === */}
          <CollapsibleList
            isOpen={open}
            isClosing={closing}
            onCollapseEnd={() => finalizeClose(currentPath)}
            className="wiki-doc-list"
          >
            {shouldRender && (
              <>
                {/* 문서 목록 */}
                {docs.map((doc) => {
                  const isDocActive = selectedDocId === doc.id;
                  return (
                    <li
                      key={`doc-${doc.id}`}
                      className={`wiki-doc-item ${isDocActive ? "active" : ""}`}
                      onClick={() =>
                        fetchDoc(currentPath, doc.title, doc.id, {
                          clearCategoryPath: true,
                        })
                      }
                    >
                      <span style={{ marginRight: "0.3em" }}>
                        {doc.icon?.startsWith("http") ? (
                          <img
                            src={doc.icon}
                            alt="icon"
                            style={{ width: "1em", verticalAlign: "middle" }}
                          />
                        ) : (
                          doc.icon || "📄"
                        )}
                      </span>
                      <span className="doc-title">{doc.title}</span>
                    </li>
                  );
                })}

                {/* 하위 카테고리 재귀 */}
                {node.children && renderTree(node.children, currentPath)}
              </>
            )}
          </CollapsibleList>
        </li>
      );
    });

  return <ul className="wiki-nav-list">{renderTree(categories)}</ul>;
};

export default CategoryTree;
