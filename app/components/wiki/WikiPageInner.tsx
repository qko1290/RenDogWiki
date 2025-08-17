// File: app/components/wiki/WikiPageInner.tsx
'use client';

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
  special?: string | null;            // ✅ 추가: 서버가 special을 반환해야 함
};
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

const MODE_PARAM = 'mode';
const MODE_STORAGE = 'wiki:mode';
const MODE_EVENT = 'wiki-mode-change';
const MODE_WHITELIST = new Set(['newbie']);

// ---- helpers -------------------------------------------------
function pathToStr(path: number[]) { return path.join('/'); }
function getInitialMode(): string | null {
  if (typeof window === 'undefined') return null;
  const fromUrl = new URLSearchParams(window.location.search).get(MODE_PARAM);
  const fromLs = window.localStorage.getItem(MODE_STORAGE);
  const v = fromUrl ?? fromLs ?? null;
  return v && MODE_WHITELIST.has(v) ? v : null;
}

// "퀘스트 / 슬라임 빌리지" 같은 포맷 파싱
function parseSpecial(s?: string | null): null | { kind: 'quest' | 'npc' | 'head'; label: string; village: string } {
  if (!s) return null;
  // 구분자: '/', '／', '|' 등 허용 + 앞뒤 공백 제거
  const [rawKind, ...rest] = s.split(/[\/|｜]/);
  if (!rawKind || rest.length === 0) return null;
  const rawVillage = rest.join('/'); // 마을명이 안에 / 가 있으면 다시 합침
  const kindKey = String(rawKind).trim().toLowerCase();

  let kind: 'quest' | 'npc' | 'head' | null = null;
  if (['퀘스트', 'quest', 'q'].includes(kindKey)) kind = 'quest';
  else if (['npc', '엔피씨'].includes(kindKey)) kind = 'npc';
  else if (['머리', '머리찾기', 'head', 'heads'].includes(kindKey)) kind = 'head';

  if (!kind) return null;

  const village = String(rawVillage).trim(); // 공백 정리
  const label = kind === 'quest' ? '퀘스트' : kind === 'npc' ? 'NPC' : '머리';
  if (!village) return null;
  return { kind, label, village };
}

