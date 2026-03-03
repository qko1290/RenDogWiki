// =============================================
// File: app/components/wiki/WikiPageInner.tsx  (전체 코드)
// (이미지 lazy/async 적용 유지, 로더 포함 / 전환 딜레이 적용
//  + 문서 제목 오른쪽 링크 복사 버튼: 클릭 시 ✔ 애니메이션)
// =============================================
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { Descendant } from 'slate';

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
import FaqList, { FaqDetailModal, fetchFaqDetail, type FaqItem } from './FaqList';
import FaqUpsertModal from '@/components/wiki/FaqUpsertModal';
import { toProxyUrl } from '@lib/cdn';

// ✅ 분리된 코어 유틸/상수
import {
  MODE_PARAM,
  MODE_EVENT,
  MODE_STORAGE,
  MODE_WHITELIST,
  ROOT_FEATURED_DOC_ID,
  NC,
  withTs,
  pathToStr,
  decodeTitleFromUrlParam,
  encodeTitleForUrlParam,
  getInitialMode,
  parseSpecial,
  type SpecialMeta,
} from './wikiCore';

// ✅ 분리된 권한 훅
import { useCanWrite } from './useCanWrite';

// -------------------- types --------------------
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
  path: string | number; // ⭐ 루트는 0
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

export default function WikiPageInner({ user }: Props) {
  const DEFAULT_MODE = 'RPG';

  // ---- mode ----
  const [mode, setMode] = useState<string>(() => getInitialMode() ?? DEFAULT_MODE);

  // ---- data ----
  const [categories, setCategories] = useState<CategoryNode[]>([]);
  const [categoryIdToPathMap, setCategoryIdToPathMap] = useState<Record<number, number[]>>({});
  const [categoryIdMap, setCategoryIdMap] = useState<Record<number, CategoryNode>>({});
  const [allDocuments, setAllDocuments] = useState<Document[]>([]);

  // ---- selection ----
  const [selectedDocId, setSelectedDocId] = useState<number | null>(null);
  const [selectedDocTitle, setSelectedDocTitle] = useState<string | null>(null);
  const [selectedDocPath, setSelectedDocPath] = useState<number[] | null>(null);
  const [selectedCategoryPath, setSelectedCategoryPath] = useState<number[] | null>(null);

  // ---- content ----
  const [docContent, setDocContent] = useState<Descendant[] | null>(null);
  const [tableOfContents, setTableOfContents] = useState<
    { id: string; text: string; icon?: string; level: 1 | 2 | 3 }[]
  >([]);

  // ---- sidebar open/close ----
  const [openPaths, setOpenPaths] = useState<number[][]>([]);
  const [closingMap, setClosingMap] = useState<Record<string, boolean>>({});

  // ---- special meta ----
  const [specialMeta, setSpecialMeta] = useState<SpecialMeta>(null);

  // ---- NPC/Head ----
  const [npcList, setNpcList] = useState<NpcRow[]>([]);
  const [npcLoading, setNpcLoading] = useState(false);
  const [selectedNpc, setSelectedNpc] = useState<NpcRow | null>(null);
  const [selectedNpcMode, setSelectedNpcMode] = useState<'quest' | 'npc' | undefined>(undefined);

  const npcByIdCacheRef = useRef<Map<number, NpcRow>>(new Map());
  useEffect(() => {
    if (!Array.isArray(npcList) || npcList.length === 0) return;
    const m = npcByIdCacheRef.current;
    for (const n of npcList) {
      if (n && Number.isFinite(Number(n.id))) m.set(Number(n.id), n);
    }
  }, [npcList]);

  const [wikiFaqSel, setWikiFaqSel] = useState<FaqItem | null>(null);

  const [npcPage, setNpcPage] = useState(0);
  const [headList, setHeadList] = useState<HeadRow[]>([]);
  const [headLoading, setHeadLoading] = useState(false);
  const [selectedHead, setSelectedHead] = useState<HeadRow | null>(null);
  const [headPage, setHeadPage] = useState(0);

  const NPC_PAGE_SIZE = 21;
  const HEAD_PAGE_SIZE = 24;
  const npcPageCount = Math.max(1, Math.ceil(npcList.length / NPC_PAGE_SIZE));
  const headPageCount = Math.max(1, Math.ceil(headList.length / HEAD_PAGE_SIZE));

  const [headVillageIcon, setHeadVillageIcon] = useState<string | null>(null);

  // ---- FAQ ----
  const [faqQuery, setFaqQuery] = useState('');
  const [faqTags, setFaqTags] = useState<string[]>([]);
  const [faqRefreshSignal, setFaqRefreshSignal] = useState(0);
  const [showNewFaq, setShowNewFaq] = useState(false);

  // ---- UI ----
  const [copiedDocLink, setCopiedDocLink] = useState(false);
  const [hideDocChrome, setHideDocChrome] = useState(false);
  const [loadingDoc, setLoadingDoc] = useState(false);

  // ---------- 전환 지연(딜레이) 상태 ----------
  const [delaying, setDelaying] = useState(false);
  const SWAP_DELAY_MS = 180;
  // -------------------------------------------

  const firstLoadRef = useRef(true);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const canWrite = useCanWrite(user);

  const ignoreNextUrlSyncRef = useRef(false);
  const isPopStateSyncRef = useRef(false);

  const router = useRouter();
  const searchParams = useSearchParams();

  const contentRef = useRef<HTMLDivElement | null>(null);

  // -------------------- utils --------------------
  const isPathOpen = (path: number[]) => openPaths.some((p) => pathToStr(p) === pathToStr(path));
  const isClosing = (path: number[]) => closingMap[pathToStr(path)] || false;

  const finalizeClose = (path: number[]) => {
    const key = pathToStr(path);
    setOpenPaths((prev) => prev.filter((p) => pathToStr(p) !== key));
    setClosingMap((prev) => {
      const n = { ...prev };
      delete n[key];
      return n;
    });
  };

  // ✅ 문서가 열리면 해당 문서의 카테고리 경로 prefix를 전부 펼치기
  const ensureOpenForDocPath = (docPath: number[] | null | undefined) => {
    if (!Array.isArray(docPath)) return;
    if (docPath.length === 0) return;

    const prefixes: number[][] = [];
    for (let i = 0; i < docPath.length; i++) prefixes.push(docPath.slice(0, i + 1));

    setClosingMap((prev) => {
      const next = { ...prev };
      for (const p of prefixes) delete next[pathToStr(p)];
      return next;
    });

    setOpenPaths((prev) => {
      const map = new Set(prev.map(pathToStr));
      const merged = [...prev];
      for (const p of prefixes) {
        const k = pathToStr(p);
        if (!map.has(k)) merged.push(p);
      }
      return merged;
    });
  };

  const syncUrlWithDoc = (
    docTitle: string | null,
    fullPath: number[] | null | undefined,
    options?: { history?: 'push' | 'replace' }
  ) => {
    if (typeof window === 'undefined') return;
    if (!docTitle) return;

    const search = new URLSearchParams(window.location.search);
    const currentPath = search.get('path');
    const currentTitle = search.get('title');

    const lastId = !fullPath || fullPath.length === 0 ? '0' : String(fullPath[fullPath.length - 1]);
    const encodedTitle = encodeTitleForUrlParam(docTitle);

    if (currentPath === lastId && currentTitle === encodedTitle) return;

    search.set('path', lastId);
    search.set('title', encodedTitle);
    search.delete('_t');

    const hash = window.location.hash || '';
    const nextUrl = window.location.pathname + '?' + search.toString() + hash;

    ignoreNextUrlSyncRef.current = true;
    if (options?.history === 'replace') router.replace(nextUrl, { scroll: false });
    else router.push(nextUrl, { scroll: false });
  };

  // 현재 문서 링크 복사 (✔)
  const handleCopyDocLink = async () => {
    if (typeof window === 'undefined') return;
    try {
      const u = new URL(window.location.href);

      // path 보정
      if (!u.searchParams.get('path')) {
        if (Array.isArray(selectedDocPath) && selectedDocPath.length > 0) {
          u.searchParams.set('path', String(selectedDocPath[selectedDocPath.length - 1]));
        } else {
          u.searchParams.set('path', '0');
        }
      }

      // title 보정
      let safeTitle = selectedDocTitle || u.searchParams.get('title') || '';
      try {
        safeTitle = decodeURIComponent(safeTitle);
      } catch {}
      safeTitle = decodeTitleFromUrlParam(safeTitle);
      safeTitle = encodeTitleForUrlParam(safeTitle);
      if (safeTitle) u.searchParams.set('title', safeTitle);

      // mode 보정
      const safeMode = u.searchParams.get(MODE_PARAM) || mode || '';
      if (safeMode) u.searchParams.set(MODE_PARAM, safeMode);

      const qs = u.searchParams.toString();
      const url = `${u.origin}${u.pathname}${qs ? `?${qs}` : ''}${u.hash || ''}`;

      await navigator.clipboard?.writeText(url);
      setCopiedDocLink(true);
      setTimeout(() => setCopiedDocLink(false), 1500);
    } catch (e) {
      console.error('Failed to copy doc link', e);
    }
  };

  // mode event
  useEffect(() => {
    const onMode = (e: Event) => {
      const next = (e as CustomEvent).detail?.mode ?? null;
      const v = next && MODE_WHITELIST.has(next) ? next : DEFAULT_MODE;
      setMode(v);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(MODE_STORAGE, v);
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener(MODE_EVENT, onMode as EventListener);
      return () => window.removeEventListener(MODE_EVENT, onMode as EventListener);
    }
  }, []);

  const docReqIdRef = useRef(0);

  // ----------------------------------------
  // 루트 대표 문서 찾기 & 열기
  // ----------------------------------------
  const findRootDoc = () => {
    const roots = allDocuments.filter(
      (d) => (Array.isArray(d.fullPath) && d.fullPath.length === 0) || Number(d.path) === 0
    );
    return roots.find((d) => d.is_featured) || roots[0];
  };

  const openRootDocById = async (docId: number) => {
    setHideDocChrome(true);
    setSelectedCategoryPath(null);
    setSelectedDocPath([]);
    setSelectedDocId(docId);

    const inList = allDocuments.find((d) => d.id === docId);
    setSelectedDocTitle(inList?.title ?? null);

    await fetchDocById(docId, { hideChrome: true });
  };

  // ----------------------------------------
  // bootstrap: categories + documents
  // ----------------------------------------
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
        const mapped: Document[] = (docsRaw || []).map((row: any) => {
          const pNum = /^\d+$/.test(String(row.path)) ? Number(row.path) : NaN;
          const fullPath =
            Number(row.path) === 0 ? [] : Number.isFinite(pNum) ? idToPath[pNum] || [pNum] : [];
          return { ...row, fullPath, special: row.special ?? null };
        });

        if (cancelled || !mountedRef.current) return;
        setAllDocuments(mapped);

        // 최초 뷰를 바로 렌더(대표 문서)
        if (featured?.id && featured?.content) {
          setHideDocChrome(true);
          setSelectedDocId(featured.id);
          setSelectedDocTitle(featured.title ?? null);
          setSelectedDocPath([]);
          setSelectedCategoryPath(null);

          const content: Descendant[] =
            typeof featured.content === 'string' ? JSON.parse(featured.content) : featured.content;

          setDocContent(content);
          setTableOfContents(extractHeadings(content));
        }
      } catch (e) {
        console.error('[bootstrap init] failed', e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [mode]);

  // ----------------------------------------
  // query entry: /wiki?path=...&title=...
  // ----------------------------------------
  useEffect(() => {
    if (ignoreNextUrlSyncRef.current) {
      ignoreNextUrlSyncRef.current = false;
      return;
    }

    isPopStateSyncRef.current = true;

    const pathParam = searchParams.get('path');
    const titleParamRaw = searchParams.get('title');
    const titleParam = titleParamRaw ? decodeTitleFromUrlParam(titleParamRaw) : null;

    if (!pathParam || !titleParam) return;

    if (pathParam === '0') {
      if (allDocuments.length === 0) return;

      const match = allDocuments.find(
        (d) =>
          (((Array.isArray(d.fullPath) && d.fullPath.length === 0) || Number(d.path) === 0) &&
            d.title === titleParam)
      );

      if (match?.id != null) {
        fetchDoc([], titleParam, match.id, { clearCategoryPath: true, forceRoot: true });
        return;
      }

      fetchDoc([], titleParam, undefined, { clearCategoryPath: true, forceRoot: true });
      return;
    }

    const pathId = Number(pathParam);
    const fullPath = categoryIdToPathMap[pathId];
    if (fullPath) {
      fetchDoc(fullPath, titleParam, undefined, { clearCategoryPath: true });
    }
  }, [searchParams, allDocuments, categoryIdToPathMap]);

  // ----------------------------------------
  // sidebar open/close
  // ----------------------------------------
  // ✅ BUGFIX: 재귀에서 child 노드를 넘겨야 하는데 node를 넘기던 문제 수정
  const closeTreeWithChildren = async (node: CategoryNode, path: number[]): Promise<void> => {
    const key = pathToStr(path);
    setClosingMap((prev) => ({ ...prev, [key]: true }));

    if (node.children?.length) {
      node.children.forEach((child) => {
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
      setClosingMap((prev) => {
        const n = { ...prev };
        delete n[key];
        return n;
      });

      setOpenPaths((prev) => (prev.some((p) => pathToStr(p) === key) ? prev : [...prev, path]));
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
        setHideDocChrome(false);

        fetchDoc(path, doc.title, doc.id);

        setOpenPaths((prev) =>
          prev.some((p) => JSON.stringify(p) === JSON.stringify(path)) ? prev : [...prev, path]
        );
      } catch {
        setSelectedDocId(null);
        setSelectedDocPath(null);
        setSelectedDocTitle(null);
        setDocContent([]);
        setSelectedCategoryPath(path);
      }
    }
  };

  function BookLoader() {
    return (
      <div className="wiki-book-loader" aria-label="로딩 중">
        <div className="wiki-book-loader-inner">
          <div className="wiki-book" />
          <div className="wiki-book-shadow" />
        </div>
      </div>
    );
  }

  // ----------------------------------------
  // document fetch (path/title)
  // ----------------------------------------
  function fetchDoc(
    categoryPath: number[],
    docTitle: string,
    docId?: number,
    options?: { clearCategoryPath?: boolean; forceRoot?: boolean }
  ) {
    const isRoot = options?.forceRoot || categoryPath.length === 0;

    if (options?.clearCategoryPath) setSelectedCategoryPath(null);

    setSelectedDocTitle(docTitle);
    setHideDocChrome(false);

    // 루트 + id 미지정 → 목록에서 id로 로딩
    if (isRoot && docId == null) {
      const match = allDocuments.find(
        (d) =>
          (((Array.isArray(d.fullPath) && d.fullPath.length === 0) || Number(d.path) === 0) &&
            d.title === docTitle)
      );
      if (match?.id != null) {
        setSelectedDocId(match.id);
        setSelectedDocPath([]);
        setLoadingDoc(true);
        void fetchDocById(match.id, { hideChrome: true });
        return;
      }
    }

    if (docId != null) {
      setSelectedDocId(docId);
      setSelectedDocPath(isRoot ? [] : [...categoryPath]);
    } else {
      const doc = allDocuments.find(
        (d) =>
          d.title === docTitle &&
          ((isRoot &&
            ((Array.isArray(d.fullPath) && d.fullPath.length === 0) || Number(d.path) === 0)) ||
            JSON.stringify(d.fullPath) === JSON.stringify(categoryPath))
      );
      if (doc) {
        setSelectedDocId(doc.id);
        setSelectedDocPath(isRoot ? [] : [...categoryPath]);
      }
    }

    const reqId = ++docReqIdRef.current;
    setLoadingDoc(true);

    const pathParam = isRoot ? '0' : String(categoryPath.at(-1));
    fetch(withTs(`/api/documents?path=${pathParam}&title=${encodeURIComponent(docTitle)}`), NC)
      .then((res) => {
        if (!res.ok) throw new Error('문서를 찾을 수 없습니다.');
        return res.json();
      })
      .then((data) => {
        if (!mountedRef.current || reqId !== docReqIdRef.current) return;

        const content: Descendant[] =
          typeof data.content === 'string' ? JSON.parse(data.content) : data.content;

        setDocContent(content);
        setTableOfContents(extractHeadings(content));

        const docInList = allDocuments.find((d) => d.id === data.id);
        const special = data.special ?? docInList?.special ?? null;

        const meta = parseSpecial(special);
        setSpecialMeta(meta);

        if (meta?.kind === 'faq') {
          setFaqQuery(meta.q ?? '');
          setFaqTags(meta.tags ?? []);
        } else {
          setFaqQuery('');
          setFaqTags([]);
        }

        let nextPath: number[] = [];
        if (Array.isArray(data.fullPath)) nextPath = [...data.fullPath];
        else if (isRoot) nextPath = [];
        else nextPath = [...categoryPath];

        setSelectedDocPath(nextPath);
        setHideDocChrome(Number(data?.id) === ROOT_FEATURED_DOC_ID);
        ensureOpenForDocPath(nextPath);

        syncUrlWithDoc(data.title ?? docTitle, nextPath, {
          history: isPopStateSyncRef.current ? 'replace' : 'push',
        });
        isPopStateSyncRef.current = false;

        setLoadingDoc(false);
      })
      .catch(() => {
        if (!mountedRef.current || reqId !== docReqIdRef.current) return;
        setDocContent(null);
        setSpecialMeta(null);
        setFaqQuery('');
        setFaqTags([]);
        setLoadingDoc(false);
      });
  }

  // ----------------------------------------
  // document fetch (id)
  // ----------------------------------------
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

      const docInList = allDocuments.find((d) => d.id === data.id);
      const special = data.special ?? docInList?.special ?? null;

      const meta = parseSpecial(special);
      setSpecialMeta(meta);

      if (meta?.kind === 'faq') {
        setFaqQuery(meta.q ?? '');
        setFaqTags(meta.tags ?? []);
      } else {
        setFaqQuery('');
        setFaqTags([]);
      }

      setSelectedDocTitle(data.title ?? null);

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

      syncUrlWithDoc(data.title ?? null, nextPath, { history: 'replace' });
      isPopStateSyncRef.current = false;

      setHideDocChrome(!!opts?.hideChrome || Number(data?.id) === ROOT_FEATURED_DOC_ID);
      setLoadingDoc(false);
    } catch {
      if (!mountedRef.current || reqId !== docReqIdRef.current) return;
      setDocContent(null);
      setSpecialMeta(null);
      setFaqQuery('');
      setFaqTags([]);
      setLoadingDoc(false);
    }
  }

  // ----------------------------------------
  // 본문 내부 링크 라우팅 (/wiki?path=&title=) 가로채기
  // ----------------------------------------
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;

    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const aTag = target?.closest('a') as HTMLAnchorElement | null;
      if (!aTag) return;

      const rawHref = aTag.getAttribute('href');
      if (!rawHref) return;

      let url: URL;
      try {
        url = new URL(rawHref, window.location.origin);
      } catch {
        return;
      }

      const isSameOrigin = url.origin === window.location.origin;
      const isWikiDocLink = isSameOrigin && url.pathname === '/wiki';
      if (!isWikiDocLink) return;

      const path = url.searchParams.get('path');
      const titleRaw = url.searchParams.get('title');
      const title = titleRaw ? decodeTitleFromUrlParam(titleRaw) : null;
      if (!path || !title) return;

      e.preventDefault();
      e.stopPropagation();

      setLoadingDoc(true);

      if (url.hash) {
        const safeTitle = encodeTitleForUrlParam(title);
        const safeMode = url.searchParams.get(MODE_PARAM) || mode || '';
        const nextQs = new URLSearchParams();
        nextQs.set('path', path);
        nextQs.set('title', safeTitle);
        if (safeMode) nextQs.set(MODE_PARAM, safeMode);

        window.history.replaceState(null, '', `/wiki?${nextQs.toString()}${url.hash}`);
      }

      if (path === '0') {
        fetchDoc([], title, undefined, { clearCategoryPath: true, forceRoot: true });
        return;
      }

      const pathId = Number(path);
      if (!Number.isFinite(pathId)) {
        setLoadingDoc(false);
        return;
      }

      const fullPath = categoryIdToPathMap[pathId] ?? [pathId];

      ensureOpenForDocPath(fullPath);
      setSelectedCategoryPath(fullPath);

      fetchDoc(fullPath, title, undefined, { clearCategoryPath: true });
    };

    el.addEventListener('click', handler);
    return () => el.removeEventListener('click', handler);
  }, [docContent, categoryIdToPathMap, mode]);

  // ---------- 전환 딜레이(잔상 방지) ----------
  useEffect(() => {
    setDelaying(true);
    const t = setTimeout(() => setDelaying(false), SWAP_DELAY_MS);
    return () => clearTimeout(t);
  }, [selectedDocId, (specialMeta as any)?.kind]);
  // ------------------------------------------

  // ----------------------------------------
  // Special 데이터 로딩(FAQ 제외)
  // ----------------------------------------
  useEffect(() => {
    if (!selectedDocId || !selectedDocTitle) {
      setNpcList([]);
      setNpcLoading(false);
      setNpcPage(0);

      setHeadList([]);
      setHeadLoading(false);
      setHeadPage(0);

      setHeadVillageIcon(null);
      return;
    }

    const meta = specialMeta;
    if (!meta || meta.kind === 'faq') {
      setNpcList([]);
      setNpcLoading(false);
      setNpcPage(0);

      setHeadList([]);
      setHeadLoading(false);
      setHeadPage(0);

      setHeadVillageIcon(null);
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
        setHeadLoading(true);
        setHeadList([]);
        setHeadPage(0);

        const v = await findVillage([meta.village, selectedDocTitle].filter(Boolean) as string[]);
        if (!v) {
          if (!cancelled) {
            setHeadLoading(false);
            setHeadVillageIcon(null);
          }
          return;
        }

        if (!cancelled) setHeadVillageIcon(v.head_icon ?? null);

        const res = await fetch(withTs(`/api/head?village_id=${v.id}`), NC);
        const heads = res.ok ? await res.json() : [];
        if (cancelled) return;

        setHeadList(Array.isArray(heads) ? (heads as HeadRow[]) : []);
        setHeadLoading(false);
        return;
      }

      // quest / npc
      setHeadVillageIcon(null);

      setNpcLoading(true);
      setNpcList([]);
      setNpcPage(0);

      const v = await findVillage([meta.village, selectedDocTitle].filter(Boolean) as string[]);
      if (!v) {
        if (!cancelled) setNpcLoading(false);
        return;
      }

      const npcType = meta.kind === 'quest' ? 'quest' : 'normal';
      const res = await fetch(
        withTs(`/api/npcs?village_id=${v.id}&npc_type=${npcType}&nocache=1`),
        NC
      );
      const npcs = res.ok ? await res.json() : [];
      if (cancelled) return;

      setNpcList(Array.isArray(npcs) ? (npcs as NpcRow[]) : []);
      setNpcLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedDocId, selectedDocTitle, specialMeta]);

  // ----------------------------------------
  // wiki-ref click helper
  // ----------------------------------------
  type WikiRefKind = 'quest' | 'npc' | 'qna';

  const extractVillageArray = (data: any): any[] => {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.rows)) return data.rows;
    if (Array.isArray(data?.villages)) return data.villages;
    return [];
  };

  const fetchAllVillages = async (): Promise<any[]> => {
    const candidates = ['/api/villages', '/api/villages?all=1', '/api/villages?mode=all', '/api/villages/list'];
    for (const url of candidates) {
      try {
        const r = await fetch(withTs(url), NC);
        if (!r.ok) continue;
        const data = await r.json();
        const arr = extractVillageArray(data);
        if (arr.length > 0) return arr;
      } catch {
        // next
      }
    }
    return [];
  };

  const fetchNpcById = async (id: number, kind: 'quest' | 'npc'): Promise<NpcRow | null> => {
    if (!Number.isFinite(id) || id <= 0) return null;

    const cached = npcByIdCacheRef.current.get(id);
    if (cached) return cached;

    const localHit = npcList.find((n) => Number(n.id) === id);
    if (localHit) {
      npcByIdCacheRef.current.set(id, localHit);
      return localHit;
    }

    const villages = await fetchAllVillages();
    if (!villages.length) return null;

    const npc_type = kind === 'quest' ? 'quest' : 'normal';

    for (const v of villages) {
      const vid = Number(v?.id);
      if (!Number.isFinite(vid) || vid <= 0) continue;

      try {
        const res = await fetch(withTs(`/api/npcs?village_id=${vid}&npc_type=${npc_type}`), NC);
        if (!res.ok) continue;

        const arr = await res.json();
        if (!Array.isArray(arr)) continue;

        for (const row of arr) {
          if (row && Number.isFinite(Number(row.id))) {
            npcByIdCacheRef.current.set(Number(row.id), row);
          }
        }

        const hit = npcByIdCacheRef.current.get(id);
        if (hit) return hit;
      } catch {
        // next
      }
    }

    return null;
  };

  const handleWikiRefClick = async (kind: WikiRefKind, id: number) => {
    if (!id || id <= 0) return;
    if (hold) return;

    if (kind === 'qna') {
      const fresh = await fetchFaqDetail(id);
      if (fresh) setWikiFaqSel(fresh);
      return;
    }

    if (kind === 'quest' || kind === 'npc') {
      setSelectedNpcMode(kind);
      const npc = await fetchNpcById(id, kind);
      if (npc) setSelectedNpc(npc);
      return;
    }
  };

  // ----------------------------------------
  // init: open root featured doc if no deep link
  // ----------------------------------------
  useEffect(() => {
    if (!firstLoadRef.current) return;
    if (!mountedRef.current) return;

    const ready =
      categories && categories.length > 0 && allDocuments && allDocuments.length > 0 && !selectedDocId;
    if (!ready) return;

    const hasUrl = !!(searchParams.get('path') && searchParams.get('title'));
    if (hasUrl) return;

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
      if (typeof c === 'function') {
        c();
        delete (window as any).__wiki_root_open_cleanup;
      }
    };
  }, [categories, allDocuments, selectedDocId, searchParams]);

  // 로고 클릭: 루트 대표 문서 강제 오픈
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const targ = e.target as HTMLElement | null;
      const a = targ?.closest('a') as HTMLAnchorElement | null;
      if (!a) return;

      const href = a.getAttribute('href') || '';
      const looksLikeLogo =
        href === '/' || href === '/wiki' || a.id === 'wiki-logo' || a.classList.contains('wiki-logo');

      if (!looksLikeLogo) return;

      e.preventDefault();
      e.stopPropagation();
      openRootDocById(ROOT_FEATURED_DOC_ID);
    };

    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [allDocuments]);

  // ----------------------------------------
  // view flags
  // ----------------------------------------
  const isLoadingView = loadingDoc || docContent === null;
  const hold = isLoadingView || delaying;
  const contentClass = hold ? 'is-hold' : 'is-ready';

  const interactionReady =
    categories.length > 0 && allDocuments.length > 0 && Object.keys(categoryIdMap).length > 0;

  useEffect(() => {
    if (!interactionReady) return;
    ensureOpenForDocPath(selectedDocPath);
  }, [interactionReady, selectedDocPath]);

  const currentDoc = useMemo(
    () => allDocuments.find((d) => d.id === selectedDocId),
    [allDocuments, selectedDocId]
  );

  const isFaq = specialMeta?.kind === 'faq';

  // ----------------------------------------
  // render
  // ----------------------------------------
  return (
    <div className="wiki-container">
      <WikiHeader user={user} />

      {/* 기존 wiki.css는 header fixed(64px) 기준으로 wiki-layout margin-top을 사용 */}
      <div className="wiki-layout">
        {/* ✅ wiki.css가 기대하는 main 래퍼 */}
        <div className="wiki-main">
          {/* Sidebar */}
          <aside className="wiki-sidebar">
            <div className="wiki-sidebar-inner">
              <CategoryTree
                categories={categories}
                categoryIdMap={categoryIdMap}
                categoryIdToPathMap={categoryIdToPathMap}
                selectedDocId={selectedDocId}
                selectedDocPath={selectedDocPath}
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
                mode={mode}
              />
            </div>
          </aside>

          {/* Content + TOC는 스크롤 컨테이너로 묶는게 wiki.css 의도 */}
          <div className="wiki-main-scrollable">
            <main className="wiki-content">
              {!hideDocChrome && (
                <>
                  {!hold && (
                    <Breadcrumb
                      selectedDocPath={selectedDocPath}
                      categories={categories}
                      setSelectedDocPath={setSelectedDocPath}
                      setSelectedDocTitle={setSelectedDocTitle}
                      setDocContent={setDocContent}
                    />
                  )}

                  {/* ⚠️ wiki.css에는 wiki-title-row가 없고 wiki-content-title-row가 있음 */}
                  <div className="wiki-content-title-row">
                    <h2 className="wiki-content-title wiki-title-color">
                      {currentDoc?.icon ? (
                        currentDoc.icon.startsWith('http') ? (
                          <img
                            src={toProxyUrl(currentDoc.icon)}
                            alt=""
                            width={22}
                            height={22}
                            loading="lazy"
                            decoding="async"
                            draggable={false}
                            style={{ borderRadius: 6, objectFit: 'cover', marginRight: 8 }}
                          />
                        ) : (
                          <span style={{ marginRight: 8 }}>{currentDoc.icon}</span>
                        )
                      ) : null}
                      {selectedDocTitle || '렌독 위키'}
                    </h2>

                    <div className="wiki-title-actions">
                      <button className="wiki-copylink-btn" onClick={handleCopyDocLink} type="button">
                        {copiedDocLink ? '✔' : '링크'}
                      </button>

                      {isFaq && canWrite && <FaqAddButton onClick={() => setShowNewFaq(true)} />}
                    </div>
                  </div>
                </>
              )}

              {/* ✅ contentRef는 그대로 */}
              <div className={`wiki-content-inner ${contentClass}`} ref={contentRef}>
                {hold ? (
                  <BookLoader />
                ) : isFaq ? (
                  <FaqList query={faqQuery} tags={faqTags} user={user} refreshSignal={faqRefreshSignal} />
                ) : specialMeta?.kind === 'head' ? (
                  <>
                    {headLoading ? (
                      <BookLoader />
                    ) : headList.length > 0 ? (
                      <HeadGrid heads={headList} headIcon={headVillageIcon} />
                    ) : (
                      <div className="wiki-empty">등록된 머리가 없습니다.</div>
                    )}
                  </>
                ) : specialMeta?.kind === 'npc' || specialMeta?.kind === 'quest' ? (
                  <>
                    {npcLoading ? (
                      <BookLoader />
                    ) : npcList.length > 0 ? (
                      <NpcGrid
                        npcs={npcList}
                        page={npcPage}
                        onPageChange={setNpcPage}
                        selectedNpcId={selectedNpc?.id ?? null}
                        onClick={(npc) => setSelectedNpc(npc)}
                      />
                    ) : (
                      <div className="wiki-empty">등록된 NPC가 없습니다.</div>
                    )}
                  </>
                ) : Array.isArray(docContent) && docContent.length > 0 ? (
                  <WikiReadRenderer content={docContent} onWikiRefClick={handleWikiRefClick as any} />
                ) : (
                  <div className="wiki-empty">문서 내용이 없습니다.</div>
                )}
              </div>
            </main>

            {/* TOC */}
            <aside className="wiki-toc">
              {!hold && (
                <TableOfContents
                  headings={tableOfContents}
                  docTitle={selectedDocTitle ?? undefined}
                  docIcon={currentDoc?.icon ?? undefined}
                />
              )}
            </aside>
          </div>
        </div>
      </div>

      {/* Modals */}
      {selectedNpc && !hold && (
        <NpcDetailModal
          npc={selectedNpc}
          mode={selectedNpcMode}
          onClose={() => {
            setSelectedNpc(null);
            setSelectedNpcMode(undefined);
          }}
        />
      )}

      {wikiFaqSel && !hold && <FaqDetailModal sel={wikiFaqSel} onClose={() => setWikiFaqSel(null)} />}

      {selectedHead && !hold && <HeadDetailModal head={selectedHead} onClose={() => setSelectedHead(null)} />}

      {showNewFaq && (
        <NewFaqModal
          onClose={() => setShowNewFaq(false)}
          onSaved={() => {
            setShowNewFaq(false);
            setFaqRefreshSignal((v) => v + 1);
          }}
        />
      )}
    </div>
  );
}

