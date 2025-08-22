// =============================================
// File: components/wiki/CategoryTree.tsx
// (대표 문서 우선 오픈, 이미지 lazy/async, 루트 문서 정렬 유지)
// =============================================
"use client";

import React, { useRef, useLayoutEffect, useMemo, useEffect } from "react";

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
  order?: number;
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

function equalsPath(a?: number[] | null, b?: number[] | null) {
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

// 문서 정렬: order ASC → title ASC
function sortDocs(a: Document, b: Document) {
  const ao = Number.isFinite(Number(a.order)) ? Number(a.order) : Number.POSITIVE_INFINITY;
  const bo = Number.isFinite(Number(b.order)) ? Number(b.order) : Number.POSITIVE_INFINITY;
  if (ao !== bo) return ao - bo;
  return String(a.title || "").localeCompare(String(b.title || ""), "ko");
}

/** Collapsible wrapper */
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

    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const D = prefersReduced ? 0 : 280;
    const E = "cubic-bezier(.2,.8,.2,1)";

    // 초기 세팅
    if (firstRef.current) {
      firstRef.current = false;
      if (isOpen) {
        el.style.height = "auto";
        el.style.opacity = "1";
        el.style.overflow = "hidden";
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

    // 열기
    if (isOpen && prevOpen === false) {
      const full = el.scrollHeight;
      el.style.overflow = "hidden";
      el.style.height = "0px";
      el.style.opacity = "0";

      requestAnimationFrame(() => {
        el.style.transition = D === 0 ? "" : `height ${D}ms ${E}, opacity 200ms ease`;
        el.style.height = full + "px";
        el.style.opacity = "1";
      });

      const onEnd = (e: TransitionEvent) => {
        if (e.propertyName !== "height") return;
        el.removeEventListener("transitionend", onEnd);

        el.style.transition = "";
        const frozen = el.getBoundingClientRect().height;
        el.style.height = `${Math.ceil(frozen)}px`;

        const releaseToAuto = () => {
          if (!prevOpenRef.current) return;
          requestAnimationFrame(() => {
            el.style.height = "auto";
          });
        };

        const fonts = (document as any).fonts;
        if (fonts && fonts.status !== "loaded") {
          fonts.ready.then(releaseToAuto);
        } else {
          requestAnimationFrame(() => requestAnimationFrame(releaseToAuto));
        }
      };

      if (D === 0) {
        el.style.height = "auto";
      } else {
        el.addEventListener("transitionend", onEnd);
      }
      return;
    }

    // 닫기
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
        el.style.transition = D === 0 ? "" : `height ${D}ms ${E}, opacity 180ms ease`;
        el.style.height = "0px";
        el.style.opacity = "0";
      });

      const onEnd = (e: TransitionEvent) => {
        if (e.propertyName !== "height") return;
        el.style.transition = "";
        el.removeEventListener("transitionend", onEnd);
        onCollapseEnd?.();
      };

      if (D === 0) {
        onCollapseEnd?.();
      } else {
        el.addEventListener("transitionend", onEnd);
      }
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
  // 숨길 루트 대표 문서 ID
  const HIDE_ROOT_DOC_ID = 73;

  // 카테고리별 문서 캐시 (루트 제외) + 정렬
  const docsByPath = useMemo(() => {
    const map = new Map<string, Document[]>();
    for (const doc of allDocuments) {
      if (doc.is_featured) continue;
      const fp = Array.isArray(doc.fullPath) ? doc.fullPath : [];
      if (fp.length === 0) continue;
      const key = pathToStr(fp);
      const arr = map.get(key);
      if (arr) arr.push(doc);
      else map.set(key, [doc]);
    }
    for (const [, arr] of map) arr.sort(sortDocs);
    return map;
  }, [allDocuments]);

  // 루트([]) 문서들 — 대표(73) 제외 + 정렬
  const rootDocs = useMemo(
    () =>
      allDocuments
        .filter(
          (d) =>
            !d.is_featured &&
            Array.isArray(d.fullPath) &&
            d.fullPath.length === 0 &&
            d.id !== HIDE_ROOT_DOC_ID
        )
        .sort(sortDocs),
    [allDocuments]
  );

  // 로고(홈 링크) 클릭 시, 숨긴 루트 대표 문서(id===73) 열기
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const a = target?.closest("a") as HTMLAnchorElement | null;
      if (!a) return;

      const href = a.getAttribute("href") || "";
      const looksLikeLogo =
        href === "/" ||
        href === "/wiki" ||
        a.id === "wiki-logo" ||
        a.classList.contains("wiki-logo");

      if (!looksLikeLogo) return;

      const rootRep = allDocuments.find(
        (d) => Array.isArray(d.fullPath) && d.fullPath.length === 0 && d.id === HIDE_ROOT_DOC_ID
      );
      if (!rootRep) return;

      e.preventDefault();
      e.stopPropagation();

      fetchDoc([0], rootRep.title, rootRep.id, { clearCategoryPath: true });
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [allDocuments, fetchDoc]);

  const isReallyOpen = (path: number[]) => isPathOpen(path) && !isClosing(path);

  const renderTree = (nodes: CategoryNode[], parentPath: number[] = []) =>
    nodes.map((node) => {
      const currentPath = [...parentPath, node.id];
      const key = pathToStr(currentPath);
      const docs = docsByPath.get(key) ?? [];

      const open = isReallyOpen(currentPath);
      const closing = isClosing(currentPath);
      const shouldRender = open || closing;

      const isCategoryActive = equalsPath(selectedCategoryPath, currentPath);
      const panelId = `wiki-doc-list-${key}`;

      return (
        <li key={`cat-${node.id}`}>
          {/* === 카테고리 행 === */}
          <button
            className={`wiki-nav-item ${isCategoryActive ? "active" : ""}`}
            onClick={async () => {
              const currentPath = [...parentPath, node.id];
              const isOpenNow = isPathOpen(currentPath);

              // ✅ 대표 문서 우선 오픈
              if (node.document_id != null) {
                const repId = Number(node.document_id);
                const repFromList = allDocuments.find(d => d.id === repId);
                const repIsOpen =
                  selectedDocId === repId && equalsPath(selectedDocPath, currentPath);

                if (!repIsOpen) {
                  let title = repFromList?.title;
                  if (!title) {
                    try {
                      const r = await fetch(`/api/documents?id=${repId}`, { cache: "no-store" });
                      if (r.ok) {
                        const data = await r.json();
                        title = data?.title || "";
                      }
                    } catch {}
                  }

                  if (title) {
                    fetchDoc(currentPath, title, repId, { clearCategoryPath: true });
                    return; // 👈 펼침/접힘 적용하지 않음
                  }
                }
              }

              // ✅ 일반 토글
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
            aria-expanded={open}
            aria-controls={panelId}
          >
            <span className="wiki-category-main">
              <span className="wiki-cat-icon-token">
                {node.icon?.startsWith("http") ? (
                  <img
                    src={node.icon}
                    alt=""
                    aria-hidden="true"
                    className="wiki-category-icon-img"
                    loading="lazy"
                    decoding="async"
                    fetchPriority="low"
                  />
                ) : (
                  <span className="wiki-category-icon-emoji" aria-hidden="true">
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
                aria-hidden="true"
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
                            alt=""
                            aria-hidden="true"
                            loading="lazy"
                            decoding="async"
                            fetchPriority="low"
                            style={{ width: "1em", verticalAlign: "middle" }}
                          />
                        ) : (
                          <span aria-hidden="true">{doc.icon || "📄"}</span>
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

  return (
    <ul className="wiki-nav-list">
      {renderTree(categories)}
      {/* ✅ 루트 문서: 대표(73)만 제외 + 정렬 */}
      {rootDocs.map((doc) => {
        const isDocActive = selectedDocId === doc.id;
        return (
          <li key={`rootdoc-${doc.id}`}>
            <button
              className={`wiki-nav-item ${isDocActive ? "active" : ""}`}
              onClick={() => {
                fetchDoc([0], doc.title, doc.id, { clearCategoryPath: true });
              }}
            >
              <span className="wiki-category-main">
                <span className="wiki-cat-icon-token">
                  {doc.icon?.startsWith("http") ? (
                    <img
                      src={doc.icon}
                      alt=""
                      aria-hidden="true"
                      className="wiki-category-icon-img"
                      loading="lazy"
                      decoding="async"
                      fetchPriority="low"
                    />
                  ) : (
                    <span className="wiki-category-icon-emoji" aria-hidden="true">
                      {doc.icon || "📄"}
                    </span>
                  )}
                </span>
                <span className="wiki-category-label-text">{doc.title}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
};

export default CategoryTree;
