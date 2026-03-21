// =============================================
// File: app/wiki/WikiPageInner.tsx
// (이미지 lazy/async 적용 유지, 로더 포함 / 전환 딜레이 적용
//  + 문서 제목 오른쪽 링크 복사 버튼: 클릭 시 ✔ 애니메이션)
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
import FaqList, { FaqDetailModal, fetchFaqDetail, type FaqItem } from './FaqList';
import FaqUpsertModal from '@/components/wiki/FaqUpsertModal';
import { toProxyUrl } from '@lib/cdn';
import DocQuickBadges from './DocQuickBadges';
import { Descendant } from 'slate';
import { useRouter, useSearchParams } from 'next/navigation';
import MobileWikiNav from './MobileWikiNav';

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
  line?: string;
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
const MODE_WHITELIST = new Set(['RPG', '렌독런', '마인팜', '부엉이타운']);

// ✅ 루트 대표 문서 ID 하드코딩
const ROOT_FEATURED_DOC_ID = 73;

function pathToStr(path: number[]) {
  return path.join('/');
}

function decodeTitleFromUrlParam(v: string | null | undefined) {
  return String(v ?? '').replace(/_/g, ' ');
}

function encodeTitleForUrlParam(v: string | null | undefined) {
  return String(v ?? '').trim().replace(/\s+/g, '_');
}

function getInitialMode(): string | null {
  if (typeof window === 'undefined') return null;
  const fromUrl = new URLSearchParams(window.location.search).get(MODE_PARAM);
  const fromLs = window.localStorage.getItem(MODE_STORAGE);
  const v = fromUrl ?? fromLs ?? null;
  return v && MODE_WHITELIST.has(v) ? v : null;
}

function ymdKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${dd}`;
}

function sendDocView(documentId: number) {
  const payload = JSON.stringify({ documentId });

  if (typeof navigator !== 'undefined' && 'sendBeacon' in navigator) {
    const blob = new Blob([payload], { type: 'application/json' });
    (navigator as any).sendBeacon('/api/view', blob);
    return;
  }

  fetch('/api/view', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: payload,
    cache: 'no-store',
  }).catch(() => {});
}

// no-cache 유틸
// - 이전에는 _ts를 붙여 강제로 매 요청을 새로운 URL로 만들었음
// - 이제는 URL은 그대로 두고 fetch 옵션만 no-store로 유지
// - 서버 로컬 TTL 캐시 / inflight dedupe가 동작할 수 있게 query string 노이즈를 제거
const withTs = (url: string) => url;
const NC: RequestInit = { cache: 'no-store' };

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shouldRetryDocStatus(status: number) {
  return status === 503 || status === 504 || status === 429;
}

async function fetchDocJsonWithRetry(
  url: string,
  signal: AbortSignal,
) {
  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(withTs(url), {
        ...NC,
        signal,
      });

      // 진짜 not found
      if (res.status === 204) {
        return null;
      }

      if (!res.ok) {
        const err = new Error(`doc-fetch-failed:${res.status}`);
        (err as any).status = res.status;
        throw err;
      }

      const text = await res.text();
      return text ? JSON.parse(text) : null;
    } catch (e: any) {
      if (e?.name === 'AbortError') {
        throw e;
      }

      const status = Number(e?.status ?? 0);
      const retryable = attempt === 0 && (status === 0 || shouldRetryDocStatus(status));

      if (!retryable) {
        lastError = e;
        break;
      }

      await sleep(150);
    }
  }

  throw lastError ?? new Error('doc-fetch-failed');
}

// ---- 권한 체크(Writer+)
function useCanWrite(user: Props['user']) {
  const [can, setCan] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (!user) {
      setCan(false);
      return;
    }

    (async () => {
      try {
        const res = await fetch('/api/auth/me', {
          cache: 'no-store',
          credentials: 'include',
        });

        if (!res.ok) {
          if (!cancelled) setCan(false);
          return;
        }

        const data = await res.json();
        const role = String(data?.role ?? '').toLowerCase();
        const perms = Array.isArray(data?.permissions) ? data.permissions : [];

        const allowed =
          role === 'writer' ||
          role === 'admin' ||
          perms.includes('writer') ||
          perms.includes('admin');

        if (!cancelled) setCan(allowed);
      } catch {
        if (!cancelled) setCan(false);
      }
    })();

    return () => {
      cancelled = true;
    };
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
  if (
    lower.startsWith('faq') ||
    lower.startsWith('질문') ||
    lower.startsWith('자주')
  ) {
    const after = s.split('/').slice(1).join('/') || '';
    const meta: { q?: string; tags?: string[] } = {};
    if (after.startsWith('tag:'))
      meta.tags = after
        .slice(4)
        .split(',')
        .map(t => t.trim())
        .filter(Boolean);
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
  const DEFAULT_MODE = 'RPG';
  const [mode, setMode] = useState<string>(getInitialMode() ?? DEFAULT_MODE);

  const [categories, setCategories] = useState<CategoryNode[]>([]);
  const [categoryIdToPathMap, setCategoryIdToPathMap] = useState<
    Record<number, number[]>
  >({});
  const [categoryIdMap, setCategoryIdMap] = useState<
    Record<number, CategoryNode>
  >({});
  const [allDocuments, setAllDocuments] = useState<Document[]>([]);

  const [selectedDocId, setSelectedDocId] = useState<number | null>(null);
  const [selectedDocTitle, setSelectedDocTitle] = useState<string | null>(null);
  const [selectedDocPath, setSelectedDocPath] = useState<number[] | null>(null);
  const [selectedCategoryPath, setSelectedCategoryPath] = useState<
    number[] | null
  >(null);

  const [docContent, setDocContent] = useState<Descendant[] | null>(null);
  const [tableOfContents, setTableOfContents] = useState<
    { id: string; text: string; icon?: string; level: 1 | 2 | 3 }[]
  >([]);

  const [openPaths, setOpenPaths] = useState<number[][]>([]);
  const [closingMap, setClosingMap] = useState<Record<string, boolean>>({});

  const collapseAllCategories = () => {
    setClosingMap({});
    setOpenPaths([]);
  };

  const [specialMeta, setSpecialMeta] = useState<SpecialMeta>(null);
  const [npcList, setNpcList] = useState<NpcRow[]>([]);
  const [npcLoading, setNpcLoading] = useState(false);
  const [selectedNpc, setSelectedNpc] = useState<NpcRow | null>(null);

  const [mobileCategoryOpen, setMobileCategoryOpen] = useState(false);

  // ✅ 문서 wiki-ref 클릭으로 열릴 때 quest/npc 모드 기억
  const [selectedNpcMode, setSelectedNpcMode] = useState<'quest' | 'npc' | null>(null);

  // ✅ NPC 캐시 (문서 이동해도 재사용)
  const npcByIdCacheRef = useRef<Map<number, NpcRow>>(new Map());

  // npcList가 갱신될 때 캐시에 쌓기
  useEffect(() => {
    if (!Array.isArray(npcList) || npcList.length === 0) return;
    const m = npcByIdCacheRef.current;
    for (const n of npcList) {
      if (n && Number.isFinite(Number(n.id))) m.set(Number(n.id), n);
    }
  }, [npcList]);

  // 문서 열리면 모바일 카테고리는 자동 닫기
  useEffect(() => {
    if (selectedDocId == null) return;

    setMobileCategoryOpen(false);

    document.body.style.overflow = '';
    document.body.style.touchAction = '';
  }, [selectedDocId]);

  // ESC로 닫기
  useEffect(() => {
    const body = document.body;

    if (!mobileCategoryOpen) {
      body.style.overflow = '';
      body.style.touchAction = '';
      return;
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileCategoryOpen(false);
    };

    window.addEventListener('keydown', onKeyDown);

    // ✅ 드로어 열렸을 때만 배경 스크롤 잠금
    body.style.overflow = 'hidden';
    body.style.touchAction = 'none';

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      body.style.overflow = '';
      body.style.touchAction = '';
    };
  }, [mobileCategoryOpen]);

  async function openNpcById(kind: 'quest' | 'npc', id: number) {
    const cache = npcByIdCacheRef.current;
    const cachedNpc = cache.get(id);

    // quest/npc 모두 대사가 필요하니 line 기준으로 보강 (원하면 quest는 quest 필드까지 체크해도 됨)
    const needFetch = !cachedNpc || !String(cachedNpc.line ?? '').trim();

    if (!needFetch) {
      setSelectedNpcMode(kind);
      setSelectedNpc(cachedNpc ? { ...cachedNpc, line: cachedNpc.line ?? undefined } : cachedNpc);
      return;
    }

    const r = await fetch(`/api/npcs/${id}`, { cache: 'no-store' });
    if (!r.ok) {
      // fallback: 캐시가 있으면 그거라도 띄우기
      if (cachedNpc) {
        setSelectedNpcMode(kind);
        setSelectedNpc(cachedNpc);
      }
      return;
    }

    const fresh = await r.json();
    const normalizedFresh = { ...fresh, line: fresh.line ?? undefined };

    cache.set(id, normalizedFresh);

    setSelectedNpcMode(kind);
    setSelectedNpc(normalizedFresh);
  }

  // ✅ 문서 본문(wiki-ref) 클릭으로 열리는 QnA 상세
  const [wikiFaqSel, setWikiFaqSel] = useState<FaqItem | null>(null);

  const [npcPage, setNpcPage] = useState(0);

  const [headList, setHeadList] = useState<HeadRow[]>([]);
  const [headLoading, setHeadLoading] = useState(false);
  const [selectedHead, setSelectedHead] = useState<HeadRow | null>(null);
  const [headPage, setHeadPage] = useState(0);

  const DESKTOP_NPC_PAGE_SIZE = 21;
  const MOBILE_NPC_PAGE_SIZE = 9;
  const DESKTOP_HEAD_PAGE_SIZE = 24;
  const MOBILE_HEAD_PAGE_SIZE = 9;

  const [isMobileViewport, setIsMobileViewport] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mq = window.matchMedia('(max-width: 768px)');

    const apply = () => {
      setIsMobileViewport(mq.matches);
    };

    apply();

    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', apply);
      return () => mq.removeEventListener('change', apply);
    }

    mq.addListener(apply);
    return () => mq.removeListener(apply);
  }, []);

  const NPC_PAGE_SIZE = isMobileViewport
    ? MOBILE_NPC_PAGE_SIZE
    : DESKTOP_NPC_PAGE_SIZE;

  const HEAD_PAGE_SIZE = isMobileViewport
    ? MOBILE_HEAD_PAGE_SIZE
    : DESKTOP_HEAD_PAGE_SIZE;

  const npcPageCount = Math.max(1, Math.ceil(npcList.length / NPC_PAGE_SIZE));
  const headPageCount = Math.max(1, Math.ceil(headList.length / HEAD_PAGE_SIZE));

  const [headVillageIcon, setHeadVillageIcon] = useState<string | null>(null);

  const [faqQuery, setFaqQuery] = useState('');
  const [faqTags, setFaqTags] = useState<string[]>([]);
  const [faqRefreshSignal, setFaqRefreshSignal] = useState(0);

  const [showNewFaq, setShowNewFaq] = useState(false);

  // 🔗 문서 링크 복사 상태 (✔ 표시용)
  const [copiedDocLink, setCopiedDocLink] = useState(false);

  // ⭐ 루트 문서는 문서 크롬(제목/브레드크럼) 숨김
  const [hideDocChrome, setHideDocChrome] = useState(false);
  const [loadingDoc, setLoadingDoc] = useState(false);
  const [bootstrapReady, setBootstrapReady] = useState(false);

  // ---------- 전환 지연(딜레이) 상태 ----------
  const [delaying, setDelaying] = useState(false);
  const SWAP_DELAY_MS = 120; // 체감 120~220ms 권장
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const contentRef = useRef<HTMLDivElement>(null);
  const pendingScrollDomIdRef = useRef<string>('');
  const stableHeadingScrollTimeoutsRef = useRef<number[]>([]);
  const docAbortRef = useRef<AbortController | null>(null);

  const clearStableHeadingScrollTimeouts = () => {
    for (const id of stableHeadingScrollTimeoutsRef.current) {
      window.clearTimeout(id);
    }
    stableHeadingScrollTimeoutsRef.current = [];
  };

  function normalizeHashToDomId(hashLike: string | null | undefined) {
    let h = String(hashLike ?? '').trim();

    if (!h) return '';

    if (h.startsWith('#')) h = h.slice(1);

    try {
      h = decodeURIComponent(h);
    } catch {
      // noop
    }

    if (!h) return '';

    // heading-xxx 형태인데 occ가 없으면 기본 --0 부여
    if (h.startsWith('heading-') && !h.includes('--')) {
      return `${h}--0`;
    }

    return h;
  }

  function findScrollableContainer(startEl: HTMLElement | null): HTMLElement | null {
    let el: HTMLElement | null = startEl;

    while (el) {
      const style = window.getComputedStyle(el);
      const overflowY = style.overflowY;

      const scrollable =
        (overflowY === 'auto' || overflowY === 'scroll') &&
        el.scrollHeight > el.clientHeight + 1;

      if (scrollable) return el;

      el = el.parentElement;
    }

    return null;
  }

  function getPreferredScrollContainer(target: HTMLElement | null): HTMLElement | null {
    const wikiRoot = document.getElementById('wiki-scroll-root') as HTMLElement | null;

    if (wikiRoot && target && wikiRoot.contains(target)) {
      return wikiRoot;
    }

    return findScrollableContainer(target);
  }

  function isHeadingAligned(
    domId: string,
    headerOffset = 72,
    tolerance = 24,
  ) {
    const target = document.getElementById(domId);
    if (!target) return false;

    const scrollParent = getPreferredScrollContainer(target) || null;

    if (!scrollParent) {
      const targetTop = target.getBoundingClientRect().top;
      return Math.abs(targetTop - headerOffset) <= tolerance;
    }

    const line = scrollParent.getBoundingClientRect().top + headerOffset;
    const targetTop = target.getBoundingClientRect().top;

    return Math.abs(targetTop - line) <= tolerance;
  }

  function scrollToHeadingDomId(
    domId: string,
    headerOffset = 72,
    options?: {
      stable?: boolean;
    },
  ) {
    const stable = options?.stable ?? true;

    const scrollOnce = (behavior: ScrollBehavior = 'auto') => {
      const target = document.getElementById(domId);
      if (!target) return false;

      const scrollParent = findScrollableContainer(target) || null;

      if (!scrollParent) {
        const y = target.getBoundingClientRect().top + window.scrollY - headerOffset;
        window.scrollTo({ top: Math.max(0, y), behavior });
        return true;
      }

      const parentRect = scrollParent.getBoundingClientRect();
      const y =
        target.getBoundingClientRect().top -
        parentRect.top +
        scrollParent.scrollTop -
        headerOffset;

      scrollParent.scrollTo({ top: Math.max(0, y), behavior });
      return true;
    };

    const ok = scrollOnce('auto');
    if (!ok) return false;

    if (stable) {
      clearStableHeadingScrollTimeouts();

      const correctionDelays = [120, 320, 760, 1450, 2200];

      for (const delay of correctionDelays) {
        const timerId = window.setTimeout(() => {
          if (!isHeadingAligned(domId, headerOffset, 24)) {
            scrollOnce('auto');
          }
        }, delay);

        stableHeadingScrollTimeoutsRef.current.push(timerId);
      }
    }

    return true;
  }

  useEffect(() => {
    return () => {
      clearStableHeadingScrollTimeouts();
    };
  }, []);

  // ✅ 문서가 열리면 해당 문서의 카테고리 경로를 전부 펼치기
  const ensureOpenForDocPath = (docPath: number[] | null | undefined) => {
    if (!Array.isArray(docPath)) return;

    // 루트([])면 펼칠 게 없음
    if (docPath.length === 0) return;

    // 예: [1,5,9] => [[1],[1,5],[1,5,9]]
    const prefixes: number[][] = [];
    for (let i = 0; i < docPath.length; i++) prefixes.push(docPath.slice(0, i + 1));

    // closingMap에 걸려 있으면 풀고, openPaths에 없으면 추가
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
    docId: number | null,
    docTitle: string | null,
    fullPath: number[] | null | undefined,
    options?: { history?: 'push' | 'replace' }
  ) => {
    if (typeof window === 'undefined') return;
    if (!docTitle) return;

    const search = new URLSearchParams(window.location.search);
    const currentPath = search.get('path');
    const currentTitle = search.get('title');

    const lastId =
      !fullPath || fullPath.length === 0
        ? '0'
        : String(fullPath[fullPath.length - 1]);

    const encodedTitle = encodeTitleForUrlParam(docTitle);

    search.set('path', lastId);
    search.set('title', encodedTitle);

    if (docId != null && Number.isFinite(docId)) {
      search.set('id', String(docId));
    } else {
      search.delete('id');
    }

    search.delete('_t');

    // ✅ hash는 건드리지 않음
    const nextUrl = window.location.pathname + '?' + search.toString();
    const currentUrl = window.location.pathname + window.location.search;

    if (currentUrl === nextUrl) return;

    ignoreNextUrlSyncRef.current = true;

    if (options?.history === 'replace') {
      router.replace(nextUrl, { scroll: false });
    } else {
      router.push(nextUrl, { scroll: false });
    }
  };

  // 🔗 현재 문서 링크 복사 (✔ 애니메이션)
  // - window.location.search는 %EC... 형태로 인코딩되어 있으므로
  //   클립보드에 복사할 때는 한글이 그대로 보이도록 쿼리를 재구성한다.
  const handleCopyDocLink = async () => {
    if (typeof window === 'undefined') return;

    try {
      const u = new URL(window.location.href);

      // path 보정
      if (selectedDocId != null) {
        u.searchParams.set('id', String(selectedDocId));
      }
      if (!u.searchParams.get('path')) {
        if (Array.isArray(selectedDocPath) && selectedDocPath.length > 0) {
          u.searchParams.set('path', String(selectedDocPath[selectedDocPath.length - 1]));
        } else {
          u.searchParams.set('path', '0');
        }
      }

      // title 보정: 표시용 제목 -> 공유용(_ 치환)
      let safeTitle = selectedDocTitle || u.searchParams.get('title') || '';
      try {
        safeTitle = decodeURIComponent(safeTitle);
      } catch {}
      safeTitle = decodeTitleFromUrlParam(safeTitle);
      safeTitle = encodeTitleForUrlParam(safeTitle);

      if (safeTitle) {
        u.searchParams.set('title', safeTitle);
      }

      // mode 보정
      const safeMode = u.searchParams.get(MODE_PARAM) || mode || '';
      if (safeMode) {
        u.searchParams.set(MODE_PARAM, safeMode);
      }

      const qs = u.searchParams.toString();
      const url = `${u.origin}${u.pathname}${qs ? `?${qs}` : ''}${u.hash || ''}`;

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
      return () =>
        window.removeEventListener(MODE_EVENT, onMode as EventListener);
    }
  }, []);

  const docReqIdRef = useRef(0);

  // ----------------------------------------
  // 유틸: 루트 대표 문서 찾기 & 열기
  // ----------------------------------------
  const findRootDoc = () => {
    const roots = allDocuments.filter(
      d =>
        (Array.isArray(d.fullPath) && d.fullPath.length === 0) ||
        Number(d.path) === 0,
    );
    // 대표 우선(is_featured) → 없으면 첫번째
    return roots.find(d => d.is_featured) || roots[0];
  };

  const findDocumentMetaById = (id?: number | null) => {
    if (id == null) return null;
    return allDocuments.find(d => d.id === id) ?? null;
  };

  const openRootDoc = async () => {
    const rootDoc = findRootDoc();
    if (!rootDoc) return;

    setHideDocChrome(true);
    setSelectedDocId(rootDoc.id);
    setSelectedDocTitle(rootDoc.title ?? null);
    setSelectedDocPath([]); // 루트 경로는 []
    setSelectedCategoryPath(null);

    await fetchDocById(rootDoc.id, { hideChrome: true });
  };

  // ✅ 특정 ID로 루트 문서 열기(로고/초기 로딩용)
  const openRootDocById = async (docId: number) => {
    setHideDocChrome(true);
    setSelectedCategoryPath(null);
    setSelectedDocPath([]); // 루트 경로 고정
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
        const url =
          '/api/bootstrap' +
          (mode ? `?m=${encodeURIComponent(mode)}` : '');
        const r = await fetch(withTs(url), NC);
        const { categories: catData, documents: docsRaw, featured } =
          await r.json();

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
          const pNum = /^\d+$/.test(String(r.path))
            ? Number(r.path)
            : NaN;
          const fullPath =
            Number(r.path) === 0
              ? []
              : Number.isFinite(pNum)
              ? idToPath[pNum] || [pNum]
              : [];
          return { ...r, fullPath, special: r.special ?? null };
        });
        if (cancelled || !mountedRef.current) return;
        setAllDocuments(mapped);

        // 새로고침/직접 진입 시 URL에 특정 문서가 명시되어 있으면
        // bootstrap featured(루트 문서)를 먼저 본문에 꽂지 않는다.
        // 그렇지 않으면 실제 문서를 열기 전에 루트 문서(id 73)가 잠깐 보인다.
        const initialSearch =
          typeof window !== 'undefined'
            ? new URLSearchParams(window.location.search)
            : null;

        const initialId = initialSearch ? Number(initialSearch.get('id')) : NaN;
        const initialPath = initialSearch?.get('path');
        const initialTitle = initialSearch?.get('title');

        const hasExplicitInitialTarget =
          (Number.isFinite(initialId) && initialId > 0) ||
          (!!initialPath && !!initialTitle);

        // 최초 뷰를 bootstrap 응답 하나로 바로 렌더
        // 단, URL로 특정 문서에 직접 들어온 경우에는 featured 선렌더 금지
        if (!hasExplicitInitialTarget && featured?.id) {
          setHideDocChrome(true);
          setSelectedDocId(featured.id);
          setSelectedDocTitle(featured.title ?? null);
          setSelectedDocPath([]);
          setSelectedCategoryPath(null);

          const initialContent: Descendant[] = Array.isArray(featured.content)
            ? featured.content
            : [];

          setDocContent(initialContent);
          setTableOfContents(extractHeadings(initialContent));
        } else {
          // ✅ 직접 진입이면 featured / 이전 문서 흔적을 아예 비움
          setSelectedDocId(null);
          setSelectedDocTitle(null);
          setSelectedDocPath(null);
          setSelectedCategoryPath(null);
          setHideDocChrome(false);

          setDocContent(null);
          setTableOfContents([]);
          setSpecialMeta(null);
          setFaqQuery('');
          setFaqTags([]);
        }

        setBootstrapReady(true);
      } catch (e) {
        console.error('[bootstrap init] failed', e);
        if (!cancelled && mountedRef.current) {
          setBootstrapReady(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode]);

  // 쿼리 진입: /wiki?path=...&title=...
  // ✅ allDocuments/카테고리 맵이 준비된 뒤 실행되며, 루트(path=0)는 id 우선 로딩
  useEffect(() => {
    if (!bootstrapReady) return;

    if (ignoreNextUrlSyncRef.current) {
      ignoreNextUrlSyncRef.current = false;
      return;
    }

    const idParamRaw = searchParams.get('id');
    const idParam = idParamRaw ? Number(idParamRaw) : NaN;
    const pathParam = searchParams.get('path');
    const titleParamRaw = searchParams.get('title');
    const titleParam = titleParamRaw ? titleParamRaw.replace(/_/g, ' ') : null;

    if (Number.isFinite(idParam) && idParam > 0) {
      const meta = allDocuments.find((d) => d.id === idParam) ?? null;
      const metaFullPath = meta?.fullPath;
      const fullPath: number[] | null = Array.isArray(metaFullPath) ? metaFullPath : null;

      const isRoot =
        Number(meta?.path) === 0 ||
        (fullPath !== null && fullPath.length === 0);

      void fetchDocById(idParam, {
        hideChrome: isRoot,
        history: 'replace',
        skipUrlSync: true,
        clearCategoryPath: true,
        presetPath: isRoot ? [] : fullPath,
      });
      return;
    }
    if (!pathParam || !titleParam) return;

    // ✅ 현재 URL hash를 항상 먼저 읽어서 저장
    if (typeof window !== 'undefined') {
      pendingScrollDomIdRef.current = normalizeHashToDomId(window.location.hash);
    }

    const openByIdIfFound = (isRoot: boolean, id?: number, presetPath?: number[] | null) => {
      if (id != null) {
        fetchDoc(isRoot ? [] : (presetPath ?? []), titleParam, id, {
          clearCategoryPath: true,
          forceRoot: isRoot,
          history: 'replace',
          skipUrlSync: true,
          deferVisibleState: true,
          presetPath: isRoot ? [] : (presetPath ?? []),
        });
        return true;
      }
      return false;
    };

    if (pathParam === '0') {
      if (allDocuments.length === 0) return;

      const match = allDocuments.find(
        d =>
          ((Array.isArray(d.fullPath) && d.fullPath.length === 0) ||
            Number(d.path) === 0) &&
          d.title === titleParam,
      );

      if (openByIdIfFound(true, match?.id, [])) return;

      fetchDoc([], titleParam, undefined, {
        clearCategoryPath: true,
        forceRoot: true,
        history: 'replace',
        skipUrlSync: true,
        deferVisibleState: true,
        presetPath: [],
      });
    } else {
      const pathId = Number(pathParam);
      const fullPath = categoryIdToPathMap[pathId];
      if (fullPath) {
        fetchDoc(fullPath, titleParam, undefined, {
          clearCategoryPath: true,
          history: 'replace',
          skipUrlSync: true,
          deferVisibleState: true,
          presetPath: fullPath,
        });
      }
    }
  }, [bootstrapReady, searchParams, allDocuments, categoryIdToPathMap]);

  const isPathOpen = (path: number[]) =>
    openPaths.some(p => pathToStr(p) === pathToStr(path)); // 비교 버그 수정

  const isClosing = (path: number[]) =>
    closingMap[pathToStr(path)] || false;
  const finalizeClose = (path: number[]) => {
    const key = pathToStr(path);
    setOpenPaths(prev =>
      prev.filter(p => pathToStr(p) !== key),
    );
    setClosingMap(prev => {
      const n = { ...prev };
      delete n[key];
      return n;
    });
  };
  const closeTreeWithChildren = async (
    node: CategoryNode,
    path: number[],
  ): Promise<void> => {
    const key = pathToStr(path);
    setClosingMap(prev => ({ ...prev, [key]: true }));
    if (node.children?.length) {
      node.children.forEach(child => {
        const childPath = [...path, child.id];
        if (isPathOpen(childPath))
          void closeTreeWithChildren(node, childPath);
      });
    }
  };
  const handleArrowClick = (node: CategoryNode, path: number[]) => {
    const key = pathToStr(path);
    const isOpenNow = isPathOpen(path);
    if (isOpenNow) {
      void closeTreeWithChildren(node, path);
    } else {
      setClosingMap(prev => {
        const n = { ...prev };
        delete n[key];
        return n;
      });
      setOpenPaths(prev =>
        prev.some(p => pathToStr(p) === key)
          ? prev
          : [...prev, path],
      );
    }
  };
  const togglePath = async (path: number[]) => {
    const catId = path.at(-1)!;
    const category = categoryIdMap[catId];
    const isSamePath =
      selectedDocPath &&
      JSON.stringify(selectedDocPath) === JSON.stringify(path);
    const isSameDoc = selectedDocId === category?.document_id;
    const docId = Number(category?.document_id);

    if (
      category?.document_id &&
      Number.isInteger(docId) &&
      (!isSamePath || !isSameDoc)
    ) {
      const meta = findDocumentMetaById(docId);

      // ✅ bootstrap/allDocuments에 이미 있는 메타를 우선 사용
      if (meta?.title) {
        await fetchDoc(path, meta.title, meta.id, {
          clearCategoryPath: false,
          forceRoot: path.length === 0,
        });
        return;
      }

      // bootstrap 메타에 없으면 추가 DB fetch를 하지 않고 종료
      // pooler 불안정 시 대표 문서 fallback 호출까지 겹치지 않게 한다.
      console.warn('[togglePath] representative document metadata missing:', docId);
      return;
    }
  };

  type DocOpenHistory = 'push' | 'replace';

  type FetchDocOptions = {
    clearCategoryPath?: boolean;
    forceRoot?: boolean;
    hideChrome?: boolean;
    history?: DocOpenHistory;
    skipUrlSync?: boolean;

    // ✅ 새로고침/직접 진입 시에는
    // 응답 성공 전까지 visible state를 미리 바꾸지 않음
    deferVisibleState?: boolean;

    // ✅ id 조회 시 목록 메타가 없거나 늦을 때 사용할 경로 힌트
    presetPath?: number[] | null;
  };

  // 문서 fetch (path/title)
  const fetchDoc = async (
    categoryPath: number[],
    docTitle: string,
    docId?: number,
    options?: FetchDocOptions
  ) => {
    const isRoot = options?.forceRoot || categoryPath.length === 0;
    const deferVisibleState = !!options?.deferVisibleState;
    const presetPathSource = options?.presetPath;

    const presetPath =
      Array.isArray(presetPathSource)
        ? [...presetPathSource]
        : isRoot
        ? []
        : [...categoryPath];

    if (options?.clearCategoryPath) {
      setSelectedCategoryPath(null);
    }

    if (docId != null) {
      if (!deferVisibleState) {
        setSelectedDocId(docId);
        setSelectedDocPath(presetPath);
        setSelectedDocTitle(docTitle);
        setHideDocChrome(isRoot);
      }

      setLoadingDoc(true);

      void fetchDocById(docId, {
        hideChrome: isRoot,
        history: options?.history,
        skipUrlSync: options?.skipUrlSync,
        clearCategoryPath: options?.clearCategoryPath,
        presetPath,
      });
      return;
    }

    if (!deferVisibleState) {
      setSelectedDocTitle(docTitle);
      setHideDocChrome(isRoot);
    }

    // 루트 + id 미지정 → 목록에서 id 찾기
    if (isRoot) {
      const match = allDocuments.find(
        d =>
          ((Array.isArray(d.fullPath) && d.fullPath.length === 0) ||
            Number(d.path) === 0) &&
          d.title === docTitle,
      );

      if (match?.id != null) {
        if (!deferVisibleState) {
          setSelectedDocId(match.id);
          setSelectedDocPath([]);
        }

        setLoadingDoc(true);

        void fetchDocById(match.id, {
          hideChrome: true,
          history: options?.history,
          skipUrlSync: options?.skipUrlSync,
          clearCategoryPath: options?.clearCategoryPath,
          presetPath: [],
        });
        return;
      }
    }

    const doc = allDocuments.find(
      d =>
        d.title === docTitle &&
        ((isRoot &&
          ((Array.isArray(d.fullPath) && d.fullPath.length === 0) ||
            Number(d.path) === 0)) ||
          JSON.stringify(d.fullPath) === JSON.stringify(categoryPath)),
    );

    if (doc) {
      if (!deferVisibleState) {
        setSelectedDocId(doc.id);
        setSelectedDocPath(isRoot ? [] : [...categoryPath]);
      }

      setLoadingDoc(true);

      void fetchDocById(doc.id, {
        hideChrome: isRoot,
        history: options?.history,
        skipUrlSync: options?.skipUrlSync,
        clearCategoryPath: options?.clearCategoryPath,
        presetPath: isRoot ? [] : [...categoryPath],
      });
      return;
    }

    const reqId = ++docReqIdRef.current;
    setLoadingDoc(true);

    docAbortRef.current?.abort();
    const controller = new AbortController();
    docAbortRef.current = controller;

    const pathParam = isRoot ? '0' : String(categoryPath.at(-1));

    fetchDocJsonWithRetry(
      `/api/documents?path=${pathParam}&title=${encodeURIComponent(docTitle)}`,
      controller.signal,
    )
      .then(data => {
        if (!data) {
          setDocContent(null);
          setSpecialMeta(null);
          setFaqQuery('');
          setFaqTags([]);
          setLoadingDoc(false);
          return;
        }
        if (!mountedRef.current || reqId !== docReqIdRef.current) return;

        const content: Descendant[] =
          typeof data.content === 'string'
            ? JSON.parse(data.content)
            : data.content;

        const docInList = allDocuments.find(d => d.id === data.id);
        const special = data.special ?? docInList?.special ?? null;
        const meta = parseSpecial(special);

        const presetPath = options?.presetPath;

        let nextPath: number[] = [];
        if (docInList?.fullPath) {
          nextPath = [...docInList.fullPath];
        } else if (Array.isArray(presetPath)) {
          nextPath = [...presetPath];
        } else {
          const rawPath = data.path;
          if (Number(rawPath) === 0) {
            nextPath = [];
          } else if (/^\d+$/.test(String(rawPath))) {
            const cid = Number(rawPath);
            nextPath =
              categoryIdToPathMap[cid] ??
              (Number.isFinite(cid) ? [cid] : []);
          }
        }

        setDocContent(content);
        setTableOfContents(extractHeadings(content));

        setSelectedDocId(Number(data?.id ?? null));
        setSelectedDocTitle(data.title ?? docTitle ?? null);
        setSelectedDocPath(nextPath);

        if (options?.clearCategoryPath) {
          setSelectedCategoryPath(null);
        }

        setSpecialMeta(meta);

        if (meta?.kind === 'faq') {
          setFaqQuery(meta.q ?? '');
          setFaqTags(meta.tags ?? []);
        } else {
          setFaqQuery('');
          setFaqTags([]);
        }

        setHideDocChrome(
          !!options?.hideChrome || Number(data?.id) === ROOT_FEATURED_DOC_ID
        );

        ensureOpenForDocPath(nextPath);

        if (!options?.skipUrlSync) {
          syncUrlWithDoc(
            Number(data?.id ?? null),
            data.title ?? docTitle,
            nextPath,
            {
              history: options?.history ?? 'push',
            }
          );
        }

        setLoadingDoc(false);
      })
      .catch((e: any) => {
        if (e?.name === 'AbortError') return;
        if (!mountedRef.current || reqId !== docReqIdRef.current) return;

        setDocContent(null);
        setSpecialMeta(null);
        setFaqQuery('');
        setFaqTags([]);
        setLoadingDoc(false);
      });
  };

  // 문서 fetch (id)
  const fetchDocById = async (
    docId: number,
    options?: FetchDocOptions
  ) => {
    const reqId = ++docReqIdRef.current;
    setLoadingDoc(true);

    docAbortRef.current?.abort();
    const controller = new AbortController();
    docAbortRef.current = controller;

    try {
      const data = await fetchDocJsonWithRetry(
        `/api/documents?id=${docId}`,
        controller.signal,
      );

      if (!data) {
        setDocContent(null);
        setSpecialMeta(null);
        setFaqQuery('');
        setFaqTags([]);
        setLoadingDoc(false);
        return;
      }
      if (!mountedRef.current || reqId !== docReqIdRef.current) return;

      const content: Descendant[] =
        typeof data.content === 'string'
          ? JSON.parse(data.content)
          : data.content;

      const docInList = allDocuments.find(d => d.id === data.id);
      const special = data.special ?? docInList?.special ?? null;
      const meta = parseSpecial(special);

      const presetPath = options?.presetPath;

      let nextPath: number[] = [];
      if (docInList?.fullPath) {
        nextPath = [...docInList.fullPath];
      } else if (Array.isArray(presetPath)) {
        nextPath = [...presetPath];
      } else {
        const rawPath = data.path;
        if (Number(rawPath) === 0) {
          nextPath = [];
        } else if (/^\d+$/.test(String(rawPath))) {
          const cid = Number(rawPath);
          nextPath =
            categoryIdToPathMap[cid] ??
            (Number.isFinite(cid) ? [cid] : []);
        }
      }

      setDocContent(content);
      setTableOfContents(extractHeadings(content));

      setSelectedDocId(Number(data?.id ?? docId));
      setSelectedDocTitle(data.title ?? null);
      setSelectedDocPath(nextPath);

      if (options?.clearCategoryPath) {
        setSelectedCategoryPath(null);
      }

      setSpecialMeta(meta);

      if (meta?.kind === 'faq') {
        setFaqQuery(meta.q ?? '');
        setFaqTags(meta.tags ?? []);
      } else {
        setFaqQuery('');
        setFaqTags([]);
      }

      setHideDocChrome(
        !!options?.hideChrome || Number(data?.id) === ROOT_FEATURED_DOC_ID
      );

      ensureOpenForDocPath(nextPath);

      if (!options?.skipUrlSync) {
        syncUrlWithDoc(
          Number(data?.id ?? docId),
          data.title ?? null,
          nextPath,
          { history: options?.history ?? 'push' }
        );
      }

      setLoadingDoc(false);
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
      if (!mountedRef.current || reqId !== docReqIdRef.current) return;

      setDocContent(null);
      setSpecialMeta(null);
      setFaqQuery('');
      setFaqTags([]);
      setLoadingDoc(false);
    }
  };

  // 본문 내부 링크 라우팅
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

      // ✅ 내부 위키 링크만 가로채기
      const isSameOrigin = url.origin === window.location.origin;
      const isWikiDocLink = isSameOrigin && url.pathname === '/wiki';
      if (!isWikiDocLink) return;

      const path = url.searchParams.get('path');
      const titleRaw = url.searchParams.get('title');
      const title = titleRaw ? decodeTitleFromUrlParam(titleRaw) : null;

      // path/title 없는 /wiki 메인 이동은 기존 로고 동작 등 다른 흐름에 맡김
      if (!path || !title) return;

      e.preventDefault();
      e.stopPropagation();

      // ✅ 링크 클릭 즉시 로딩 느낌 먼저 주기
      setLoadingDoc(true);

      pendingScrollDomIdRef.current = normalizeHashToDomId(url.hash);

      // ✅ 루트 문서
      if (path === '0') {
        fetchDoc([], title, undefined, {
          clearCategoryPath: true,
          forceRoot: true,
        });
        return;
      }

      const pathId = Number(path);
      if (!Number.isFinite(pathId)) {
        setLoadingDoc(false);
        return;
      }

      const fullPath = categoryIdToPathMap[pathId] ?? [pathId];

      // ✅ 사이드바 상호작용 먼저 반영 (깜빡임 완화)
      ensureOpenForDocPath(fullPath);

      // ✅ 클릭한 문서가 속한 카테고리 경로를 미리 선택 상태로 잡아줌
      setSelectedCategoryPath(fullPath);

      // ✅ 실제 문서 로드
      fetchDoc(fullPath, title, undefined, {
        clearCategoryPath: true,
      });
    };

    el.addEventListener('click', handler);
    return () => el.removeEventListener('click', handler);
  }, [docContent, categoryIdToPathMap, mode]);

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
      setNpcList([]);
      setNpcLoading(false);
      setNpcPage(0);
      setHeadList([]);
      setHeadLoading(false);
      setHeadPage(0);
      setHeadVillageIcon(null); // 🔽 머리 아이콘 초기화
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
      setHeadVillageIcon(null); // 🔽 머리 아이콘 초기화
      return;
    }

    let cancelled = false;
    const findVillage = async (names: string[]) => {
      for (const name of names) {
        const r = await fetch(
          withTs(`/api/villages?name=${encodeURIComponent(name)}`),
          NC,
        );
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
        const v = await findVillage(
          [meta.village, selectedDocTitle].filter(Boolean) as string[],
        );
        if (!v) {
          if (!cancelled) {
            setHeadLoading(false);
            setHeadVillageIcon(null); // 🔽 못 찾으면 null
          }
          return;
        }

        // 🔽 여기서 village 테이블의 head_icon을 상태에 저장
        if (!cancelled) {
          setHeadVillageIcon(v.head_icon ?? null);
        }

        const res = await fetch(
          withTs(`/api/head?village_id=${v.id}`),
          NC,
        );
        const heads = res.ok ? await res.json() : [];
        if (cancelled) return;
        setHeadList(Array.isArray(heads) ? (heads as HeadRow[]) : []);
        setHeadLoading(false);
        return;
      }

      // quest / npc
      setHeadVillageIcon(null); // 🔽 머리 모드가 아니면 아이콘 초기화
      setNpcLoading(true);
      setNpcList([]);
      setNpcPage(0);
      const v = await findVillage(
        [meta.village, selectedDocTitle].filter(Boolean) as string[],
      );
      if (!v) {
        if (!cancelled) setNpcLoading(false);
        return;
      }
      const npcType = meta.kind === 'quest' ? 'quest' : 'normal';
      const res = await fetch(
        withTs(
          `/api/npcs?village_id=${v.id}&npc_type=${npcType}&nocache=1`,
        ),
        NC,
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

  const currentDoc = useMemo(
    () => allDocuments.find(d => d.id === selectedDocId),
    [allDocuments, selectedDocId],
  );

  const isFaq = specialMeta?.kind === 'faq';

  type WikiRefKind = 'quest' | 'npc' | 'qna';

  const extractVillageArray = (data: any): any[] => {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.rows)) return data.rows;
    if (Array.isArray(data?.villages)) return data.villages;
    return [];
  };

  const fetchAllVillages = async (): Promise<any[]> => {
    const candidates = [
      '/api/villages',
      '/api/villages?all=1',
      '/api/villages?mode=all',
      '/api/villages/list',
    ];

    for (const url of candidates) {
      try {
        const r = await fetch(withTs(url), NC);
        if (!r.ok) continue;
        const data = await r.json();
        const arr = extractVillageArray(data);
        if (arr.length > 0) return arr;
      } catch {
        // next candidate
      }
    }
    return [];
  };

  const fetchNpcById = async (
    id: number,
    kind: 'quest' | 'npc',
  ): Promise<NpcRow | null> => {
    if (!Number.isFinite(id) || id <= 0) return null;

    // 1) 캐시
    const cached = npcByIdCacheRef.current.get(id);
    if (cached) return cached;

    // 2) 현재 로딩된 목록에서 먼저 찾기
    const localHit = npcList.find((n) => Number(n.id) === id);
    if (localHit) {
      npcByIdCacheRef.current.set(id, localHit);
      return localHit;
    }

    // 3) fallback: 모든 마을의 /api/npcs 목록에서 탐색
    const villages = await fetchAllVillages();
    if (!villages.length) return null;

    const npc_type = kind === 'quest' ? 'quest' : 'normal';

    for (const v of villages) {
      const vid = Number(v?.id);
      if (!Number.isFinite(vid) || vid <= 0) continue;

      try {
        const res = await fetch(
          withTs(`/api/npcs?village_id=${vid}&npc_type=${npc_type}`),
          NC,
        );
        if (!res.ok) continue;

        const arr = await res.json();
        if (!Array.isArray(arr)) continue;

        // 캐시 쌓기 + 대상 찾기
        for (const row of arr) {
          if (row && Number.isFinite(Number(row.id))) {
            npcByIdCacheRef.current.set(Number(row.id), row);
          }
        }

        const hit = npcByIdCacheRef.current.get(id);
        if (hit) return hit;
      } catch {
        // 다음 마을
      }
    }

    return null;
  };

  const handleWikiRefClick = async (kind: WikiRefKind, id: number) => {
    if (!id || id <= 0) return;
    if (hold) return; // 전환중엔 무시

    if (kind === 'qna') {
      const fresh = await fetchFaqDetail(id);
      if (fresh) setWikiFaqSel(fresh);
      return;
    }

    if (kind === 'quest' || kind === 'npc') {
      setSelectedNpcMode(kind);          // ✅ 여기 핵심
      const npc = await fetchNpcById(id, kind); // ✅ 목록 기반 단건찾기
      if (npc) setSelectedNpc(npc);
      return;
    }
  };

  // ✅ 초기 자동 오픈: 카테고리/문서 세팅 완료 후 "ID=73"
  useEffect(() => {
    if (!bootstrapReady) return;
    if (!firstLoadRef.current) return;
    if (!mountedRef.current) return;

    const ready =
      categories &&
      categories.length > 0 &&
      allDocuments &&
      allDocuments.length > 0;

    if (!ready) return;

    const hasUrl =
      !!searchParams.get('id') ||
      !!(searchParams.get('path') && searchParams.get('title'));
    if (hasUrl) return; // 딥링크 우선

    // ✅ bootstrap에서 이미 대표 문서가 세팅됐으면 추가 fetch 금지
    if (selectedDocId === ROOT_FEATURED_DOC_ID && docContent) {
      firstLoadRef.current = false;
      return;
    }

    firstLoadRef.current = false;

    const id1 = requestAnimationFrame(() => {
      const id2 = requestAnimationFrame(() => {
        openRootDocById(ROOT_FEATURED_DOC_ID);
      });
      (window as any).__wiki_root_open_cleanup = () =>
        cancelAnimationFrame(id2);
    });

    return () => {
      cancelAnimationFrame(id1);
      const c = (window as any).__wiki_root_open_cleanup;
      if (typeof c === 'function') {
        c();
        delete (window as any).__wiki_root_open_cleanup;
      }
    };
  }, [bootstrapReady, categories, allDocuments, selectedDocId, docContent, searchParams]);

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

  // ✅ 문서 조회수 기록
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const docId = selectedDocId;
    if (!docId) return;

    // 문서가 완전히 열린 상태에서만 카운트
    if (loadingDoc) return;
    if (hold) return;
    if (docContent === null) return;

    const key = `docview:${ymdKey()}:${docId}`;

    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
    } catch {}

    sendDocView(docId);
  }, [selectedDocId, loadingDoc, hold, docContent]);

  useEffect(() => {
    if (hold) return;

    const pending = pendingScrollDomIdRef.current;
    if (!pending) return;

    clearStableHeadingScrollTimeouts();

    // 1차: 문서가 보이자마자 한 번 이동 + 장기 보정 예약
    scrollToHeadingDomId(pending, 72, { stable: true });

    let tries = 0;
    const maxTries = 90;

    const tick = () => {
      tries += 1;

      // ✅ "scroll 호출 성공"이 아니라 "실제로 원하는 줄에 도착했는지"로 종료 판정
      if (isHeadingAligned(pending, 72, 24)) {
        pendingScrollDomIdRef.current = '';
        return;
      }

      // 아직 덜 맞았으면 짧게 한 번 더 맞춘다
      scrollToHeadingDomId(pending, 72, { stable: false });

      if (tries < maxTries) {
        requestAnimationFrame(tick);
      }
    };

    requestAnimationFrame(() => requestAnimationFrame(tick));
  }, [hold, docContent, tableOfContents]);

  // ---------- (선택) 콘텐츠 페이드: 딜레이 중엔 숨기고, 준비되면 페이드-인 ----------
  const contentClass = hold ? 'is-hold' : 'is-ready';
  // -----------------------------------------------------------------------

  const interactionReady =
    categories.length > 0 &&
    allDocuments.length > 0 &&
    Object.keys(categoryIdMap).length > 0;

  useEffect(() => {
    if (!interactionReady) return;
    ensureOpenForDocPath(selectedDocPath);
  }, [interactionReady, selectedDocPath]);

  return (
    <div className="wiki-container">
      <WikiHeader
        user={user}
        mobileCategoryOpen={mobileCategoryOpen}
        onToggleMobileCategory={() => setMobileCategoryOpen((v) => !v)}
        hideAdminMenu={false}
        onQuestNpcClick={(id) => handleWikiRefClick('quest', id)}
      />

      {/* ✅ 모바일 카테고리 오버레이 */}
      {mobileCategoryOpen && (
        <button
          type="button"
          className="wiki-mobile-overlay"
          aria-label="카테고리 닫기"
          onClick={() => setMobileCategoryOpen(false)}
        />
      )}

      {/* ✅ 모바일 카테고리 드로어 */}
      <aside
        className={`wiki-mobile-drawer ${mobileCategoryOpen ? 'open' : ''}`}
        aria-hidden={!mobileCategoryOpen}
      >
        <div className="wiki-mobile-drawer-header">
          <button
            type="button"
            className="mobile-category-title"
            onClick={collapseAllCategories}
          >
            카테고리
          </button>
          <button
            type="button"
            className="wiki-mobile-drawer-close"
            onClick={() => setMobileCategoryOpen(false)}
            aria-label="카테고리 닫기"
          >
            ✕
          </button>
        </div>

        <div className="wiki-mobile-drawer-body">
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
            mode={mode ?? 'RPG'}
          />
        </div>
      </aside>

      <div className="wiki-layout">
        <div className="wiki-main-scrollable" id="wiki-scroll-root">
          {/* ✅ 데스크톱 전용 사이드바 */}
          <aside className="wiki-sidebar wiki-sidebar-desktop">
            <div className="wiki-sidebar-inner">
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
                mode={mode ?? 'RPG'}
              />
            </div>
          </aside>

          <main className={`wiki-content ${contentClass}`}>
            {!hideDocChrome && !!selectedDocTitle && (
              <>
                <div className={`wiki-breadcrumb-wrap ${hold ? 'is-loading' : ''}`}>
                  <Breadcrumb
                    selectedDocPath={selectedDocPath}
                    categories={categories}
                    onNavigateCategoryDoc={(path, docId) => {
                      const meta = findDocumentMetaById(docId);
                      if (!meta?.title) return;

                      void fetchDoc(path, meta.title, docId, {
                        clearCategoryPath: false,
                        history: 'push',
                      });
                    }}
                  />
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                  }}
                >
                  <div className="wiki-doc-title-wrap">
                    <h2 className="wiki-content-title-row wiki-content-title">
                      {currentDoc?.icon ? (
                        currentDoc.icon.startsWith('http') ? (
                          <img
                            src={toProxyUrl(currentDoc.icon)}
                            alt="icon"
                            className="wiki-doc-icon-img"
                            loading="lazy"
                            decoding="async"
                          />
                        ) : (
                          <span className="wiki-doc-icon-emoji">
                            {currentDoc.icon}
                          </span>
                        )
                      ) : null}

                      <span className="wiki-title-color">
                        {selectedDocTitle || '렌독 위키'}
                      </span>

                      <button
                        type="button"
                        className={
                          'wiki-doc-link-btn' +
                          (copiedDocLink ? ' wiki-doc-link-btn--copied' : '')
                        }
                        onClick={handleCopyDocLink}
                        title="문서 링크 복사"
                      >
                        {copiedDocLink ? '✔' : '🔗'}
                      </button>
                    </h2>
                  </div>

                  {isFaq && !!user && (
                    <FaqAddButton onClick={() => setShowNewFaq(true)} />
                  )}
                </div>
              </>
            )}

            <div
              className="wiki-content-body doc-content-shell"
              ref={contentRef}
              style={{
                fontFamily:
                  "'NanumSquareRound', -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
              }}
            >
              <div className={`doc-content-stage ${hold ? 'is-loading' : ''}`}>
                {isFaq ? (
                  <FaqList
                    query={faqQuery}
                    tags={faqTags}
                    user={user}
                    refreshSignal={faqRefreshSignal}
                  />
                ) : specialMeta?.kind === 'head' ? (
                  <div className="wiki-paged-section wiki-paged-section--head">
                    <div className="wiki-paged-body">
                      {headLoading ? (
                        <div className="wiki-loading-placeholder"></div>
                      ) : headList.length > 0 ? (
                        <HeadGrid
                          heads={headList.slice(
                            headPage * HEAD_PAGE_SIZE,
                            (headPage + 1) * HEAD_PAGE_SIZE,
                          )}
                          onClick={setSelectedHead}
                          selectedHeadId={selectedHead?.id || null}
                          headIcon={headVillageIcon}
                        />
                      ) : (
                        <div>등록된 머리가 없습니다.</div>
                      )}
                    </div>

                    {headList.length > HEAD_PAGE_SIZE && !hold && (
                      <div className="wiki-paging-bar">
                        <div className="wiki-paging-seg">
                          <button
                            type="button"
                            onClick={() => setHeadPage((p) => Math.max(0, p - 1))}
                            disabled={headPage === 0}
                            className="wiki-paging-btn"
                            aria-label="이전 페이지"
                          >
                            <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                              <path d="M15 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </button>

                          <span className="wiki-paging-text">
                            {headPage + 1} / {headPageCount}
                          </span>

                          <button
                            type="button"
                            onClick={() =>
                              setHeadPage((p) => Math.min(headPageCount - 1, p + 1))
                            }
                            disabled={headPage === headPageCount - 1}
                            className="wiki-paging-btn next"
                            aria-label="다음 페이지"
                          >
                            <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                              <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : specialMeta?.kind === 'npc' || specialMeta?.kind === 'quest' ? (
                  <div className="wiki-paged-section wiki-paged-section--npc">
                    <div className="wiki-paged-body">
                      {npcLoading ? (
                        <div className="wiki-loading-placeholder"></div>
                      ) : npcList.length > 0 ? (
                        <NpcGrid
                          npcs={npcList.slice(
                            npcPage * NPC_PAGE_SIZE,
                            (npcPage + 1) * NPC_PAGE_SIZE,
                          )}
                          onClick={(npc) => {
                            setSelectedNpcMode(null);
                            setSelectedNpc(npc);
                          }}
                        />
                      ) : (
                        <div>등록된 NPC가 없습니다.</div>
                      )}
                    </div>

                    {npcList.length > NPC_PAGE_SIZE && !hold && (
                      <div className="wiki-paging-bar">
                        <div className="wiki-paging-seg">
                          <button
                            type="button"
                            onClick={() => setNpcPage((p) => Math.max(0, p - 1))}
                            disabled={npcPage === 0}
                            className="wiki-paging-btn"
                            aria-label="이전 페이지"
                          >
                            <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                              <path d="M15 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </button>

                          <span className="wiki-paging-text">
                            {npcPage + 1} / {npcPageCount}
                          </span>

                          <button
                            type="button"
                            onClick={() =>
                              setNpcPage((p) => Math.min(npcPageCount - 1, p + 1))
                            }
                            disabled={npcPage === npcPageCount - 1}
                            className="wiki-paging-btn next"
                            aria-label="다음 페이지"
                          >
                            <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                              <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : Array.isArray(docContent) && docContent.length > 0 ? (
                  <div className="wiki-read-mobile-scope">
                    <WikiReadRenderer
                      content={docContent}
                      readOnly
                      onWikiRefClick={handleWikiRefClick}
                    />
                  </div>
                ) : (
                  <div className="wiki-loading-placeholder"></div>
                )}
              </div>

              {hold && (
                <div className="doc-loading-overlay" aria-hidden="true">
                  <div className="wiki-loading-placeholder"></div>
                </div>
              )}

              {selectedNpc && !hold && (
                <NpcDetailModal
                  npc={selectedNpc}
                  mode={selectedNpcMode ?? (specialMeta?.kind === 'quest' ? 'quest' : 'npc')}
                  onClose={() => {
                    setSelectedNpc(null);
                    setSelectedNpcMode(null);
                  }}
                />
              )}

              {wikiFaqSel && !hold && (
                <FaqDetailModal
                  sel={wikiFaqSel}
                  onClose={() => setWikiFaqSel(null)}
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

        {/* ✅ 데스크톱 전용 TOC */}
        <aside className="wiki-toc-sidebar wiki-toc-sidebar-desktop">
          <TableOfContents
            headings={tableOfContents}
            scrollRootSelector="#wiki-scroll-root"
            docTitle={currentDoc?.title}
            docIcon={currentDoc?.icon}
          />
        </aside>

        {/* ✅ 모바일 우하단 탐색 버튼 */}
        {!hideDocChrome && (
          <MobileWikiNav
            headings={tableOfContents}
            docTitle={selectedDocTitle}
            docIcon={findDocumentMetaById(selectedDocId)?.icon ?? null}
            headerOffset={72}
            scrollRootSelector="#wiki-scroll-root"
          />
        )}
      </div>

      {showNewFaq && (
        <FaqUpsertModal
          open
          mode="create"
          onClose={() => setShowNewFaq(false)}
          onSaved={() => {
            setShowNewFaq(false);
            setFaqRefreshSignal((v) => v + 1);
          }}
        />
      )}

      <div className="wiki-quick-badges-wrap">
        <DocQuickBadges
          hidden={hold}
          items={[
            {
              icon: 'quest',
              title: '퀘스트',
              href: 'wiki?path=27&title=%ED%80%98%EC%8A%A4%ED%8A%B8&mode=RPG',
            },
            {
              icon: 'head',
              title: '머리찾기',
              href: 'wiki?path=53&title=%EB%A8%B8%EB%A6%AC%EC%B0%BE%EA%B8%B0&mode=RPG',
            },
            {
              icon: 'price',
              title: '시세표',
              href: 'wiki?path=38&title=%EC%8B%9C%EC%84%B8%ED%91%9C&mode=RPG',
            },
            {
              icon: 'collection',
              title: '도감',
              href: 'https://cafe.naver.com/rendogserver/98577',
              external: true,
            },
            {
              icon: 'calc',
              title: '계산기',
              href: 'https://shkim1217.mycafe24.com/rendog/home.php',
              external: true,
            },
          ]}
        />
    </div>

      <style jsx global>{`
        .wiki-content.is-ready {
          opacity: 1;
          transition: opacity 0.12s ease;
        }

        .wiki-content.is-hold {
          opacity: 1;
        }

        .wiki-doc-title-wrap {
          display: flex;
          align-items: center;
          justify-content: flex-start;
          gap: 6px;
          padding-bottom: 10px;
        }

        .wiki-content-title-row {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          margin: 0;
          line-height: 1.1;
          padding: 2px 0;
        }

        .wiki-doc-icon-img {
          width: 24px;
          height: 24px;
          image-rendering: pixelated;
        }

        .wiki-doc-link-btn {
          width: 20px;
          height: 20px;
          margin-left: 6px;
          display: grid;
          place-items: center;
          border: none;
          border-radius: 50%;
          background: transparent;
          color: #9ca3af;
          font-size: 12px;
          opacity: 0;
          pointer-events: none;
          cursor: pointer;
          transition: all 0.15s ease;
        }

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
          opacity: 1;
          pointer-events: auto;
        }

        @import url('https://fonts.googleapis.com/css2?family=Jua&display=swap');
        :root {
          --wiki-round-font: 'Jua', 'Pretendard', 'Malgun Gothic',
            system-ui, sans-serif;
        }

        .wiki-paged-section {
          display: flex;
          flex-direction: column;
        }

        .wiki-paged-body {
          flex: 0 0 auto;
        }

        .wiki-paged-section--npc .wiki-paged-body {
          min-height: 520px;
        }

        .wiki-paged-section--head .wiki-paged-body {
          min-height: 620px;
        }

        .wiki-paging-bar {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 44px;
          margin-top: 0;
        }

        .wiki-paging-seg {
          display: inline-flex;
          align-items: stretch;
          background: var(--surface-elevated);
          border: 1px solid var(--border);
          border-radius: 12px;
          overflow: hidden;
          box-shadow: var(--shadow-sm);
        }

        .wiki-paging-btn,
        .wiki-paging-text {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 8px 14px;
          min-width: 44px;
          height: 38px;
          border: 0;
          background: transparent;
          font-weight: 600;
          font-size: 0.95rem;
          color: var(--foreground);
          line-height: 1;
        }

        .wiki-paging-btn {
          cursor: pointer;
          transition: background 0.15s, color 0.15s;
        }

        .wiki-paging-btn:hover {
          background: var(--surface-soft);
        }

        .wiki-paging-btn:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .wiki-paging-btn .ico {
          width: 20px;
          height: 20px;
          flex: 0 0 20px;
        }

        .wiki-paging-btn:first-child {
          border-right: 1px solid var(--border);
        }

        .wiki-paging-btn.next {
          border-left: 1px solid var(--border);
        }

        .wiki-paging-text {
          white-space: nowrap;
          user-select: none;
        }

        @media (max-width: 768px) {
          .wiki-paged-section--npc .wiki-paged-body {
            min-height: auto !important;
          }

          .wiki-paged-section--head .wiki-paged-body {
            min-height: auto !important;
          }

          .wiki-paged-section--npc {
            gap: 4px;
            padding-bottom: 120px;
          }

          .wiki-paged-section--head {
            gap: 4px;
            padding-bottom: 120px;
          }

          .wiki-paging-bar {
            position: fixed;
            left: 50%;
            bottom: 50px;
            transform: translateX(-50%);
            z-index: 120;
            min-height: 0;
            margin-top: 0;
            padding-top: 0;
            width: auto;
            pointer-events: none;
          }

          .wiki-paging-seg {
            pointer-events: auto;
            border-radius: 14px;
            background: var(--surface-elevated);
            border: 1px solid var(--border);
            box-shadow: var(--shadow-lg);
          }

          .wiki-paging-btn,
          .wiki-paging-text {
            height: 36px;
            min-width: 40px;
            padding: 7px 12px;
            font-size: 0.92rem;
          }

          .wiki-paging-btn .ico {
            width: 18px;
            height: 18px;
            flex: 0 0 18px;
          }
        }

        /* 기존 구조 유지:
          아래 중복 블록은 남겨두되, 흰색 하드코딩만 제거하고
          변수 기반으로 바꿔서 다크모드에서도 정상 동작하게 수정 */
        .wiki-paging-seg {
          display: inline-flex;
          align-items: stretch;
          background: var(--surface-elevated);
          border: 1px solid var(--border);
          border-radius: 12px;
          overflow: hidden;
          box-shadow: var(--shadow-sm);
        }

        .wiki-paging-btn,
        .wiki-paging-text {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 8px 14px;
          min-width: 44px;
          height: 38px;
          border: 0;
          background: transparent;
          font-weight: 600;
          font-size: 0.95rem;
          color: var(--foreground);
          line-height: 1;
        }

        .wiki-paging-btn {
          cursor: pointer;
          transition: background 0.15s, color 0.15s;
        }

        .wiki-paging-btn:hover {
          background: var(--surface-soft);
        }

        .wiki-paging-btn:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .wiki-paging-btn .ico {
          width: 20px;
          height: 20px;
          flex: 0 0 20px;
        }

        .wiki-paging-btn:first-child {
          border-right: 1px solid var(--border);
        }

        .wiki-paging-btn.next {
          border-left: 1px solid var(--border);
        }

        .wiki-paging-text {
          white-space: nowrap;
          user-select: none;
        }

        .doc-content-shell {
          position: relative;
        }

        .doc-content-stage {
          position: relative;
          z-index: 1;
        }

        .doc-content-stage.is-loading {
          opacity: 0.55;
          transition: opacity 0.12s ease;
        }

        .doc-loading-overlay {
          position: absolute;
          inset: 0;
          z-index: 2;
          display: flex;
          align-items: center;
          justify-content: center;
          pointer-events: none;
        }

        .wiki-breadcrumb-wrap {
          transition: opacity 0.12s ease;
        }

        .wiki-breadcrumb-wrap.is-loading {
          opacity: 0.72;
        }

        .wiki-loading-placeholder {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 120px;
          color: var(--muted);
          font-size: 14px;
          font-weight: 600;
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
  background: 'var(--overlay)',
  zIndex: 1000,
  display: 'grid',
  placeItems: 'center',
  padding: 16,
};

