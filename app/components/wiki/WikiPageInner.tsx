// File: C:\next\rdwiki\app\components\wiki\WikiPageInner.tsx
'use client';

/**
 * 위키 페이지 내부 레이아웃/상태 컨테이너
 * - 카테고리 트리, 문서 본문, TOC, NPC/머리찾기 페인과 모달 관리
 * - URL 쿼리(/wiki?path=&title=) 진입 처리 및 내부 위키 링크 라우팅
 * - 외부 API 계약/타입/라우트는 변경하지 않음
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import WikiHeader from '@/components/common/Header';
import WikiReadRenderer from '@/wiki/lib/WikiReadRenderer';
import { extractHeadings } from '@/wiki/lib/extractHeadings';

import CategoryTree from './CategoryTree';
import Breadcrumb from './Breadcrumb';
import NpcGrid from './NpcGrid';
import HeadGrid from './HeadGrid';
import TableOfContents from './TableOfContents';
import NpcDetailModal from './NpcDetailModal';
import HeadDetailModal from './HeadDetailModal';

import { Descendant } from 'slate';
import { useRouter, useSearchParams } from 'next/navigation';

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

// NPC/Head 리스트 타입(서버 응답 형태에 맞춰 최소 계약만 정의)
type NpcRow = {
  id: number;
  name: string;
  icon: string;
  location_x: number;
  location_y: number;
  location_z: number;
  pictures?: string[];
};
type HeadRow = {
  id: number;
  order: number;
  location_x: number;
  location_y: number;
  location_z: number;
  pictures?: string[];
};

type Props = {
  user: {
    id: number;
    username: string;
    minecraft_name: string;
    email: string;
  } | null;
};

function pathToStr(path: number[]) {
  return path.join('/');
}

export default function WikiPageInner({ user }: Props) {
  // --------- 주요 상태 ---------
  const [categories, setCategories] = useState<CategoryNode[]>([]);
  const [categoryIdToPathMap, setCategoryIdToPathMap] = useState<Record<number, number[]>>({});
  const [categoryIdMap, setCategoryIdMap] = useState<Record<number, CategoryNode>>({});
  const [allDocuments, setAllDocuments] = useState<Document[]>([]);

  const [selectedDocId, setSelectedDocId] = useState<number | null>(null);
  const [selectedDocTitle, setSelectedDocTitle] = useState<string | null>(null);
  const [selectedDocPath, setSelectedDocPath] = useState<number[] | null>(null);
  const [selectedCategoryPath, setSelectedCategoryPath] = useState<number[] | null>(null);

  const [docContent, setDocContent] = useState<Descendant[] | null>(null);
  const [tableOfContents, setTableOfContents] = useState<
    { id: string; text: string; icon?: string; level: 1 | 2 | 3 }[]
  >([]);

  // 트리 애니메이션 상태
  const [openPaths, setOpenPaths] = useState<number[][]>([]);
  const [closingMap, setClosingMap] = useState<Record<string, boolean>>({});

  // NPC/머리찾기 관련 상태
  const [npcList, setNpcList] = useState<NpcRow[]>([]);
  const [npcLoading, setNpcLoading] = useState(false);
  const [selectedNpc, setSelectedNpc] = useState<NpcRow | null>(null);
  const [npcPage, setNpcPage] = useState(0);

  const [headList, setHeadList] = useState<HeadRow[]>([]);
  const [headLoading, setHeadLoading] = useState(false);
  const [selectedHead, setSelectedHead] = useState<HeadRow | null>(null);
  const [headPage, setHeadPage] = useState(0);

  const router = useRouter();
  const searchParams = useSearchParams();
  const contentRef = useRef<HTMLDivElement>(null);

  // 현재 선택된 카테고리 최상단 이름
  const rootCatName = categoryIdMap[selectedDocPath?.[selectedDocPath.length - 1] || -1]?.name;

  // 개발 로그(배포 시 비용 0)
  const DEV_LOG = false;
  const P = (...args: any[]) => {
    if (DEV_LOG && typeof window !== 'undefined') console.log('[WikiPage]', ...args);
  };

  // 언마운트 가드
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // 문서 본문 fetch 최신성 보장용 시퀀스
  const docReqIdRef = useRef(0);

  // 초기: 카테고리 트리 및 전체 문서 목록 로드(1회)
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        // 1) 카테고리
        const resCat = await fetch('/api/categories');
        const catData = await resCat.json();
        const mod = await import('@/wiki/lib/buildCategoryTree');
        const tree = mod.buildCategoryTree(catData) as CategoryNode[];
        if (cancelled || !mountedRef.current) return;
        setCategories(tree);

        // 2) 카테고리 매핑
        const idToPathMap: Record<number, number[]> = {};
        const categoryMap: Record<number, CategoryNode> = {};
        const buildMap = (nodes: CategoryNode[], path: number[] = []) => {
          for (const node of nodes) {
            const currentPath = [...path, node.id];
            idToPathMap[node.id] = currentPath;
            categoryMap[node.id] = node;
            if (node.children) buildMap(node.children, currentPath);
          }
        };
        buildMap(tree);
        if (cancelled || !mountedRef.current) return;
        setCategoryIdToPathMap(idToPathMap);
        setCategoryIdMap(categoryMap);

        // 3) 전체 문서
        const resDoc = await fetch('/api/documents?all=1');
        const docsRaw = await resDoc.json();
        const docs = Array.isArray(docsRaw)
          ? docsRaw
          : Array.isArray(docsRaw.documents)
          ? docsRaw.documents
          : [];
        const mapped = (docs as (Document & { path: number })[]).map(doc => ({
          ...doc,
          fullPath: idToPathMap[doc.path] || [doc.path],
        }));
        if (cancelled || !mountedRef.current) return;
        setAllDocuments(mapped);
      } catch {
        // 조용히 실패
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // 쿼리 진입시 문서 자동 fetch
  useEffect(() => {
    const pathParam = searchParams.get('path');
    const titleParam = searchParams.get('title');
    if (pathParam && titleParam) {
      const pathId = Number(pathParam);
      const fullPath = categoryIdToPathMap[pathId];
      if (fullPath) {
        fetchDoc(fullPath, titleParam, undefined, { clearCategoryPath: true });
      }
    }
    // categoryIdToPathMap 준비 이후 한 번 반영
  }, [searchParams, categoryIdToPathMap]);

  // [핵심] 트리 닫힘(arrow) — Promise<void> 반환으로 타입 맞춤
  const closeTreeWithChildren = async (node: CategoryNode, path: number[]): Promise<void> => {
    const key = pathToStr(path);
    P('closeTreeWithChildren:markClosing', key);
    setClosingMap(prev => ({ ...prev, [key]: true }));

    if (node.children && node.children.length > 0) {
      node.children.forEach(child => {
        const childPath = [...path, child.id];
        if (isPathOpen(childPath)) {
          P('closeTreeWithChildren:child→', pathToStr(childPath));
          // 동기 호출이지만 상위는 await 할 수 있으므로 그대로 호출
          void closeTreeWithChildren(child, childPath);
        } else {
          P('closeTreeWithChildren:child(skip not open)', pathToStr(childPath));
        }
      });
    }
  };

  // [핵심] 열림은 openPaths에만 추가!
  const handleArrowClick = (node: CategoryNode, path: number[]) => {
    const key = pathToStr(path);
    const isOpenNow = isPathOpen(path);

    if (isOpenNow) {
      P('handleArrowClick:CLOSE', key);
      void closeTreeWithChildren(node, path);
    } else {
      P('handleArrowClick:OPEN', key, '→ delete closing & add openPaths');
      setClosingMap(prev => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      setOpenPaths(prev => {
        const already = prev.some(p => pathToStr(p) === key);
        return already ? prev : [...prev, path];
      });
    }
  };

  // 대표문서(카테고리) 클릭시 무조건 열림
  const togglePath = async (path: number[]) => {
    const key = pathToStr(path);
    P('togglePath:OPEN', key);

    const catId = path.at(-1)!;
    const category = categoryIdMap[catId];
    const isSamePath = selectedDocPath && JSON.stringify(selectedDocPath) === JSON.stringify(path);
    const isSameDoc = selectedDocId === category?.document_id;
    const docId = Number(category?.document_id);

    if (category?.document_id && Number.isInteger(docId) && (!isSamePath || !isSameDoc)) {
      try {
        const res = await fetch(`/api/documents?id=${docId}`);
        if (!res.ok) throw new Error('대표 문서를 찾을 수 없습니다');
        const doc = await res.json();

        if (!doc || !doc.title) {
          setSelectedDocId(null);
          setSelectedDocPath(null);
          setSelectedDocTitle(null);
          setDocContent([]);
          setSelectedCategoryPath(path);
          return;
        }
        setSelectedDocId(doc.id);
        setSelectedDocPath([...path]);
        setSelectedDocTitle(doc.title);
        setSelectedCategoryPath(path);

        fetchDoc(path, doc.title, doc.id);

        setOpenPaths(prev => {
          const alreadyOpen = prev.some(p => JSON.stringify(p) === JSON.stringify(path));
          return alreadyOpen ? prev : [...prev, path];
        });
      } catch {
        setSelectedDocId(null);
        setSelectedDocPath(null);
        setSelectedDocTitle(null);
        setDocContent([]);
        setSelectedCategoryPath(path);
      }
    }
  };

  // isPathOpen/isClosing util
  const isPathOpen = (path: number[]) =>
    openPaths.some(p => pathToStr(p) === pathToStr(path));
  const isClosing = (path: number[]) => closingMap[pathToStr(path)] || false;

  const finalizeClose = (path: number[]) => {
    const key = pathToStr(path);
    P('finalizeClose', key, {
      before: {
        open: openPaths.map(p => pathToStr(p)),
        closing: { ...closingMap },
      },
    });
    setOpenPaths(prev => prev.filter(p => pathToStr(p) !== key));
    setClosingMap(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    P('finalizeClose:done', key);
  };

  // --------- 문서 fetch + 분기 ---------
  function fetchDoc(
    categoryPath: number[],
    docTitle: string,
    docId?: number,
    options?: { clearCategoryPath?: boolean }
  ) {
    if (options?.clearCategoryPath) setSelectedCategoryPath(null);
    setSelectedDocTitle(docTitle);

    if (docId) {
      setSelectedDocId(docId);
      setSelectedDocPath([...categoryPath]);
    } else {
      const doc = allDocuments.find(
        d => d.title === docTitle && JSON.stringify(d.fullPath) === JSON.stringify(categoryPath)
      );
      if (doc) {
        setSelectedDocId(doc.id);
        setSelectedDocPath([...categoryPath]);
      }
    }

    // 최신 요청만 반영
    const reqId = ++docReqIdRef.current;

    fetch(`/api/documents?path=${String(categoryPath.at(-1))}&title=${encodeURIComponent(docTitle)}`)
      .then(res => {
        if (!res.ok) throw new Error('문서를 찾을 수 없습니다.');
        return res.json();
      })
      .then(data => {
        if (!mountedRef.current || reqId !== docReqIdRef.current) return;

        const content: Descendant[] =
          typeof data.content === 'string'
            ? JSON.parse(data.content)
            : data.content;

        setDocContent(content);
        setTableOfContents(extractHeadings(content));

        if (data.fullPath && Array.isArray(data.fullPath)) {
          setSelectedDocPath([...data.fullPath]);
        }
      })
      .catch(() => {
        if (!mountedRef.current || reqId !== docReqIdRef.current) return;
        setDocContent(null);
      });
  }

  // --------- 본문 내부 링크 라우팅 ---------
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;

    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const aTag = target?.closest('a');
      if (!aTag) return;
      const href = aTag.getAttribute('href');
      if (href && href.startsWith('/wiki?')) {
        e.preventDefault();
        const url = new URL(href, window.location.origin);
        const path = url.searchParams.get('path');
        const title = url.searchParams.get('title');
        if (path && title) {
          // 강제 재평가를 위해 _t 추가(기존 동작 유지)
          router.push(
            `/wiki?path=${encodeURIComponent(path)}&title=${encodeURIComponent(title)}&_t=${Date.now()}`
          );
        }
      }
    };

    el.addEventListener('click', handler);
    return () => el.removeEventListener('click', handler);
  }, [docContent, router]);

  // --------- NPC/Head 동적 fetch 및 상태 ---------
  useEffect(() => {
    // 선택 상태가 유효하지 않으면 모두 초기화
    if (
      !selectedDocId ||
      !selectedDocTitle ||
      !categoryIdMap ||
      !selectedDocPath ||
      !categoryIdMap[selectedDocPath[selectedDocPath.length - 1]]
    ) {
      setNpcList([]); setNpcLoading(false); setNpcPage(0);
      setHeadList([]); setHeadLoading(false); setHeadPage(0);
      return;
    }

    let cancelled = false;

    const currentCategory = categoryIdMap[selectedDocPath[selectedDocPath.length - 1]];
    const catName = currentCategory?.name;

    // 머리찾기
    if (catName === '머리찾기') {
      setHeadLoading(true); setHeadList([]); setHeadPage(0);
      fetch(`/api/villages?name=${encodeURIComponent(selectedDocTitle)}`)
        .then(res => res.json())
        .then(village => {
          if (cancelled) return null;
          if (!village || !village.id) {
            setHeadList([]); setHeadLoading(false); return null;
          }
          return fetch(`/api/head?village_id=${village.id}`);
        })
        .then(res => (res && (res as Response).json ? (res as Response).json() : []))
        .then(heads => {
          if (cancelled) return;
          setHeadList(Array.isArray(heads) ? (heads as HeadRow[]) : []);
          setHeadLoading(false);
        })
        .catch(() => {
          if (cancelled) return;
          setHeadList([]); setHeadLoading(false);
        });

      return () => { cancelled = true; };
    }

    // NPC/퀘스트
    if (catName !== '퀘스트' && catName !== 'NPC') {
      setNpcList([]); setNpcLoading(false); setNpcPage(0);
      setHeadList([]); setHeadLoading(false); setHeadPage(0);
      return;
    }

    setNpcLoading(true); setNpcList([]); setNpcPage(0);
    fetch(`/api/villages?name=${encodeURIComponent(selectedDocTitle)}`)
      .then(res => res.json())
      .then(village => {
        if (cancelled) return null;
        if (!village || !village.id) {
          setNpcList([]); setNpcLoading(false); return null;
        }
        const npcType = catName === '퀘스트' ? 'quest' : 'normal';
        return fetch(`/api/npcs?village_id=${village.id}&npc_type=${npcType}`);
      })
      .then(res => (res && (res as Response).json ? (res as Response).json() : []))
      .then(npcs => {
        if (cancelled) return;
        setNpcList(Array.isArray(npcs) ? (npcs as NpcRow[]) : []);
        setNpcLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setNpcList([]); setNpcLoading(false);
      });

    return () => { cancelled = true; };
  }, [selectedDocId, selectedDocTitle, selectedDocPath, categoryIdMap]);

  // 현재 문서(아이콘 표시용) 메모
  const currentDoc = useMemo(
    () => allDocuments.find(d => d.id === selectedDocId),
    [allDocuments, selectedDocId]
  );

  // --------- 렌더 ---------
  return (
    <div className="wiki-container">
      <WikiHeader user={user} />
      <div className="wiki-layout">
        <div className="wiki-main-scrollable">
          {/* ---- 사이드바: 카테고리 트리 ---- */}
          <aside className="wiki-sidebar">
            <CategoryTree
              categories={categories}
              categoryIdMap={categoryIdMap}
              categoryIdToPathMap={categoryIdToPathMap}
              selectedDocPath={selectedDocPath}
              selectedDocId={selectedDocId}
              selectedCategoryPath={selectedCategoryPath}
              setSelectedDocPath={setSelectedDocPath}
              setSelectedDocId={setSelectedDocId}
              setSelectedDocTitle={setSelectedDocTitle}
              setSelectedCategoryPath={setSelectedCategoryPath}
              setDocContent={setDocContent}
              fetchDoc={fetchDoc}
              allDocuments={allDocuments}
              openPaths={openPaths}
              closingMap={closingMap}
              closeTreeWithChildren={closeTreeWithChildren}
              togglePath={togglePath}
              handleArrowClick={handleArrowClick}
              isPathOpen={isPathOpen}
              isClosing={isClosing}
              finalizeClose={finalizeClose}
            />
          </aside>

          {/* ---- 본문 영역 ---- */}
          <main className="wiki-content">
            <Breadcrumb
              selectedDocPath={selectedDocPath}
              categories={categories}
              setSelectedDocPath={setSelectedDocPath}
              setSelectedDocTitle={setSelectedDocTitle}
              setDocContent={setDocContent}
            />

            <h2 className="wiki-content-title-row wiki-content-title">
              {/* 문서 아이콘 */}
              {currentDoc?.icon
                ? (currentDoc.icon.startsWith('http')
                    ? <img src={currentDoc.icon} alt="icon" className="wiki-doc-icon-img" />
                    : <span className="wiki-doc-icon-emoji">{currentDoc.icon}</span>)
                : null}
              <span className="wiki-title-color">{selectedDocTitle || '렌독 위키'}</span>
            </h2>

            <div className="wiki-content-body" ref={contentRef}>
              {/* ---- 머리찾기 ---- */}
              {categoryIdMap[selectedDocPath?.[selectedDocPath.length - 1] || -1]?.name === '머리찾기'
                ? headLoading
                  ? <div>머리찾기 목록 로딩 중...</div>
                  : headList.length > 0
                    ? <HeadGrid
                        heads={headList.slice(headPage * 21, (headPage + 1) * 21)}
                        onClick={setSelectedHead}
                        selectedHeadId={selectedHead?.id || null}
                      />
                    : <div>등록된 머리찾기가 없습니다.</div>
                // ---- NPC/퀘스트 ----
                : (categoryIdMap[selectedDocPath?.[selectedDocPath.length - 1] || -1]?.name === '퀘스트' ||
                   categoryIdMap[selectedDocPath?.[selectedDocPath.length - 1] || -1]?.name === 'NPC')
                  ? (npcLoading
                      ? <div>NPC 목록 로딩 중...</div>
                      : npcList.length > 0
                        ? <NpcGrid
                            npcs={npcList.slice(npcPage * 21, (npcPage + 1) * 21)}
                            onClick={setSelectedNpc}
                            selectedNpcId={selectedNpc?.id || null}
                          />
                        : <div>등록된 NPC가 없습니다.</div>)
                  // ---- 일반 문서 ----
                  : (Array.isArray(docContent) && docContent.length > 0
                      ? <WikiReadRenderer content={docContent} />
                      : <div>문서를 찾을 수 없습니다.</div>)
              }

              {/* ---- 페이징: 머리찾기 ---- */}
              {categoryIdMap[selectedDocPath?.[selectedDocPath.length - 1] || -1]?.name === '머리찾기' &&
                headList.length > 21 && (
                  <div className="wiki-paging-bar">
                    <button
                      onClick={() => setHeadPage(p => Math.max(0, p - 1))}
                      disabled={headPage === 0}
                      className="wiki-paging-btn"
                    >
                      ◀
                    </button>
                    <span className="wiki-paging-text">
                      {headPage + 1} / {Math.ceil(headList.length / 21)}
                    </span>
                    <button
                      onClick={() => setHeadPage(p => Math.min(Math.ceil(headList.length / 21) - 1, p + 1))}
                      disabled={headPage === Math.ceil(headList.length / 21) - 1}
                      className="wiki-paging-btn"
                    >
                      ▶
                    </button>
                  </div>
                )
              }

              {/* ---- 페이징: NPC/퀘스트 ---- */}
              {['퀘스트', 'NPC'].includes(
                categoryIdMap[selectedDocPath?.[selectedDocPath.length - 1] || -1]?.name || ''
              ) && npcList.length > 21 && (
                <div className="wiki-paging-bar">
                  <button
                    onClick={() => setNpcPage(p => Math.max(0, p - 1))}
                    disabled={npcPage === 0}
                    className="wiki-paging-btn"
                  >
                    ◀
                  </button>
                  <span className="wiki-paging-text">
                    {npcPage + 1} / {Math.ceil(npcList.length / 21)}
                  </span>
                  <button
                    onClick={() => setNpcPage(p => Math.min(Math.ceil(npcList.length / 21) - 1, p + 1))}
                    disabled={npcPage === Math.ceil(npcList.length / 21) - 1}
                    className="wiki-paging-btn"
                  >
                    ▶
                  </button>
                </div>
              )}

              {/* ---- 상세 모달 ---- */}
              {selectedNpc && (
                <NpcDetailModal
                  npc={selectedNpc}
                  // 퀘스트 카테고리면 'quest', 그 외(NPC 등)면 'npc'
                  mode={rootCatName === '퀘스트' ? 'quest' : 'npc'}
                  onClose={() => setSelectedNpc(null)}
                />
              )}
              {selectedHead && (
                <HeadDetailModal
                  head={selectedHead}
                  docIcon={currentDoc?.icon}
                  onClose={() => setSelectedHead(null)}
                />
              )}
            </div>
          </main>
        </div>

        {/* ---- 목차 ---- */}
        <aside className="wiki-toc-sidebar">
          <TableOfContents headings={tableOfContents} />
        </aside>
      </div>
    </div>
  );
}
