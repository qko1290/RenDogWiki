// =============================================
// File: components/wiki/CategoryTree.tsx
// (대표 문서 우선 오픈, 이미지 lazy/async/CloudFront 우회, 루트 문서 정렬 유지)
// + 초기 로딩 가드(interactionReady) 및 안전장치 추가
// + CollapsibleList: 서브트리 열림 상태 변화에 따라 height를 auto로 보정
// + ✅ 로고 클릭 시: 시작 문서(루트 대표)로 이동 + 모든 카테고리 접기
// =============================================
"use client";

import React, { useRef, useLayoutEffect, useMemo, useEffect } from "react";
import SmartImage from "../common/SmartImage"; // ✅ 이미지 우회/최적화 공통 컴포넌트 (직접 사용은 안 해도 import 유지)
import { toProxyUrl } from "@lib/cdn";

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

  /** 👇 초기 로딩 끝나 상호작용 가능한지 여부 */
  interactionReady: boolean;
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
  /** 🔑 서브트리 안에서 열린 path 개수 → 바뀔 때마다 부모 높이 보정용 */
  contentVersion = 0,
}: {
  isOpen: boolean;
  isClosing: boolean;
  onCollapseEnd?: () => void;
  className?: string;
  children: React.ReactNode;
  contentVersion?: number;
}) {
  const ref = useRef<HTMLUListElement>(null);
  const firstRef = useRef(true);
  const prevOpenRef = useRef<boolean | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const prefersReduced =
      typeof window !== "undefined" &&
      "matchMedia" in window &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const D = prefersReduced ? 0 : 280;
    const E = "cubic-bezier(.2,.8,.2,1)";

    const first = firstRef.current;
    const prevOpen = prevOpenRef.current;
    prevOpenRef.current = isOpen;

    // === 최초 마운트 ===
    if (first) {
      firstRef.current = false;
      el.style.overflow = "hidden";
      if (isOpen) {
        el.style.height = "auto";
        el.style.opacity = "1";
      } else {
        el.style.height = "0px";
        el.style.opacity = "0";
      }
      return;
    }

    // === 열림 상태 토글: 닫힘 → 열림 ===
    if (prevOpen === false && isOpen === true) {
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
        // 애니메이션 끝나면 height: auto 로 풀어줘서 자식 변경에 따라 자연스럽게 늘어나도록
        el.style.transition = "";
        if (prevOpenRef.current) {
          el.style.height = "auto";
        }
      };

      if (D === 0) {
        el.style.height = "auto";
      } else {
        el.addEventListener("transitionend", onEnd);

        // ⚠️ 일부 환경에서 transitionend 누락될 수 있으니 fail-safe
        window.setTimeout(() => {
          const node = ref.current;
          if (!node) return;
          if (!prevOpenRef.current) return; // 이미 닫혔으면 무시
          node.style.transition = "";
          node.style.height = "auto";
        }, D + 320);
      }
      return;
    }

    // === 열림 상태 토글: 열림 → 닫힘 ===
    if (prevOpen === true && isOpen === false) {
      // isClosing = false 인 경우엔 즉시 접기
      if (!isClosing) {
        el.style.overflow = "hidden";
        el.style.height = "0px";
        el.style.opacity = "0";
        return;
      }

      // isClosing = true → 부드럽게 접기
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
      return;
    }

    // === isOpen / isClosing 값은 그대로인데 contentVersion만 바뀐 경우 ===
    if (isOpen && !isClosing) {
      if (el.style.height !== "auto") {
        el.style.transition = "";
        el.style.overflow = "hidden";
        el.style.height = "auto";
        el.style.opacity = "1";
      }
    }
  }, [isOpen, isClosing, onCollapseEnd, contentVersion]);

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
  interactionReady,
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

  // 📌 특정 path를 prefix로 가지는 openPaths 개수 (서브트리 열림 상태 버전)
  const countOpenInSubtree = (basePath: number[]) => {
    if (openPaths.length === 0) return 0;
    return openPaths.reduce((cnt, p) => {
      if (p.length < basePath.length) return cnt;
      for (let i = 0; i < basePath.length; i++) {
        if (p[i] !== basePath[i]) return cnt;
      }
      return cnt + 1;
    }, 0);
  };

  // ✅ 로고 클릭 시: 시작 문서 열기 + 모든 카테고리(열린 path 전체) 접기
  useEffect(() => {
    const onClick = async (e: MouseEvent) => {
      try {
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

        if (!interactionReady) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }

        const rootRep = allDocuments.find(
          (d) => Array.isArray(d.fullPath) && d.fullPath.length === 0 && d.id === HIDE_ROOT_DOC_ID
        );
        if (!rootRep) return;

        e.preventDefault();
        e.stopPropagation();

        // ✅ 0) “카테고리 경로 선택”이 남아있으면 자동 펼침 로직이 다시 열 수 있어서 먼저 제거
        setSelectedCategoryPath(null);

        // ✅ 1) 현재 열린 모든 openPaths를 “깊은 것부터” 닫기
        // - openPaths는 props라 직접 초기화가 불가 → closeTreeWithChildren를 이용해 상태를 실제로 닫아줌
        const snapshot = [...openPaths];
        snapshot.sort((a, b) => b.length - a.length); // 깊은 것부터

        for (const p of snapshot) {
          // p는 [catId, catId, ...] 형태
          if (!Array.isArray(p) || p.length === 0) continue;
          if (!isPathOpen(p)) continue;

          const lastId = p[p.length - 1];
          const node = categoryIdMap[lastId];
          if (!node) continue;

          try {
            // eslint-disable-next-line no-await-in-loop
            await closeTreeWithChildren(node, p);
          } catch {
            // ignore
          }
        }

        // ✅ 2) 시작 문서(루트 대표)로 이동
        fetchDoc([0], rootRep.title, rootRep.id, { clearCategoryPath: true });
      } catch {
        // no-op
      }
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [
    allDocuments,
    categoryIdMap,
    closeTreeWithChildren,
    fetchDoc,
    interactionReady,
    isPathOpen,
    openPaths,
    setSelectedCategoryPath,
  ]);

  const isReallyOpen = (path: number[]) => isPathOpen(path) && !isClosing(path);

  // 클릭 가드 유틸
  const guardClick = (e: React.MouseEvent | React.KeyboardEvent) => {
    if (!interactionReady) {
      e.preventDefault();
      e.stopPropagation();
      return true;
    }
    return false;
  };

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

      // 🔑 이 카테고리 이하에서 열린 path 개수 (자식/손자 포함)
      const subtreeOpenVersion = countOpenInSubtree(currentPath);

      return (
        <li key={`cat-${node.id}`}>
          {/* === 카테고리 행 === */}
          <button
            className={`wiki-nav-item ${isCategoryActive ? "active" : ""} ${
              interactionReady ? "" : "is-disabled"
            }`}
            onClick={async (e) => {
              if (guardClick(e)) return;

              const currentPath = [...parentPath, node.id];
              const isOpenNow = isPathOpen(currentPath);

              // ✅ 대표 문서 우선 오픈
              if (node.document_id != null) {
                const repId = Number(node.document_id);
                const repFromList = allDocuments.find((d) => d.id === repId);
                const repIsOpen = selectedDocId === repId && equalsPath(selectedDocPath, currentPath);

                if (!repIsOpen) {
                  let title = repFromList?.title;
                  if (!title) {
                    try {
                      const r = await fetch(`/api/documents?id=${repId}&_ts=${Date.now()}`, {
                        cache: "no-store",
                      });
                      if (r.ok) {
                        const data = await r.json();
                        title = data?.title || "";
                      }
                    } catch {
                      // ignore
                    }
                  }

                  if (title) {
                    fetchDoc(currentPath, title, repId, { clearCategoryPath: true });
                    return; // 👈 펼침/접힘 적용하지 않음
                  }
                }
              }

              // ✅ 일반 토글
              try {
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
              } catch {
                // interaction safety
              }
            }}
            onKeyDown={(e) => {
              if ((e.key === "Enter" || e.key === " ") && guardClick(e)) return;
            }}
            aria-expanded={open}
            aria-controls={panelId}
            aria-disabled={!interactionReady}
            disabled={!interactionReady}
            title={!interactionReady ? "로딩 중입니다…" : undefined}
          >
            <span className="wiki-category-main">
              <span className="wiki-cat-icon-token">
                {node.icon?.startsWith("http") ? (
                  <img
                    src={toProxyUrl(node.icon)}
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
                  if (guardClick(e as any)) return;
                  e.stopPropagation();
                  handleArrowClick(node, currentPath);
                }}
                style={{
                  display: "inline-block",
                  verticalAlign: "middle",
                  pointerEvents: interactionReady ? "auto" : "none",
                  opacity: interactionReady ? 1 : 0.5,
                }}
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
            contentVersion={subtreeOpenVersion}
          >
            {shouldRender && (
              <>
                {/* 문서 목록 */}
                {docs.map((doc) => {
                  const isDocActive = selectedDocId === doc.id;
                  return (
                    <li
                      key={`doc-${doc.id}`}
                      className={`wiki-doc-item ${isDocActive ? "active" : ""} ${
                        interactionReady ? "" : "is-disabled"
                      }`}
                      onClick={(e) => {
                        if (guardClick(e as any)) return;
                        fetchDoc(currentPath, doc.title, doc.id, { clearCategoryPath: true });
                      }}
                      aria-disabled={!interactionReady}
                      title={!interactionReady ? "로딩 중입니다…" : undefined}
                      style={{
                        pointerEvents: interactionReady ? "auto" : "none",
                        opacity: interactionReady ? 1 : 0.6,
                      }}
                    >
                      <span style={{ marginRight: "0.3em" }}>
                        {doc.icon?.startsWith("http") ? (
                          <img
                            src={toProxyUrl(doc.icon)}
                            alt=""
                            aria-hidden="true"
                            loading="lazy"
                            decoding="async"
                            fetchPriority="low"
                            width={20}
                            height={20}
                            style={{ width: 20, height: 20, objectFit: "contain" }}
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
              className={`wiki-nav-item ${isDocActive ? "active" : ""} ${
                interactionReady ? "" : "is-disabled"
              }`}
              onClick={(e) => {
                if (guardClick(e)) return;
                fetchDoc([0], doc.title, doc.id, { clearCategoryPath: true });
              }}
              aria-disabled={!interactionReady}
              disabled={!interactionReady}
              title={!interactionReady ? "로딩 중입니다…" : undefined}
            >
              <span className="wiki-category-main">
                <span className="wiki-cat-icon-token">
                  {doc.icon?.startsWith("http") ? (
                    <img
                      src={toProxyUrl(doc.icon)}
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