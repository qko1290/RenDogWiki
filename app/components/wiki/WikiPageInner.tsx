// =============================================
// File: app/wiki/WikiPageInner.tsx
// (이미지 lazy/async 적용 유지, 로더 포함 / 전환 딜레이 적용
//  + 문서 제목 왼쪽 링크 복사 버튼 추가)
// =============================================
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
import FaqList from './FaqList';
import FaqUpsertModal from '@/components/wiki/FaqUpsertModal';
import { toProxyUrl } from '@lib/cdn';

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
  path: string | number;          // ⭐ 루트는 0
  icon?: string;
  fullPath?: number[];
  is_featured?: boolean;
  special?: string | null;
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
const MODE_WHITELIST = new Set(['뉴비']);

// ✅ 루트 대표 문서 ID 하드코딩
const ROOT_FEATURED_DOC_ID = 73;

function pathToStr(path: number[]) { return path.join('/'); }
function getInitialMode(): string | null {
  if (typeof window === 'undefined') return null;
  const fromUrl = new URLSearchParams(window.location.search).get(MODE_PARAM);
  const fromLs = window.localStorage.getItem(MODE_STORAGE);
  const v = fromUrl ?? fromLs ?? null;
  return v && MODE_WHITELIST.has(v) ? v : null;
}

// no-cache 유틸
const withTs = (url: string) => url + (url.includes('?') ? '&' : '?') + '_ts=' + Date.now();
const NC: RequestInit = { cache: 'no-store' };

// ---- 권한 체크(Writer+)
function useCanWrite(user: Props['user']) {
  const [can, setCan] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!user) { setCan(false); return; }
        const r = await fetch('/api/auth/me', { cache: 'no-store' });
        const me = r.ok ? await r.json() : null;
        const role = (me?.role ?? me?.user?.role ?? '').toLowerCase?.() || '';
        const roles: string[] = (me?.roles ?? me?.user?.roles ?? me?.permissions ?? me?.user?.permissions ?? [])
          .map((v: any) => String(v).toLowerCase());
        // ✅ manager 제외
        const ok = role === 'admin' || role === 'writer'
          || roles.includes('admin') || roles.includes('writer');
        if (!cancelled) setCan(!!ok);
      } catch { if (!cancelled) setCan(false); }
    })();
    return () => { cancelled = true; };
  }, [user?.id]);
  return can;
}

// ---- Special 파서
type SpecialMeta =
  | { kind: 'quest' | 'npc' | 'head'; label: string; village: string }
  | { kind: 'faq'; q?: string; tags?: string[] }
  | null;

function parseSpecial(raw?: string | null): SpecialMeta {
  if (!raw) return null;
  const s = raw.trim();

  const lower = s.toLowerCase();
  if (lower.startsWith('faq') || lower.startsWith('질문') || lower.startsWith('자주')) {
    const after = s.split('/').slice(1).join('/') || '';
    const meta: { q?: string; tags?: string[] } = {};
    if (after.startsWith('tag:')) meta.tags = after.slice(4).split(',').map(t => t.trim()).filter(Boolean);
    if (after.startsWith('q:')) meta.q = after.slice(2).trim();
    return { kind: 'faq', ...meta };
  }

  const [rawKind, ...rest] = s.split(/[\/|｜]/);
  if (!rawKind || rest.length === 0) return null;
  const village = rest.join('/').trim();
  const kindKey = rawKind.trim().toLowerCase();
  let kind: 'quest' | 'npc' | 'head' | null = null;
  if (['퀘스트', 'quest', 'q'].includes(kindKey)) kind = 'quest';
  else if (['npc', '엔피씨'].includes(kindKey)) kind = 'npc';
  else if (['머리', '머리찾기', 'head', 'heads'].includes(kindKey)) kind = 'head';
  if (!kind || !village) return null;
  const label = kind === 'quest' ? '퀘스트' : kind === 'npc' ? 'NPC' : '머리';
  return { kind, label, village };
}

