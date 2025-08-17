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
import FaqList from './FaqList';

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

// ---- 권한 체크(Writer+) --------------------------------------
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
        const ok = ['admin','manager','writer'].includes(role)
          || roles.includes('admin') || roles.includes('manager') || roles.includes('writer');
        if (!cancelled) setCan(!!ok);
      } catch { if (!cancelled) setCan(false); }
    })();
    return () => { cancelled = true; };
  }, [user?.id]);
  return can;
}

// ---- Special 파서 ---------------------------------------------
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

// -------------------------------------------------------------------

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
  const [specialMeta, setSpecialMeta] = useState<SpecialMeta>(null);
  const [npcList, setNpcList] = useState<NpcRow[]>([]);
  const [npcLoading, setNpcLoading] = useState(false);
  const [selectedNpc, setSelectedNpc] = useState<NpcRow | null>(null);
  const [npcPage, setNpcPage] = useState(0);

  const [headList, setHeadList] = useState<HeadRow[]>([]);
  const [headLoading, setHeadLoading] = useState(false);
  const [selectedHead, setSelectedHead] = useState<HeadRow | null>(null);
  const [headPage, setHeadPage] = useState(0);

  // FAQ 파라미터 & 새로고침 신호
  const [faqQuery, setFaqQuery] = useState('');
  const [faqTags, setFaqTags] = useState<string[]>([]);
  const [faqRefreshSignal, setFaqRefreshSignal] = useState(0);

  // 새 질문 모달
  const [showNewFaq, setShowNewFaq] = useState(false);

  const canWrite = useCanWrite(user);

  const router = useRouter();
  const searchParams = useSearchParams();
  const contentRef = useRef<HTMLDivElement>(null);

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
        fetchDoc(path, doc.title, doc.id);
        setOpenPaths(prev => (prev.some(p => JSON.stringify(p) === JSON.stringify(path)) ? prev : [...prev, path]));
      } catch {
        setSelectedDocId(null); setSelectedDocPath(null); setSelectedDocTitle(null);
        setDocContent([]); setSelectedCategoryPath(path);
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

    if (docId) { setSelectedDocId(docId); setSelectedDocPath([...categoryPath]); }
    else {
      const doc = allDocuments.find(d => d.title === docTitle && JSON.stringify(d.fullPath) === JSON.stringify(categoryPath));
      if (doc) { setSelectedDocId(doc.id); setSelectedDocPath([...categoryPath]); }
    }

    const reqId = ++docReqIdRef.current;

    fetch(`/api/documents?path=${String(categoryPath.at(-1))}&title=${encodeURIComponent(docTitle)}`, { cache: 'no-store' })
      .then(res => { if (!res.ok) throw new Error('문서를 찾을 수 없습니다.'); return res.json(); })
      .then(data => {
        if (!mountedRef.current || reqId !== docReqIdRef.current) return;
        const content: Descendant[] =
          typeof data.content === 'string' ? JSON.parse(data.content) : data.content;
        setDocContent(content);
        setTableOfContents(extractHeadings(content));

        const docInList = allDocuments.find(d => d.id === data.id);
        const special = data.special ?? docInList?.special ?? null;
        const meta = parseSpecial(special);
        setSpecialMeta(meta);

        if (meta?.kind === 'faq') {
          setFaqQuery(meta.q ?? ''); setFaqTags(meta.tags ?? []);
        } else { setFaqQuery(''); setFaqTags([]); }

        if (data.fullPath && Array.isArray(data.fullPath)) setSelectedDocPath([...data.fullPath]);
      })
      .catch(() => {
        if (!mountedRef.current || reqId !== docReqIdRef.current) return;
        setDocContent(null);
        setSpecialMeta(null);
        setFaqQuery(''); setFaqTags([]);
      });
  }

  // --------- 본문 내부 링크 라우팅 ---------
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const aTag = target?.closest('a'); if (!aTag) return;
      const href = aTag.getAttribute('href');
      if (href && href.startsWith('/wiki?')) {
        e.preventDefault();
        const url = new URL(href, window.location.origin);
        const path = url.searchParams.get('path');
        const title = url.searchParams.get('title');
        if (path && title) router.push(`/wiki?path=${encodeURIComponent(path)}&title=${encodeURIComponent(title)}&_t=${Date.now()}`);
      }
    };
    el.addEventListener('click', handler);
    return () => el.removeEventListener('click', handler);
  }, [docContent, router]);

  // --------- Special 기반 데이터 로딩(FAQ 제외) ---------
  useEffect(() => {
    if (!selectedDocId || !selectedDocTitle) {
      setNpcList([]); setNpcLoading(false); setNpcPage(0);
      setHeadList([]); setHeadLoading(false); setHeadPage(0);
      return;
    }
    const meta = specialMeta;
    if (!meta || meta.kind === 'faq') {
      setNpcList([]); setNpcLoading(false); setNpcPage(0);
      setHeadList([]); setHeadLoading(false); setHeadPage(0);
      return;
    }

    let cancelled = false;
    const findVillage = async (names: string[]) => {
      for (const name of names) {
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
        const v = await findVillage([meta.village, selectedDocTitle].filter(Boolean) as string[]);
        if (!v) { setHeadLoading(false); return; }
        const res = await fetch(`/api/head?village_id=${v.id}`);
        const heads = res.ok ? await res.json() : [];
        setHeadList(Array.isArray(heads) ? (heads as HeadRow[]) : []); setHeadLoading(false);
        return;
      }
      setNpcLoading(true); setNpcList([]); setNpcPage(0);
      const v = await findVillage([meta.village, selectedDocTitle].filter(Boolean) as string[]);
      if (!v) { setNpcLoading(false); return; }
      const npcType = meta.kind === 'quest' ? 'quest' : 'normal';
      const res = await fetch(`/api/npcs?village_id=${v.id}&npc_type=${npcType}`);
      const npcs = res.ok ? await res.json() : [];
      setNpcList(Array.isArray(npcs) ? (npcs as NpcRow[]) : []); setNpcLoading(false);
    })();
  }, [selectedDocId, selectedDocTitle, specialMeta]);

  const currentDoc = useMemo(
    () => allDocuments.find(d => d.id === selectedDocId),
    [allDocuments, selectedDocId]
  );

  const isFaq = specialMeta?.kind === 'faq';

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

            {/* 타이틀 + 질문추가 버튼(FAQ일 때만, writer+) */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <h2 className="wiki-content-title-row wiki-content-title" style={{ margin: 0 }}>
                {isFaq ? (
                  <>
                    <span className="wiki-doc-icon-emoji" aria-hidden>🧭</span>
                    <span className="wiki-title-color">자주 물으시는 질문</span>
                  </>
                ) : (
                  <>
                    {currentDoc?.icon
                      ? (currentDoc.icon.startsWith('http')
                          ? <img src={currentDoc.icon} alt="icon" className="wiki-doc-icon-img" />
                          : <span className="wiki-doc-icon-emoji">{currentDoc.icon}</span>)
                      : null}
                    <span className="wiki-title-color">{selectedDocTitle || '렌독 위키'}</span>
                  </>
                )}
              </h2>

              {isFaq && canWrite && (
                <button
                  className="wiki-btn wiki-btn-primary"
                  onClick={() => setShowNewFaq(true)}
                  style={{ height: 36 }}
                >
                  질문 추가
                </button>
              )}
            </div>

            <div className="wiki-content-body" ref={contentRef}>
              {isFaq ? (
                <FaqList query={faqQuery} tags={faqTags} user={user} refreshSignal={faqRefreshSignal} />
              ) : specialMeta?.kind === 'head' ? (
                headLoading ? <div>머리 목록 로딩 중...</div> :
                headList.length > 0 ? (
                  <HeadGrid
                    heads={headList.slice(headPage * 21, (headPage + 1) * 21)}
                    onClick={setSelectedHead}
                    selectedHeadId={selectedHead?.id || null}
                  />
                ) : <div>등록된 머리가 없습니다.</div>
              ) : specialMeta?.kind === 'npc' || specialMeta?.kind === 'quest' ? (
                npcLoading ? <div>NPC 목록 로딩 중...</div> :
                npcList.length > 0 ? (
                  <NpcGrid
                    npcs={npcList.slice(npcPage * 21, (npcPage + 1) * 21)}
                    onClick={setSelectedNpc}
                    selectedNpcId={selectedNpc?.id || null}
                  />
                ) : <div>등록된 NPC가 없습니다.</div>
              ) : Array.isArray(docContent) && docContent.length > 0 ? (
                <WikiReadRenderer content={docContent} />
              ) : (
                <div>문서를 찾을 수 없습니다.</div>
              )}

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

              {/* 상세 모달들 */}
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

      {/* 새 질문 모달(타이틀 옆 버튼) */}
      {showNewFaq && (
        <NewFaqModal
          onClose={() => setShowNewFaq(false)}
          onSaved={() => { setShowNewFaq(false); setFaqRefreshSignal(v => v + 1); }}
        />
      )}
    </div>
  );
}