// -------- 새 질문 모달 --------
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
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <div style={modalHeaderStyle}>
          <h3 style={{ margin: 0 }}>질문 추가</h3>
          <button style={closeBtnStyle} onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </div>

        <div style={{ display: 'grid', gap: 10 }}>
          <div>
            <label style={labelStyle}>제목</label>
            <input style={inputStyle} value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>내용</label>
            <textarea
              style={{ ...inputStyle, minHeight: 160, resize: 'vertical' }}
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </div>
          <div>
            <label style={labelStyle}>태그(쉼표로 구분, 선택)</label>
            <input
              style={inputStyle}
              value={tags}
              onChange={(e) => setTags(e.target.value)}
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
          <button className="wiki-btn wiki-btn-primary" onClick={save} disabled={saving}>
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
        type="button"
      >
        <svg
          className="faq-add-ic"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M12 5v14M5 12h14" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="faq-add-label">질문 추가</span>
      </button>

      <style jsx>{`
        .faq-add-group {
          display: inline-flex;
          align-items: stretch;
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.02);
          flex: 0 0 auto;
        }
        .faq-add-seg {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 14px;
          border: 0;
          background: transparent;
          cursor: pointer;
          font-weight: 600;
          font-size: 0.95rem;
          color: #4b5563;
          line-height: 1;
          white-space: nowrap;
          height: 38px;
          transition: background 0.15s, color 0.15s;
        }
        .faq-add-seg:hover {
          background: #f3f4f6;
        }
        .faq-add-seg:focus-visible {
          outline: none;
          box-shadow: inset 0 0 0 2px rgba(56, 179, 93, 0.18);
        }
        .faq-add-ic {
          width: 20px;
          height: 20px;
          flex: 0 0 20px;
        }
        .faq-add-label {
          line-height: 1;
        }
      `}</style>
    </div>
  );
}