const modalStyle: React.CSSProperties = {
  width: 'min(680px, 100%)',
  background: 'var(--surface-elevated)',
  border: '1px solid var(--border)',
  borderRadius: 16,
  padding: 16,
  boxShadow: 'var(--shadow-xl)',
  color: 'var(--foreground)',
};

const modalHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 12,
};

const closeBtnStyle: React.CSSProperties = {
  border: '1px solid var(--border)',
  background: 'var(--surface)',
  color: 'var(--foreground)',
  borderRadius: 8,
  width: 32,
  height: 32,
  cursor: 'pointer',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 13,
  color: 'var(--muted)',
  marginBottom: 6,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  border: '1px solid var(--border)',
  background: 'var(--surface)',
  color: 'var(--foreground)',
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
          <path
            d="M12 5v14M5 12h14"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span className="faq-add-label">질문 추가</span>
      </button>

      <style jsx>{`
        .faq-add-group {
          display: inline-flex;
          align-items: stretch;
          background: var(--surface-elevated);
          border: 1px solid var(--border);
          border-radius: 12px;
          overflow: hidden;
          box-shadow: var(--shadow-sm);
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
          color: var(--foreground);
          line-height: 1;
          white-space: nowrap;
          height: 38px;
          transition: background 0.15s, color 0.15s;
        }

        .faq-add-seg:hover {
          background: var(--surface-soft);
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