export default function WikiPageInner({ user }: Props) {
  // --------- 모드 상태 ---------
  const [mode, setMode] = useState<string | null>(getInitialMode());

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
  const [tableOfContents, setTableOfContents] = useState<{ id: string; text: string; icon?: string; level: 1 | 2 | 3 }[]>([]);

  // 트리 애니메이션 상태
  const [openPaths, setOpenPaths] = useState<number[][]>([]);
  const [closingMap, setClosingMap] = useState<Record<string, boolean>>({});

  // Special 로딩 전용 상태
  const [specialMeta, setSpecialMeta] = useState<ReturnType<typeof parseSpecial>>(null);
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

  const DEV_LOG = false;
  const P = (...args: any[]) => { if (DEV_LOG && typeof window !== 'undefined') console.log('[WikiPage]', ...args); };

  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  // 헤더 모드 변경 브로드캐스트 수신
  useEffect(() => {
    const onMode = (e: Event) => {
      const next = (e as CustomEvent).detail?.mode ?? null;
      setMode(next && MODE_WHITELIST.has(next) ? next : null);
    };
    if (typeof window !== 'undefined') {
      window.addEventListener(MODE_EVENT, onMode as EventListener);
      return () => window.removeEventListener(MODE_EVENT, onMode as EventListener);
    }
  }, []);

  // 문서 fetch 최신성 보장용 시퀀스
  const docReqIdRef = useRef(0);

  // (핵심) 카테고리 트리 + 전체 문서 로드
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const catUrl = mode ? `/api/categories?modes=${encodeURIComponent(mode)}` : '/api/categories';
        const resCat = await fetch(catUrl, { cache: 'no-store' });
        const catData = await resCat.json();

        const mod = await import('@/wiki/lib/buildCategoryTree');
        const tree = mod.buildCategoryTree(catData) as CategoryNode[];
        if (cancelled || !mountedRef.current) return;
        setCategories(tree);

        const idToPath: Record<number, number[]> = {};
        const catMap: Record<number, CategoryNode> = {};
        const walk = (nodes: CategoryNode[], path: number[] = []) => {
          for (const n of nodes) {
            const p = [...path, n.id];
            idToPath[n.id] = p;
            catMap[n.id] = n;
            if (n.children?.length) walk(n.children, p);
          }
        };
        walk(tree);
        if (cancelled || !mountedRef.current) return;
        setCategoryIdToPathMap(idToPath);
        setCategoryIdMap(catMap);

        // 선택 초기화
        setSelectedDocId(null);
        setSelectedDocPath(null);
        setSelectedDocTitle(null);
        setSelectedCategoryPath(null);
        setDocContent(null);
        setOpenPaths([]);
        setClosingMap({});

        // 전체 문서
        const resDoc = await fetch('/api/documents?all=1', { cache: 'no-store' });
        const docsRaw = await resDoc.json();
        const docs = Array.isArray(docsRaw) ? docsRaw : Array.isArray(docsRaw.documents) ? docsRaw.documents : [];
        const mapped = (docs as (Document & { path: number })[]).map(doc => ({
          ...doc,
          fullPath: idToPath[doc.path] || [doc.path],
        }));
        if (cancelled || !mountedRef.current) return;
        setAllDocuments(mapped);
      } catch {}
    })();

    return () => { cancelled = true; };
  }, [mode]);

  // 쿼리 진입 시 문서 자동 fetch
  useEffect(() => {
    const pathParam = searchParams.get('path');
    const titleParam = searchParams.get('title');
    if (pathParam && titleParam) {
      const pathId = Number(pathParam);
      const fullPath = categoryIdToPathMap[pathId];
      if (fullPath) fetchDoc(fullPath, titleParam, undefined, { clearCategoryPath: true });
    }
  }, [searchParams, categoryIdToPathMap]);

  // 닫힘 관련 유틸
  const isPathOpen = (path: number[]) => openPaths.some(p => pathToStr(p) === pathToStr(path));
  const isClosing = (path: number[]) => closingMap[pathToStr(path)] || false;
  const finalizeClose = (path: number[]) => {
    const key = pathToStr(path);
    setOpenPaths(prev => prev.filter(p => pathToStr(p) !== key));
    setClosingMap(prev => { const n = { ...prev }; delete n[key]; return n; });
  };
  const closeTreeWithChildren = async (node: CategoryNode, path: number[]): Promise<void> => {
    const key = pathToStr(path);
    setClosingMap(prev => ({ ...prev, [key]: true }));
    if (node.children?.length) {
      node.children.forEach(child => {
        const childPath = [...path, child.id];
        if (isPathOpen(childPath)) void closeTreeWithChildren(child, childPath);
      });
    }
  };
  const handleArrowClick = (node: CategoryNode, path: number[]) => {
    const key = pathToStr(path);
    const isOpenNow = isPathOpen(path);
    if (isOpenNow) {
      void closeTreeWithChildren(node, path);
    } else {
      setClosingMap(prev => { const n = { ...prev }; delete n[key]; return n; });
      setOpenPaths(prev => (prev.some(p => pathToStr(p) === key) ? prev : [...prev, path]));
    }
  };
  const togglePath = async (path: number[]) => {
    const key = pathToStr(path);
    const catId = path.at(-1)!;
    const category = categoryIdMap[catId];
    const isSamePath = selectedDocPath && JSON.stringify(selectedDocPath) === JSON.stringify(path);
    const isSameDoc = selectedDocId === category?.document_id;
    const docId = Number(category?.document_id);

    if (category?.document_id && Number.isInteger(docId) && (!isSamePath || !isSameDoc)) {
      try {
        const res = await fetch(`/api/documents?id=${docId}`, { cache: 'no-store' });
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

        setOpenPaths(prev => (prev.some(p => JSON.stringify(p) === JSON.stringify(path)) ? prev : [...prev, path]));
      } catch {
        setSelectedDocId(null);
        setSelectedDocPath(null);
        setSelectedDocTitle(null);
        setDocContent([]);
        setSelectedCategoryPath(path);
      }
    }
  };

  // --------- 문서 fetch ---------
  function fetchDoc(
    categoryPath: number[],
    docTitle: string,
    docId?: number,
    options?: { clearCategoryPath?: boolean }
  ) {
    if (options?.clearCategoryPath) setSelectedCategoryPath(null);
    setSelectedDocTitle(docTitle);

    // 초기 선택 세팅
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

    const reqId = ++docReqIdRef.current;

    fetch(`/api/documents?path=${String(categoryPath.at(-1))}&title=${encodeURIComponent(docTitle)}`, { cache: 'no-store' })
      .then(res => {
        if (!res.ok) throw new Error('문서를 찾을 수 없습니다.');
        return res.json();
      })
      .then(data => {
        if (!mountedRef.current || reqId !== docReqIdRef.current) return;

        const content: Descendant[] =
          typeof data.content === 'string' ? JSON.parse(data.content) : data.content;

        setDocContent(content);
        setTableOfContents(extractHeadings(content));

        // ✅ special 메타 파싱 저장
        setSpecialMeta(parseSpecial(data.special ?? (allDocuments.find(d => d.id === data.id)?.special)));

        if (data.fullPath && Array.isArray(data.fullPath)) {
          setSelectedDocPath([...data.fullPath]);
        }
      })
      .catch(() => {
        if (!mountedRef.current || reqId !== docReqIdRef.current) return;
        setDocContent(null);
        setSpecialMeta(null);
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
          router.push(`/wiki?path=${encodeURIComponent(path)}&title=${encodeURIComponent(title)}&_t=${Date.now()}`);
        }
      }
    };

    el.addEventListener('click', handler);
    return () => el.removeEventListener('click', handler);
  }, [docContent, router]);

  // --------- Special 기반 데이터 로딩(유일한 소스) ---------
  useEffect(() => {
    // 선택/문서/스페셜 없으면 리셋
    if (!selectedDocId || !selectedDocTitle) {
      setNpcList([]); setNpcLoading(false); setNpcPage(0);
      setHeadList([]); setHeadLoading(false); setHeadPage(0);
      return;
    }
    const meta = specialMeta;
    if (!meta) {
      // special이 없으면 그냥 일반 문서만 보여줌
      setNpcList([]); setNpcLoading(false); setNpcPage(0);
      setHeadList([]); setHeadLoading(false); setHeadPage(0);
      return;
    }

    let cancelled = false;

    // village 찾기: special의 마을명 → 실패 시 문서 제목으로 한 번 더 시도(띄어쓰기/오타 대처)
    const findVillage = async () => {
      const tryNames = Array.from(new Set([meta.village, selectedDocTitle].filter(Boolean))) as string[];
      for (const name of tryNames) {
        const r = await fetch(`/api/villages?name=${encodeURIComponent(name)}`);
        if (!r.ok) continue;
        const v = await r.json();
        if (v && v.id) return v;
      }
      return null;
    };

    (async () => {
      if (meta.kind === 'head') {
        setHeadLoading(true); setHeadList([]); setHeadPage(0);
        const village = await findVillage();
        if (cancelled) return;
        if (!village) { setHeadLoading(false); return; }
        const res = await fetch(`/api/head?village_id=${village.id}`);
        const heads = res.ok ? await res.json() : [];
        if (cancelled) return;
        setHeadList(Array.isArray(heads) ? (heads as HeadRow[]) : []); setHeadLoading(false);
        return;
      }

      // NPC/퀘스트
      setNpcLoading(true); setNpcList([]); setNpcPage(0);
      const village = await findVillage();
      if (cancelled) return;
      if (!village) { setNpcLoading(false); return; }
      const npcType = meta.kind === 'quest' ? 'quest' : 'normal';
      const res = await fetch(`/api/npcs?village_id=${village.id}&npc_type=${npcType}`);
      const npcs = res.ok ? await res.json() : [];
      if (cancelled) return;
      setNpcList(Array.isArray(npcs) ? (npcs as NpcRow[]) : []); setNpcLoading(false);
    })();

    return () => { cancelled = true; };
  }, [selectedDocId, selectedDocTitle, specialMeta]);

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

          <main className="wiki-content">
            <Breadcrumb
              selectedDocPath={selectedDocPath}
              categories={categories}
              setSelectedDocPath={setSelectedDocPath}
              setSelectedDocTitle={setSelectedDocTitle}
              setDocContent={setDocContent}
            />

            <h2 className="wiki-content-title-row wiki-content-title">
              {currentDoc?.icon
                ? (currentDoc.icon.startsWith('http')
                    ? <img src={currentDoc.icon} alt="icon" className="wiki-doc-icon-img" />
                    : <span className="wiki-doc-icon-emoji">{currentDoc.icon}</span>)
                : null}
              <span className="wiki-title-color">{selectedDocTitle || '렌독 위키'}</span>
            </h2>

            <div className="wiki-content-body" ref={contentRef}>
              {/* special이 head 인 경우 */}
              {specialMeta?.kind === 'head'
                ? (headLoading
                    ? <div>머리 목록 로딩 중...</div>
                    : headList.length > 0
                      ? <HeadGrid
                          heads={headList.slice(headPage * 21, (headPage + 1) * 21)}
                          onClick={setSelectedHead}
                          selectedHeadId={selectedHead?.id || null}
                        />
                      : <div>등록된 머리가 없습니다.</div>)
                // special이 npc/quest 인 경우
                : (specialMeta?.kind === 'npc' || specialMeta?.kind === 'quest')
                  ? (npcLoading
                      ? <div>NPC 목록 로딩 중...</div>
                      : npcList.length > 0
                        ? <NpcGrid
                            npcs={npcList.slice(npcPage * 21, (npcPage + 1) * 21)}
                            onClick={setSelectedNpc}
                            selectedNpcId={selectedNpc?.id || null}
                          />
                        : <div>등록된 NPC가 없습니다.</div>)
                  // special이 없으면 일반 문서
                  : (Array.isArray(docContent) && docContent.length > 0
                      ? <WikiReadRenderer content={docContent} />
                      : <div>문서를 찾을 수 없습니다.</div>)
              }

              {/* 페이징: 머리 */}
              {specialMeta?.kind === 'head' && headList.length > 21 && (
                <div className="wiki-paging-bar">
                  <button onClick={() => setHeadPage(p => Math.max(0, p - 1))} disabled={headPage === 0} className="wiki-paging-btn">◀</button>
                  <span className="wiki-paging-text">{headPage + 1} / {Math.ceil(headList.length / 21)}</span>
                  <button onClick={() => setHeadPage(p => Math.min(Math.ceil(headList.length / 21) - 1, p + 1))} disabled={headPage === Math.ceil(headList.length / 21) - 1} className="wiki-paging-btn">▶</button>
                </div>
              )}

              {/* 페이징: NPC/퀘스트 */}
              {(specialMeta?.kind === 'npc' || specialMeta?.kind === 'quest') && npcList.length > 21 && (
                <div className="wiki-paging-bar">
                  <button onClick={() => setNpcPage(p => Math.max(0, p - 1))} disabled={npcPage === 0} className="wiki-paging-btn">◀</button>
                  <span className="wiki-paging-text">{npcPage + 1} / {Math.ceil(npcList.length / 21)}</span>
                  <button onClick={() => setNpcPage(p => Math.min(Math.ceil(npcList.length / 21) - 1, p + 1))} disabled={npcPage === Math.ceil(npcList.length / 21) - 1} className="wiki-paging-btn">▶</button>
                </div>
              )}

              {/* 상세 모달 */}
              {selectedNpc && (
                <NpcDetailModal
                  npc={selectedNpc}
                  mode={specialMeta?.kind === 'quest' ? 'quest' : 'npc'}
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

        <aside className="wiki-toc-sidebar">
          <TableOfContents headings={tableOfContents} />
        </aside>
      </div>
    </div>
  );
}
