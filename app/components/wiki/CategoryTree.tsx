// =============================================
// File: components/wiki/CategoryTree.tsx
// =============================================
"use client";

import React, { useRef, useLayoutEffect, useMemo, useEffect } from "react";
import SmartImage from "../common/SmartImage"; // ✅ import 유지
import { toProxyUrl } from "@lib/cdn";

type CategoryNode = {
  id: number;
  name: string;
  icon?: string;
  order?: number;
  document_id?: number;
  children?: CategoryNode[];

  // ✅ 추가: 모드 태그(서버에서 내려온다고 가정)
  mode_tags?: string[];
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
    options?: {
      clearCategoryPath?: boolean;
      history?: 'push' | 'replace';
      skipUrlSync?: boolean;
      forceRoot?: boolean;
    }
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

  interactionReady: boolean;

  // ✅ 추가: 현재 선택된 모드
  mode: string;
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
        el.style.transition = "";
        if (prevOpenRef.current) {
          el.style.height = "auto";
        }
      };

      if (D === 0) {
        el.style.height = "auto";
      } else {
        el.addEventListener("transitionend", onEnd);
        window.setTimeout(() => {
          const node = ref.current;
          if (!node) return;
          if (!prevOpenRef.current) return;
          node.style.transition = "";
          node.style.height = "auto";
        }, D + 320);
      }
      return;
    }

    if (prevOpen === true && isOpen === false) {
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
      return;
    }

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
  mode,
}) => {
  const HIDE_ROOT_DOC_ID = 73;

  // ✅ 사이드바(카테고리) 스크롤 컨테이너 ref
  const navScrollRef = useRef<HTMLDivElement>(null);

  // ✅ 자동 스크롤이 너무 자주/연속으로 튀는 것 방지용
  const lastAutoScrollKeyRef = useRef<string>("");

  // ✅ 현재 모드 정규화 (서버가 소문자 저장하면 여기서 맞춰도 됨)
  // - 네가 “RPG”로 쓰기로 했으니 기본은 그대로 두고,
  //   혹시 서버에 rpg로 저장된 데이터가 섞여도 매칭되게 lower 비교만 사용
  const modeLower = String(mode || "").trim().toLowerCase();

  // ✅ 대표 문서로 "선택된 상태"인데 selectedCategoryPath가 비어있을 때,
  //    selectedDocId가 어떤 카테고리의 대표(document_id)인지 역추적해서 active 카테고리로 삼는다.
  const derivedActiveCategoryPath = useMemo(() => {
    // 1) 이미 명시적으로 선택된 카테고리 경로가 있으면 그게 최우선
    if (selectedCategoryPath && selectedCategoryPath.length > 0) return selectedCategoryPath;

    // 2) 문서 선택이 없으면 파생 불가
    if (!selectedDocId) return null;

    // 3) selectedDocId === 어떤 카테고리의 대표 문서(document_id) 인지 찾기
    //    (categoryIdMap은 전체 노드를 가지고 있다고 가정)
    const nodes = Object.values(categoryIdMap || {});
    const repCat = nodes.find((n) => Number(n.document_id) === Number(selectedDocId));
    if (!repCat) return null;

    // 4) 그 카테고리의 "정확한 경로"를 맵에서 가져오기
    const p = categoryIdToPathMap?.[repCat.id];
    return Array.isArray(p) && p.length > 0 ? p : null;
  }, [selectedCategoryPath, selectedDocId, categoryIdMap, categoryIdToPathMap]);

  useEffect(() => {
    if (!interactionReady) return;
    const host = navScrollRef.current;
    if (!host) return;

    // ✅ 우선순위: 선택 문서 -> 선택(파생) 카테고리
    const docId = selectedDocId ? String(selectedDocId) : "";
    const catKey = derivedActiveCategoryPath ? pathToStr(derivedActiveCategoryPath) : "";

    const autoKey = docId ? `doc:${docId}` : catKey ? `cat:${catKey}` : "";
    if (!autoKey) return;

    // 같은 대상이면 중복 스크롤 방지
    if (lastAutoScrollKeyRef.current === autoKey) return;
    lastAutoScrollKeyRef.current = autoKey;

    const run = () => {
      // 1) 문서가 있으면 문서로
      let target: HTMLElement | null = null;

      if (docId) {
        target = host.querySelector(`[data-kind="doc"][data-docid="${docId}"]`) as HTMLElement | null;
      }

      // 2) 문서가 없거나 못 찾으면 카테고리로
      if (!target && catKey) {
        target = host.querySelector(`[data-kind="cat"][data-path="${CSS.escape(catKey)}"]`) as HTMLElement | null;
      }

      if (!target) return;

      // ✅ "가까우면 안 움직임" + "부드럽게"
      try {
        target.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
      } catch {
        // 구형 브라우저 fallback
        const top = target.offsetTop;
        host.scrollTop = Math.max(0, top - 80);
      }
    };

    // DOM이 열리고(트리 열림/닫힘 애니메이션 포함) 난 다음 위치 잡도록 2프레임 딜레이
    requestAnimationFrame(() => requestAnimationFrame(run));
  }, [interactionReady, selectedDocId, derivedActiveCategoryPath]);

  // ✅ 모드 필터: "상속 포함"
  // - parentIncluded=true면 하위는 태그 없어도 포함
  // - parentIncluded=false면 본인 mode_tags에 mode가 있으면 포함
  // - 자식 중 포함되는 게 있으면 부모도 포함(부모만 보고 숨겨지면 네비가 끊김)
  const filterTreeByMode = (nodes: CategoryNode[], parentIncluded: boolean): CategoryNode[] => {
    const out: CategoryNode[] = [];
    for (const n of nodes) {
      const ownTags = Array.isArray(n.mode_tags) ? n.mode_tags : [];
      const ownIncluded =
        parentIncluded ||
        ownTags.some((t) => String(t).trim().toLowerCase() === modeLower);

      const nextChildren = n.children?.length
        ? filterTreeByMode(n.children, ownIncluded)
        : [];

      // ✅ 포함 조건:
      // - 본인 포함(ownIncluded) OR
      // - 자식 중 하나라도 포함(= nextChildren.length>0)
      if (ownIncluded || nextChildren.length > 0) {
        out.push({ ...n, children: nextChildren });
      }
    }
    return out;
  };

  // ✅ 필터된 루트 카테고리
  const filteredCategories = useMemo(() => {
    if (!modeLower) return categories; // (안전) mode가 비었으면 전체
    return filterTreeByMode(categories, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories, modeLower]);

  // ✅ 루트 카테고리 하나를 열 때, 다른 루트 카테고리는 전부 닫기
  const closeOtherRootCategories = async (keepRootId: number) => {
    for (const root of filteredCategories) {
      if (root.id === keepRootId) continue;
      const p = [root.id];
      if (!isPathOpen(p)) continue;
      try {
        // eslint-disable-next-line no-await-in-loop
        await closeTreeWithChildren(root, p);
      } catch {}
    }
  };

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

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
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

        fetchDoc([0], rootRep.title, rootRep.id, {
          clearCategoryPath: true,
          history: 'push',
        });
      } catch {}
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [allDocuments, fetchDoc, interactionReady]);

  const isReallyOpen = (path: number[]) => isPathOpen(path) && !isClosing(path);

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

      const isCategoryActive = equalsPath(derivedActiveCategoryPath, currentPath);
      const panelId = `wiki-doc-list-${key}`;
      const subtreeOpenVersion = countOpenInSubtree(currentPath);

      return (
        <li key={`cat-${node.id}`}>
          <button
            data-kind="cat"
            data-path={key}
            className={`wiki-nav-item ${isCategoryActive ? "active" : ""} ${
              interactionReady ? "" : "is-disabled"
            }`}
            onClick={async (e) => {
              if (guardClick(e)) return;

              const currentPath = [...parentPath, node.id];
              const isOpenNow = isPathOpen(currentPath);

              // 루트 하나 열 때 나머지 루트 닫기 (열릴 때만)
              if (parentPath.length === 0 && !isOpenNow) {
                await closeOtherRootCategories(node.id);
              }

              // ✅ 대표 문서가 있는 카테고리
              if (node.document_id != null) {
                const repId = Number(node.document_id);
                const repFromList = allDocuments.find((d) => d.id === repId);

                // "대표 문서가 현재 열려있는지" 판단
                const repIsOpen =
                  selectedDocId === repId && equalsPath(selectedDocPath, currentPath);

                // 1) 대표 문서가 아직 안 열려있으면: 문서만 열고(카테고리 강조 유지), 트리는 펼치지 않음
                if (!repIsOpen) {
                  let title = repFromList?.title;

                  // 목록에 없으면 서버에서 제목 보정
                  if (!title) {
                    try {
                      const r = await fetch(`/api/documents?id=${repId}&_ts=${Date.now()}`, {
                        cache: "no-store",
                      });
                      if (r.ok) {
                        const data = await r.json();
                        title = data?.title || "";
                      }
                    } catch {}
                  }

                  if (title) {
                    // ✅ 카테고리 강조를 위해: clearCategoryPath 쓰면 안 됨
                    setSelectedCategoryPath(currentPath);
                    fetchDoc(currentPath, title, repId, {
                      clearCategoryPath: false,
                      history: 'push',
                    });
                  }
                  return;
                }

                // 2) 대표 문서가 이미 열려있으면: 이제부터는 트리 펼침/접힘 토글
                try {
                  if (isOpenNow) await closeTreeWithChildren(node, currentPath);
                  else await togglePath(currentPath);
                } catch {}
                return;
              }

              // ✅ 대표 문서가 없는 카테고리: 펼침/접힘만
              try {
                if (isOpenNow) await closeTreeWithChildren(node, currentPath);
                else handleArrowClick(node, currentPath);
              } catch {}
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
                onClick={async (e) => {
                  if (guardClick(e as any)) return;
                  e.stopPropagation();

                  const isOpenNow = isPathOpen(currentPath);
                  if (parentPath.length === 0 && !isOpenNow) {
                    await closeOtherRootCategories(node.id);
                  }

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
                <svg width="16" height="16" viewBox="0 0 16 16" style={{ display: "block" }} className="wiki-arrow-svg">
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

          <CollapsibleList
            isOpen={open}
            isClosing={closing}
            onCollapseEnd={() => finalizeClose(currentPath)}
            className="wiki-doc-list"
            contentVersion={subtreeOpenVersion}
          >
            {shouldRender && (
              <>
                {docs.map((doc) => {
                  const isDocActive = selectedDocId === doc.id;
                  return (
                    <li
                      key={`doc-${doc.id}`}
                      className={`wiki-doc-item ${isDocActive ? "active" : ""} ${
                        interactionReady ? "" : "is-disabled"
                      }`}
                      data-kind="doc"
                      data-docid={doc.id}
                      onClick={(e) => {
                        if (guardClick(e as any)) return;
                        fetchDoc(currentPath, doc.title, doc.id, {
                          clearCategoryPath: true,
                          history: 'push',
                        });
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

                {node.children && renderTree(node.children, currentPath)}
              </>
            )}
          </CollapsibleList>
        </li>
      );
    });

  return (
    <div ref={navScrollRef} className="wiki-nav-scroll">
      <ul className="wiki-nav-list">
        {/* ✅ 여기서 filteredCategories 사용 */}
        {renderTree(filteredCategories)}

        {/* 루트 문서(대표 73 제외) */}
        {rootDocs.map((doc) => {
          const isDocActive = selectedDocId === doc.id;
          return (
            <li key={`rootdoc-${doc.id}`}>
              <button
                data-kind="doc"
                data-docid={doc.id}
                className={`wiki-nav-item ${isDocActive ? "active" : ""} ${
                  interactionReady ? "" : "is-disabled"
                }`}
                onClick={(e) => {
                  if (guardClick(e)) return;
                  fetchDoc([0], doc.title, doc.id, {
                    clearCategoryPath: true,
                    history: 'push',
                  });
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
    </div>
  );
};

export default CategoryTree;