export default function WikiPageInner({ user }: Props) {
  const [mode, setMode] = useState<string | null>(getInitialMode());

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

  const [openPaths, setOpenPaths] = useState<number[][]>([]);
  const [closingMap, setClosingMap] = useState<Record<string, boolean>>({});

  const [specialMeta, setSpecialMeta] = useState<SpecialMeta>(null);
  const [npcList, setNpcList] = useState<NpcRow[]>([]);
  const [npcLoading, setNpcLoading] = useState(false);
  const [selectedNpc, setSelectedNpc] = useState<NpcRow | null>(null);
  const [npcPage, setNpcPage] = useState(0);

  const [headList, setHeadList] = useState<HeadRow[]>([]);
  const [headLoading, setHeadLoading] = useState(false);
  const [selectedHead, setSelectedHead] = useState<HeadRow | null>(null);
  const [headPage, setHeadPage] = useState(0);

  const [headVillageIcon, setHeadVillageIcon] = useState<string | null>(null);

  const [faqQuery, setFaqQuery] = useState('');
  const [faqTags, setFaqTags] = useState<string[]>([]);
  const [faqRefreshSignal, setFaqRefreshSignal] = useState(0);

  const [showNewFaq, setShowNewFaq] = useState(false);

  // 🔗 문서 링크 복사 상태
  const [copiedDocLink, setCopiedDocLink] = useState(false);

  // ⭐ 루트 문서는 문서 크롬(제목/브레드크럼) 숨김
  const [hideDocChrome, setHideDocChrome] = useState(false);
  const [loadingDoc, setLoadingDoc] = useState(false);

  // ---------- 전환 지연(딜레이) 상태 ----------
  const [delaying, setDelaying] = useState(false);
  const SWAP_DELAY_MS = 180; // 체감 120~220ms 권장
  // -------------------------------------------

  const firstLoadRef = useRef(true);
  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  const canWrite = useCanWrite(user);

  const router = useRouter();
  const searchParams = useSearchParams();
  const contentRef = useRef<HTMLDivElement>(null);

  const syncUrlWithDoc = (
    docTitle: string | null,
    fullPath: number[] | null | undefined
  ) => {
    if (typeof window === 'undefined') return;
    if (!docTitle) return;

    const search = new URLSearchParams(window.location.search);
    const currentPath = search.get('path');
    const currentTitle = search.get('title');

    // 루트([])면 path=0, 그 외에는 fullPath의 마지막 카테고리 id
    const lastId =
      !fullPath || fullPath.length === 0
        ? '0'
        : String(fullPath[fullPath.length - 1]);

    // 이미 같은 값이면 불필요한 replace 방지
    if (currentPath === lastId && currentTitle === docTitle) return;

    search.set('path', lastId);
    search.set('title', docTitle);
    // 내부 fetch용 타임스탬프는 URL에 남길 필요 없음
    search.delete('_t');

    const hash = window.location.hash || '';
    const nextUrl =
      window.location.pathname + '?' + search.toString() + hash;

    router.replace(nextUrl);
  };

  // 🔗 현재 문서 링크 복사
  const handleCopyDocLink = async () => {
    if (typeof window === 'undefined') return;
    try {
      const { origin, pathname, search } = window.location;
      const url = `${origin}${pathname}${search}`; // 해시는 제외
      await navigator.clipboard?.writeText(url);
      setCopiedDocLink(true);
      setTimeout(() => setCopiedDocLink(false), 1500);
    } catch (e) {
      console.error('Failed to copy doc link', e);
    }
  };

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

  const docReqIdRef = useRef(0);

  // ----------------------------------------
  // 유틸: 루트 대표 문서 찾기 & 열기
  // ----------------------------------------
  const findRootDoc = () => {
    const roots = allDocuments.filter(
      (d) => (Array.isArray(d.fullPath) && d.fullPath.length === 0) || Number(d.path) === 0
    );
    // 대표 우선(is_featured) → 없으면 첫번째
    return roots.find(d => d.is_featured) || roots[0];
  };

  const openRootDoc = async () => {
    const rootDoc = findRootDoc();
    if (!rootDoc) return;

    setHideDocChrome(true);
    setSelectedDocId(rootDoc.id);
    setSelectedDocTitle(rootDoc.title ?? null);
    setSelectedDocPath([]);             // 루트 경로는 []
    setSelectedCategoryPath(null);

    await fetchDocById(rootDoc.id, { hideChrome: true });
  };

  // ✅ 특정 ID로 루트 문서 열기(로고/초기 로딩용)
  const openRootDocById = async (docId: number) => {
    setHideDocChrome(true);
    setSelectedCategoryPath(null);
    setSelectedDocPath([]);             // 루트 경로 고정
    setSelectedDocId(docId);
    const inList = allDocuments.find(d => d.id === docId);
    setSelectedDocTitle(inList?.title ?? null); // 목록에 있으면 즉시 반영
    await fetchDocById(docId, { hideChrome: true });
  };

  // 카테고리 + 전체 문서 로드
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const url = '/api/bootstrap' + (mode ? `?m=${encodeURIComponent(mode)}` : '');
        const r = await fetch(withTs(url), NC);
        const { categories: catData, documents: docsRaw, featured } = await r.json();

        // 카테고리 트리 구성
        const mod = await import('@/wiki/lib/buildCategoryTree');
        const tree = mod.buildCategoryTree(catData) as CategoryNode[];
        if (cancelled || !mountedRef.current) return;
        setCategories(tree);

        // 맵/경로 구축
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

        // 전체 문서 메타
        const mapped: Document[] = (docsRaw || []).map((r: any) => {
          const pNum = /^\d+$/.test(String(r.path)) ? Number(r.path) : NaN;
          const fullPath =
            Number(r.path) === 0 ? [] :
            Number.isFinite(pNum) ? (idToPath[pNum] || [pNum]) : [];
          return { ...r, fullPath, special: r.special ?? null };
        });
        if (cancelled || !mountedRef.current) return;
        setAllDocuments(mapped);

        // 최초 뷰를 바로 렌더(대표 문서)
        if (featured?.id && featured?.content) {
          setHideDocChrome(true);
          setSelectedDocId(featured.id);
          setSelectedDocTitle(featured.title ?? null);
          setSelectedDocPath([]); // 루트
          setSelectedCategoryPath(null);
          setDocContent(typeof featured.content === 'string'
            ? JSON.parse(featured.content) : featured.content);
          setTableOfContents(extractHeadings(typeof featured.content === 'string'
            ? JSON.parse(featured.content) : featured.content));
        }
      } catch (e) {
        console.error('[bootstrap init] failed', e);
      }
    })();
    return () => { cancelled = true; };
  }, [mode]);

  // 쿼리 진입: /wiki?path=...&title=...
  // ✅ allDocuments/카테고리 맵이 준비된 뒤 실행되며, 루트(path=0)는 id 우선 로딩
  useEffect(() => {
    const pathParam = searchParams.get('path');
    const titleParam = searchParams.get('title');
    if (!pathParam || !titleParam) return;

    const openByIdIfFound = (isRoot: boolean, id?: number) => {
      if (id != null) {
        fetchDoc(isRoot ? [] : [/*unused*/], titleParam, id, { clearCategoryPath: true, forceRoot: isRoot });
        return true;
      }
      return false;
    };

    if (pathParam === '0') {
      if (allDocuments.length === 0) return; // 문서 목록 먼저
      const match = allDocuments.find(
        d => ((Array.isArray(d.fullPath) && d.fullPath.length === 0) || Number(d.path) === 0)
          && d.title === titleParam
      );
      if (openByIdIfFound(true, match?.id)) return;
      // 🔁 목록에 없으면 Fallback: 서버 path=0+title 조회 시도
      fetchDoc([], titleParam, undefined, { clearCategoryPath: true, forceRoot: true });
    } else {
      const pathId = Number(pathParam);
      const fullPath = categoryIdToPathMap[pathId];
      if (fullPath) {
        fetchDoc(fullPath, titleParam, undefined, { clearCategoryPath: true });
      }
    }
  }, [searchParams, allDocuments, categoryIdToPathMap]);

  const isPathOpen = (path: number[]) =>
    openPaths.some(p => pathToStr(p) === pathToStr(path)); // 비교 버그 수정

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
        if (isPathOpen(childPath)) void closeTreeWithChildren(node, childPath);
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
          setSelectedDocId(null); setSelectedDocPath(null); setSelectedDocTitle(null);
          setDocContent([]); setSelectedCategoryPath(path); return;
        }
        setSelectedDocId(doc.id);
        setSelectedDocPath([...path]);
        setSelectedDocTitle(doc.title);
        setSelectedCategoryPath(path);
        setHideDocChrome(false); // 루트가 아닌 문서 오픈 시 표시
        fetchDoc(path, doc.title, doc.id);
        setOpenPaths(prev => (prev.some(p => JSON.stringify(p) === JSON.stringify(path)) ? prev : [...prev, path]));
      } catch {
        setSelectedDocId(null); setSelectedDocPath(null); setSelectedDocTitle(null);
        setDocContent([]); setSelectedCategoryPath(path);
      }
    }
  };

  function BookLoader() {
    return (
      <div className="wiki-loader-wrap">
        <div className="loader">
          <div className="book-wrapper">
            <svg xmlns="http://www.w3.org/2000/svg" fill="white" viewBox="0 0 126 75" className="book">
              <rect strokeWidth={5} stroke="#9EC6F3" rx="7.5" height={70} width={121} y="2.5" x="2.5" />
              <line strokeWidth={5} stroke="#9EC6F3" y2={75} x2="63.5" x1="63.5" />
              <path strokeLinecap="round" strokeWidth={4} stroke="#c18949" d="M25 20H50" />
              <path strokeLinecap="round" strokeWidth={4} stroke="#c18949" d="M101 20H76" />
              <path strokeLinecap="round" strokeWidth={4} stroke="#c18949" d="M16 30L50 30" />
              <path strokeLinecap="round" strokeWidth={4} stroke="#c18949" d="M110 30L76 30" />
            </svg>
            <svg xmlns="http://www.w3.org/2000/svg" fill="#ffffff74" viewBox="0 0 65 75" className="book-page">
              <path strokeLinecap="round" strokeWidth={4} stroke="#c18949" d="M40 20H15" />
              <path strokeLinecap="round" strokeWidth={4} stroke="#c18949" d="M49 30L15 30" />
              <path strokeWidth={5} stroke="#9EC6F3" d="M2.5 2.5H55C59.1421 2.5 62.5 5.85786 62.5 10V65C62.5 69.1421 59.1421 72.5 55 72.5H2.5V2.5Z" />
            </svg>
          </div>
        </div>

        <style jsx>{`
          .wiki-loader-wrap{
            display:flex; align-items:center; justify-content:center;
            padding: 40px 0;
          }
          .loader { display:flex; align-items:center; justify-content:center; }
          .book-wrapper {
            top: 100px;
            width: 350px; height: fit-content;
            display:flex; align-items:center; justify-content:flex-end;
            position: relative;
          }
          .book { width:100%; height:auto; filter: drop-shadow(10px 10px 5px rgba(0,0,0,0.137)); }
          .book-wrapper .book-page{
            width:50%; height:auto; position:absolute;
            transform-origin:left;
            animation: paging .40s linear infinite;
          }
          @keyframes paging {
            0% { transform: rotateY(0deg) skewY(0deg); }
            50% { transform: rotateY(90deg) skewY(-20deg); }
            100% { transform: rotateY(180deg) skewY(0deg); }
          }
        `}</style>
      </div>
    );
  }

  // 문서 fetch (path/title)
  function fetchDoc(
    categoryPath: number[],
    docTitle: string,
    docId?: number,
    options?: { clearCategoryPath?: boolean; forceRoot?: boolean }
  ) {
    const isRoot = options?.forceRoot || categoryPath.length === 0; // ✅ 루트 문서 여부
    if (options?.clearCategoryPath) setSelectedCategoryPath(null);
    setSelectedDocTitle(docTitle);
    setHideDocChrome(isRoot); // ✅ 루트는 카테고리 스타일(크롬 숨김)

    // 루트 + id 미지정 → 목록에서 id로 로딩
    if (isRoot && docId == null) {
      const match = allDocuments.find(
        d => ((Array.isArray(d.fullPath) && d.fullPath.length === 0) || Number(d.path) === 0)
          && d.title === docTitle
      );
      if (match?.id != null) {
        setSelectedDocId(match.id);
        setSelectedDocPath([]); // 루트
        setLoadingDoc(true); 
        void fetchDocById(match.id, { hideChrome: true });
        return;
      }
    }

    if (docId != null) {
      setSelectedDocId(docId);
      setSelectedDocPath(isRoot ? [] : [...categoryPath]);
    } else {
      const doc = allDocuments.find(d =>
        d.title === docTitle &&
        (
          (isRoot && ((Array.isArray(d.fullPath) && d.fullPath.length === 0) || Number(d.path) === 0)) ||
          JSON.stringify(d.fullPath) === JSON.stringify(categoryPath)
        )
      );
      if (doc) {
        setSelectedDocId(doc.id);
        setSelectedDocPath(isRoot ? [] : [...categoryPath]);
      }
    }

    const reqId = ++docReqIdRef.current;
    setLoadingDoc(true);  

    const pathParam = isRoot ? '0' : String(categoryPath.at(-1));
    fetch(
      withTs(`/api/documents?path=${pathParam}&title=${encodeURIComponent(docTitle)}`),
      NC
    )
      .then(res => { if (!res.ok) throw new Error('문서를 찾을 수 없습니다.'); return res.json(); })
      .then(data => {
        if (!mountedRef.current || reqId !== docReqIdRef.current) return;
        const content: Descendant[] = typeof data.content === 'string' ? JSON.parse(data.content) : data.content;
        setDocContent(content);
        setTableOfContents(extractHeadings(content));

        const docInList = allDocuments.find(d => d.id === data.id);
        const special = data.special ?? docInList?.special ?? null;
        const meta = parseSpecial(special);
        setSpecialMeta(meta);

        if (meta?.kind === 'faq') {
          setFaqQuery(meta.q ?? ''); setFaqTags(meta.tags ?? []);
        } else {
          setFaqQuery(''); setFaqTags([]);
        }

        // 🔁 fullPath 기준으로 nextPath 계산 (없으면 기존 categoryPath/루트 사용)
        let nextPath: number[] = [];
        if (Array.isArray(data.fullPath)) {
          nextPath = [...data.fullPath];
        } else if (isRoot) {
          nextPath = [];
        } else {
          nextPath = [...categoryPath];
        }
        setSelectedDocPath(nextPath);

        // ✅ 문서 로드 후 URL ?path=&title= 동기화
        syncUrlWithDoc(data.title ?? docTitle, nextPath);

        setLoadingDoc(false); // 성공 종료
      })
      .catch(() => {
        if (!mountedRef.current || reqId !== docReqIdRef.current) return;
        setDocContent(null);
        setSpecialMeta(null);
        setFaqQuery(''); setFaqTags([]);
        setLoadingDoc(false); // 실패 종료
      });
  }

  // 문서 fetch (id)
  async function fetchDocById(docId: number, opts?: { hideChrome?: boolean }) {
    const reqId = ++docReqIdRef.current;
    setLoadingDoc(true);
    try {
      const r = await fetch(withTs(`/api/documents?id=${docId}`), NC);
      if (!r.ok) throw 0;
      const data = await r.json();
      if (!mountedRef.current || reqId !== docReqIdRef.current) return;

      const content: Descendant[] =
        typeof data.content === 'string' ? JSON.parse(data.content) : data.content;
      setDocContent(content);
      setTableOfContents(extractHeadings(content));

      const docInList = allDocuments.find(d => d.id === data.id);
      const special = data.special ?? docInList?.special ?? null;
      const meta = parseSpecial(special);
      setSpecialMeta(meta);
      if (meta?.kind === 'faq') { setFaqQuery(meta.q ?? ''); setFaqTags(meta.tags ?? []); }
      else { setFaqQuery(''); setFaqTags([]); }

      setSelectedDocTitle(data.title ?? null);

      // ★★★ 경로 계산 고정
      let nextPath: number[] = [];
      if (docInList?.fullPath) {
        nextPath = docInList.fullPath;
      } else {
        const rawPath = data.path;
        if (Number(rawPath) === 0) nextPath = [];
        else if (/^\d+$/.test(String(rawPath))) {
          const cid = Number(rawPath);
          nextPath = categoryIdToPathMap[cid] ?? (Number.isFinite(cid) ? [cid] : []);
        }
      }
      setSelectedDocPath(nextPath);

      syncUrlWithDoc(data.title ?? null, nextPath);

      setHideDocChrome(!!opts?.hideChrome);
      setLoadingDoc(false);
    } catch {
      if (!mountedRef.current || reqId !== docReqIdRef.current) return;
      setDocContent(null);
      setSpecialMeta(null);
      setFaqQuery(''); setFaqTags([]);
      setLoadingDoc(false);
    }
  }

  // 본문 내부 링크 라우팅
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;

    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const aTag = target?.closest('a');
      if (!aTag) return;

      const href = aTag.getAttribute('href');
      if (!href) return;

      // 위키 내부 문서 링크만 가로채기
      if (href.startsWith('/wiki')) {
        const url = new URL(href, window.location.origin);
        if (url.pathname !== '/wiki') return;

        const path = url.searchParams.get('path');
        const title = url.searchParams.get('title');
        if (!path || !title) return;

        e.preventDefault();

        // path / title만 정규화해서 사용하고, 해시는 그대로 유지
        const params = new URLSearchParams();
        params.set('path', path);
        params.set('title', title);

        const hash = url.hash || '';

        router.push(`/wiki?${params.toString()}${hash}`);
      }
    };

    el.addEventListener('click', handler);
    return () => el.removeEventListener('click', handler);
  }, [docContent, router]);

  // ---------- ✨ 전환 딜레이: 잘못된 목록 잔상 대신 로더만 잠깐 노출 ----------
  useEffect(() => {
    setDelaying(true);
    const t = setTimeout(() => setDelaying(false), SWAP_DELAY_MS);
    return () => clearTimeout(t);
  }, [selectedDocId, specialMeta?.kind]);
  // -----------------------------------------------------------------------

  // Special 데이터 로딩(FAQ 제외)
  useEffect(() => {
    if (!selectedDocId || !selectedDocTitle) {
      setNpcList([]); setNpcLoading(false); setNpcPage(0);
      setHeadList([]); setHeadLoading(false); setHeadPage(0);
      setHeadVillageIcon(null); // 🔽 머리 아이콘 초기화
      return;
    }
    const meta = specialMeta;
    if (!meta || meta.kind === 'faq') {
      setNpcList([]); setNpcLoading(false); setNpcPage(0);
      setHeadList([]); setHeadLoading(false); setHeadPage(0);
      setHeadVillageIcon(null); // 🔽 머리 아이콘 초기화
      return;
    }

    let cancelled = false;
    const findVillage = async (names: string[]) => {
      for (const name of names) {
        const r = await fetch(withTs(`/api/villages?name=${encodeURIComponent(name)}`), NC);
        if (!r.ok) continue;
        const v = await r.json();
        if (v && v.id) return v;
      }
      return null;
    };

    (async () => {
      if (meta.kind === 'head') {
        setHeadLoading(true); setHeadList([]); setHeadPage(0);
        const v = await findVillage([meta.village, selectedDocTitle].filter(Boolean) as string[]);
        if (!v) {
          if (!cancelled) {
            setHeadLoading(false);
            setHeadVillageIcon(null);   // 🔽 못 찾으면 null
          }
          return;
        }

        // 🔽 여기서 village 테이블의 head_icon을 상태에 저장
        if (!cancelled) {
          setHeadVillageIcon(v.head_icon ?? null);
        }

        const res = await fetch(withTs(`/api/head?village_id=${v.id}`), NC);
        const heads = res.ok ? await res.json() : [];
        if (cancelled) return;
        setHeadList(Array.isArray(heads) ? (heads as HeadRow[]) : []);
        setHeadLoading(false);
        return;
      }

      // quest / npc
      setHeadVillageIcon(null); // 🔽 머리 모드가 아니면 아이콘 초기화
      setNpcLoading(true); setNpcList([]); setNpcPage(0);
      const v = await findVillage([meta.village, selectedDocTitle].filter(Boolean) as string[]);
      if (!v) { if (!cancelled) setNpcLoading(false); return; }
      const npcType = meta.kind === 'quest' ? 'quest' : 'normal';
      const res = await fetch(withTs(`/api/npcs?village_id=${v.id}&npc_type=${npcType}`), NC);
      const npcs = res.ok ? await res.json() : [];
      if (cancelled) return;
      setNpcList(Array.isArray(npcs) ? (npcs as NpcRow[]) : []);
      setNpcLoading(false);
    })();

    return () => { cancelled = true; };
  }, [selectedDocId, selectedDocTitle, specialMeta]);

  const currentDoc = useMemo(
    () => allDocuments.find(d => d.id === selectedDocId),
    [allDocuments, selectedDocId]
  );

  const isFaq = specialMeta?.kind === 'faq';

  // ✅ 초기 자동 오픈: 카테고리/문서 세팅 완료 후 "ID=73"
  useEffect(() => {
    if (!firstLoadRef.current) return;
    if (!mountedRef.current) return;

    const ready =
      categories && categories.length > 0 &&
      allDocuments && allDocuments.length > 0 &&
      !selectedDocId;

    if (!ready) return;

    const hasUrl = !!(searchParams.get('path') && searchParams.get('title'));
    if (hasUrl) return; // 딥링크 우선

    firstLoadRef.current = false;

    const id1 = requestAnimationFrame(() => {
      const id2 = requestAnimationFrame(() => {
        openRootDocById(ROOT_FEATURED_DOC_ID);
      });
      (window as any).__wiki_root_open_cleanup = () => cancelAnimationFrame(id2);
    });

    return () => {
      cancelAnimationFrame(id1);
      const c = (window as any).__wiki_root_open_cleanup;
      if (typeof c === 'function') { c(); delete (window as any).__wiki_root_open_cleanup; }
    };
  }, [categories, allDocuments, selectedDocId, searchParams]);

  // ✅ 로고 클릭: 루트 대표 문서(ID=73) 강제 오픈
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const targ = e.target as HTMLElement | null;
      const a = targ?.closest('a') as HTMLAnchorElement | null;
      if (!a) return;

      const href = a.getAttribute('href') || '';
      const looksLikeLogo =
        href === '/' ||
        href === '/wiki' ||
        a.id === 'wiki-logo' ||
        a.classList.contains('wiki-logo');

      if (!looksLikeLogo) return;

      e.preventDefault();
      e.stopPropagation();
      openRootDocById(ROOT_FEATURED_DOC_ID);
    };

    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [allDocuments]);

  // 로딩/보이기 제어: 딜레이 중에도 로더만 보이도록 hold 사용
  const isLoadingView = loadingDoc || docContent === null;
  const hold = isLoadingView || delaying;

  // ---------- (선택) 콘텐츠 페이드: 딜레이 중엔 숨기고, 준비되면 페이드-인 ----------
  const contentClass = hold ? 'is-hold' : 'is-ready';
  // -----------------------------------------------------------------------

  const interactionReady =
    categories.length > 0 &&
    allDocuments.length > 0 &&
    Object.keys(categoryIdMap).length > 0;

  return (
    <div className="wiki-container">
      <WikiHeader user={user} />
      <div className="wiki-layout">
        <div className="wiki-main-scrollable" id="wiki-scroll-root">
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
              interactionReady={interactionReady}
            />
          </aside>

          <main className={`wiki-content ${contentClass}`}>
            {!hideDocChrome && !hold && (
              <>
                <Breadcrumb
                  selectedDocPath={selectedDocPath}
                  categories={categories}
                  setSelectedDocPath={setSelectedDocPath}
                  setSelectedDocTitle={setSelectedDocTitle}
                  setDocContent={setDocContent}
                />

                {/* 제목 + 링크 버튼 + FAQ 버튼 한 줄 정렬 */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                  }}
                >
                  <div className="wiki-doc-title-wrap">
                    {/* 문서 링크 복사 버튼 */}
                    <button
                      type="button"
                      className={`wiki-doc-link-btn${
                        copiedDocLink ? ' wiki-doc-link-btn--copied' : ''
                      }`}
                      onClick={handleCopyDocLink}
                      title="이 문서 링크 복사"
                      aria-label="이 문서 링크 복사"
                    >
                      {copiedDocLink ? '✔' : '🔗'}
                    </button>

                    {/* 문서 아이콘 + 제목 */}
                    <h2
                      className="wiki-content-title-row wiki-content-title"
                      style={{ margin: 0 }}
                    >
                      <>
                        {currentDoc?.icon
                          ? (currentDoc.icon.startsWith('http')
                              ? (
                                <img
                                  src={toProxyUrl(currentDoc.icon)}   // ✅ CloudFront 리라이트
                                  alt="icon"
                                  className="wiki-doc-icon-img"
                                  loading="lazy"
                                  decoding="async"
                                />
                              )
                              : (
                                <span className="wiki-doc-icon-emoji">
                                  {currentDoc.icon}
                                </span>
                              ))
                          : null}
                        <span className="wiki-title-color">
                          {selectedDocTitle || '렌독 위키'}
                        </span>
                      </>
                    </h2>
                  </div>

                  {/* FAQ일 때만 '질문 추가' 버튼 노출 (권한 필요) */}
                  {isFaq && canWrite && (
                    <FaqAddButton onClick={() => setShowNewFaq(true)} />
                  )}
                </div>
              </>
            )}

            <div
              className="wiki-content-body"
              ref={contentRef}
              style={{
                fontFamily:
                  "'NanumSquareRound', -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
              }}
            >
              {hold ? (
                <BookLoader />
              ) : isFaq ? (
                <FaqList
                  query={faqQuery}
                  tags={faqTags}
                  user={user}
                  refreshSignal={faqRefreshSignal}
                />
              ) : specialMeta?.kind === 'head' ? (
                headLoading ? (
                  <BookLoader />
                ) : headList.length > 0 ? (
                  <HeadGrid
                    heads={headList.slice(headPage * 21, (headPage + 1) * 21)}
                    onClick={setSelectedHead}
                    selectedHeadId={selectedHead?.id || null}
                    headIcon={headVillageIcon}
                  />
                ) : (
                  <div>등록된 머리가 없습니다.</div>
                )
              ) : specialMeta?.kind === 'npc' || specialMeta?.kind === 'quest' ? (
                npcLoading ? (
                  <BookLoader />
                ) : npcList.length > 0 ? (
                  <NpcGrid
                    npcs={npcList.slice(npcPage * 21, (npcPage + 1) * 21)}
                    onClick={setSelectedNpc}
                    selectedNpcId={selectedNpc?.id || null}
                  />
                ) : (
                  <div>등록된 NPC가 없습니다.</div>
                )
              ) : Array.isArray(docContent) && docContent.length > 0 ? (
                <WikiReadRenderer content={docContent} />
              ) : (
                <BookLoader />
              )}

              {specialMeta?.kind === 'head' && headList.length > 21 && !hold && (
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
                    onClick={() =>
                      setHeadPage(p =>
                        Math.min(Math.ceil(headList.length / 21) - 1, p + 1),
                      )
                    }
                    disabled={
                      headPage === Math.ceil(headList.length / 21) - 1
                    }
                    className="wiki-paging-btn"
                  >
                    ▶
                  </button>
                </div>
              )}
              {(specialMeta?.kind === 'npc' || specialMeta?.kind === 'quest') &&
                npcList.length > 21 &&
                !hold && (
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
                      onClick={() =>
                        setNpcPage(p =>
                          Math.min(
                            Math.ceil(npcList.length / 21) - 1,
                            p + 1,
                          ),
                        )
                      }
                      disabled={
                        npcPage === Math.ceil(npcList.length / 21) - 1
                      }
                      className="wiki-paging-btn"
                    >
                      ▶
                    </button>
                  </div>
                )}

              {selectedNpc && !hold && (
                <NpcDetailModal
                  npc={selectedNpc}
                  mode={specialMeta?.kind === 'quest' ? 'quest' : 'npc'}
                  onClose={() => setSelectedNpc(null)}
                />
              )}
              {selectedHead && !hold && (
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
          <TableOfContents
            headings={tableOfContents}
            scrollRootSelector="#wiki-scroll-root"
          />
        </aside>
      </div>

      {showNewFaq && (
        <FaqUpsertModal
          open
          mode="create"
          onClose={() => setShowNewFaq(false)}
          onSaved={() => {
            setShowNewFaq(false);
            setFaqRefreshSignal(v => v + 1);
          }}
        />
      )}

            {/* 콘텐츠 페이드 전환 + 제목/링크 버튼 스타일 */}
      <style jsx global>{`
        .wiki-content.is-ready {
          opacity: 1;
          transition: opacity 0.18s ease;
        }
        .wiki-content.is-hold {
          opacity: 0;
        }

        /* 제목 래퍼 */
        .wiki-doc-title-wrap {
          display: flex;
          align-items: center;
          justify-content: flex-start;
          gap: 8px;
          line-height: 1;
          padding-bottom: 10px; /* 아래 살짝 여백 */
          position: relative;
        }

        /* 제목 텍스트와 아이콘 */
        .wiki-doc-title-wrap .wiki-content-title-row {
          display: flex;
          align-items: center;
          gap: 8px;
          margin: 0;
          padding: 0;
          line-height: 1.2;
        }

        .wiki-doc-title-wrap .wiki-doc-icon-img,
        .wiki-doc-title-wrap .wiki-doc-icon-emoji,
        .wiki-doc-title-wrap .wiki-title-color {
          display: inline-flex;
          align-items: center;
        }

        /* 🔗 링크 버튼 (제목 오른쪽) */
        .wiki-doc-link-btn {
          margin-left: 6px; /* 제목 오른쪽 여백 */
          width: 20px;
          height: 20px;
          border-radius: 50%;
          border: none;
          font-size: 11px;
          display: grid;
          place-items: center;
          cursor: pointer;
          background: transparent;
          color: #9ca3af;
          transition:
            background-color 0.15s ease,
            color 0.15s ease,
            opacity 0.15s ease;
          opacity: 0;
          pointer-events: none;
        }

        /* hover 시만 보이게 */
        .wiki-doc-title-wrap:hover .wiki-doc-link-btn {
          opacity: 1;
          pointer-events: auto;
        }

        .wiki-doc-link-btn:hover {
          background: #eef2ff;
          color: #4f46e5;
        }

        .wiki-doc-link-btn--copied {
          background: #dcfce7;
          color: #16a34a;
          box-shadow: 0 0 0 1px rgba(22, 163, 74, 0.15);
          opacity: 1;
          pointer-events: auto;
        }

        @import url('https://fonts.googleapis.com/css2?family=Jua&display=swap');
        :root {
          --wiki-round-font: 'Jua', 'Pretendard', 'Malgun Gothic', system-ui,
            sans-serif;
        }
      `}</style>
    </div>
  );
}