// ---------------- 새 질문 모달(제목/내용(+태그 옵션)) ----------------
function NewFaqModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void; }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState(''); // 쉼표 분리, 옵션
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!title.trim() || !content.trim()) {
      alert('제목과 내용을 입력해주세요.'); return;
    }
    setSaving(true);
    try {
      const r = await fetch('/api/faq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), content: content.trim(), tags }),
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
          <button onClick={onClose} style={closeBtnStyle} aria-label="close">✕</button>
        </div>
        <div style={{ display: 'grid', gap: 10 }}>
          <div>
            <label style={labelStyle}>제목</label>
            <input style={inputStyle} value={title} onChange={e => setTitle(e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>내용</label>
            <textarea style={{ ...inputStyle, height: 140, resize: 'vertical' }} value={content} onChange={e => setContent(e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>태그(쉼표로 구분, 선택)</label>
            <input style={inputStyle} value={tags} onChange={e => setTags(e.target.value)} placeholder="예: 뉴비,설정" />
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
          <button className="wiki-btn" onClick={onClose}>취소</button>
          <button className="wiki-btn wiki-btn-primary" onClick={save} disabled={saving}>{saving ? '저장 중…' : '저장'}</button>
        </div>
      </div>
    </div>
  );
}

// --- inline styles for modal ---
const backdropStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000,
  display: 'grid', placeItems: 'center', padding: 16,
};
const modalStyle: React.CSSProperties = {
  width: 'min(680px, 100%)', background: '#fff', borderRadius: 16, padding: 16, boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
};
const modalHeaderStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 };
const closeBtnStyle: React.CSSProperties = { border: '1px solid #e5e7eb', background: '#fff', borderRadius: 8, width: 32, height: 32, cursor: 'pointer' };
const labelStyle: React.CSSProperties = { display: 'block', fontSize: 13, color: '#555', marginBottom: 6 };
const inputStyle: React.CSSProperties = { width: '100%', border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 10px' };