// -------- 새 질문 모달 (미사용 시 제거 가능) --------
function NewFaqModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!title.trim() || !content.trim()) {
      alert('제목과 내용을 입력해주세요.');
      return;
    }
    setSaving(true);
    try {
      const r = await fetch('/api/faq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          content: content.trim(),
          tags,
        }),
      });
      if (!r.ok) throw 0;
      onSaved();
    } catch {
      alert('저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={backdropStyle} onClick={onClose}>
      <div style={modalStyle} onClick={e => e.stopPropagation()}>
        <div style={modalHeaderStyle}>
          <h3 style={{ margin: 0 }}>질문 추가</h3>
          <button
            onClick={onClose}
            style={closeBtnStyle}
            aria-label="close"
          >
            ✕
          </button>
        </div>
        <div style={{ display: 'grid', gap: 10 }}>
          <div>
            <label style={labelStyle}>제목</label>
            <input
              style={inputStyle}
              value={title}
              onChange={e => setTitle(e.target.value)}
            />
          </div>
          <div>
            <label style={labelStyle}>내용</label>
            <textarea
              style={{ ...inputStyle, height: 140, resize: 'vertical' }}
              value={content}
              onChange={e => setContent(e.target.value)}
            />
          </div>
          <div>
            <label style={labelStyle}>태그(쉼표로 구분, 선택)</label>
            <input
              style={inputStyle}
              value={tags}
              onChange={e => setTags(e.target.value)}
              placeholder="예: 뉴비,설정"
            />
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
            marginTop: 14,
          }}
        >
          <button className="wiki-btn" onClick={onClose}>
            취소
          </button>
          <button
            className="wiki-btn wiki-btn-primary"
            onClick={save}
            disabled={saving}
          >
            {saving ? '저장 중…' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}

const backdropStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.45)',
  zIndex: 1000,
  display: 'grid',
  placeItems: 'center',
  padding: 16,
};
const modalStyle: React.CSSProperties = {
  width: 'min(680px, 100%)',
  background: '#fff',
  borderRadius: 16,
  padding: 16,
  boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
};
const modalHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 12,
};
const closeBtnStyle: React.CSSProperties = {
  border: '1px solid #e5e7eb',
  background: '#fff',
  borderRadius: 8,
  width: 32,
  height: 32,
  cursor: 'pointer',
};
const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 13,
  color: '#555',
  marginBottom: 6,
};
const inputStyle: React.CSSProperties = {
  width: '100%',
  border: '1px solid #e5e7eb',
  borderRadius: 8,
  padding: '8px 10px',
};

// ====== FAQ 상단 액션 버튼 ======
function FaqAddButton({ onClick }: { onClick: () => void }) {
  return (
    <div className="faq-add-group">
      <button
        className="faq-add-seg"
        onClick={onClick}
        title="질문 추가"
        aria-label="질문 추가"
      >
        <svg
          className="faq-add-ic"
          stroke="currentColor"
          strokeWidth="1.5"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M12 6v12M6 12h12"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span className="faq-add-label">질문 추가</span>
      </button>

      <style jsx>{`
        .faq-add-group {
          display: inline-flex;
          overflow: hidden;
          background: #fff;
          border: 1px solid #b7f0d0;
          border-radius: 12px;
          box-shadow: 0 1px 0 rgba(16, 185, 129, 0.06);
        }
        .faq-add-seg {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          font-weight: 600;
          color: #4b5563;
          background: transparent;
          border: none;
          cursor: pointer;
          transition: background 0.2s ease, color 0.2s ease,
            border-color 0.2s ease;
          height: 36px;
        }
        .faq-add-seg:hover {
          background: #ecfdf5;
        }
        .faq-add-ic {
          width: 20px;
          height: 20px;
        }
        .faq-add-label {
          line-height: 1;
        }
      `}</style>
    </div>
  );
}
