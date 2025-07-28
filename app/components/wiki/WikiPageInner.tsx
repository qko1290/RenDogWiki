// =============================================
// File: components/wiki/WikiPageInner.tsx
// =============================================
'use client';

import { useState, useEffect, useRef } from 'react';
import WikiHeader from '@/components/common/Header';
import HamburgerMenu from '@/components/common/HamburgerMenu';
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

type Props = {
  user: {
    id: number;
    username: string;
    minecraft_name: string;
    email: string;
  } | null;
};

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
  const [tableOfContents, setTableOfContents] = useState<any[]>([]);

  // 트리 애니메이션 상태
  const [openPaths, setOpenPaths] = useState<number[][]>([]);
  const [closingPaths, setClosingPaths] = useState<number[][]>([]);

  // NPC/머리찾기 관련 상태
  const [npcList, setNpcList] = useState<any[]>([]);
  const [npcLoading, setNpcLoading] = useState(false);
  const [selectedNpc, setSelectedNpc] = useState<any | null>(null);
  const [npcPage, setNpcPage] = useState(0);

  const [headList, setHeadList] = useState<any[]>([]);
  const [headLoading, setHeadLoading] = useState(false);
  const [selectedHead, setSelectedHead] = useState<any | null>(null);
  const [headPage, setHeadPage] = useState(0);

  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const router = useRouter();
  const searchParams = useSearchParams();
  const contentRef = useRef<HTMLDivElement>(null);

  // 전체 문서 로딩 + fullPath 연결
  useEffect(() => {
    fetch('/api/documents?all=1')
      .then(res => res.json())
      .then(data => {
        const docs = Array.isArray(data)
          ? data
          : Array.isArray(data.documents)
            ? data.documents
            : [];
        if (Object.keys(categoryIdToPathMap).length === 0) {
          setAllDocuments(docs);
          return;
        }
        const mapped = docs.map((doc: Document & { path: number }) => ({
          ...doc,
          fullPath: categoryIdToPathMap[doc.path] || [doc.path],
        }));
        setAllDocuments(mapped);
      });
  }, [categoryIdToPathMap]);

  // 카테고리 트리/맵 세팅
  useEffect(() => {
    fetch('/api/categories')
      .then(res => res.json())
      .then(data => {
        import('@/wiki/lib/buildCategoryTree').then(mod => {
          const tree = mod.buildCategoryTree(data) as CategoryNode[];
          setCategories(tree);

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
          setCategoryIdToPathMap(idToPathMap);
          setCategoryIdMap(categoryMap);
        });
      });
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
  }, [searchParams, categoryIdToPathMap]);

  // --------- 트리 토글/애니메이션 ---------
  const togglePath = async (path: number[]) => {
    const catId = path.at(-1)!;
    const category = categoryIdMap[catId];
    const isSamePath = selectedDocPath && JSON.stringify(selectedDocPath) === JSON.stringify(path);
    const isSameDoc = selectedDocId === category?.document_id;

    const docId = Number(category?.document_id);
    if (
      category?.document_id &&
      Number.isInteger(docId) &&
      (!isSamePath || !isSameDoc)
    ) {
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
    } else if (!category?.document_id || !Number.isInteger(docId)) {
      alert('대표 문서 ID가 잘못되어 열 수 없습니다: ' + String(category?.document_id));
    }
  };
  const toggleArrowOnly = (path: number[]) => {
    const pathStr = JSON.stringify(path);
    const isOpen = openPaths.some((p) => JSON.stringify(p) === pathStr);
    const isClosing = closingPaths.some((p) => JSON.stringify(p) === pathStr);

    if (isOpen) {
      if (isClosing) return;
      setClosingPaths(prev => [...prev, path]);
      setTimeout(() => {
        setOpenPaths(prev => prev.filter(p => JSON.stringify(p) !== pathStr));
        setClosingPaths(prev => prev.filter(p => JSON.stringify(p) !== pathStr));
      }, 240);
    } else {
      setOpenPaths(prev => {
        const exists = prev.some(p => JSON.stringify(p) === pathStr);
        return exists ? prev : [...prev, path];
      });
      setClosingPaths(prev => prev.filter(p => JSON.stringify(p) !== pathStr));
    }
  };
  const isPathOpen = (path: number[]) =>
    openPaths.some(p => JSON.stringify(p) === JSON.stringify(path));

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

    fetch(`/api/documents?path=${String(categoryPath.at(-1))}&title=${encodeURIComponent(docTitle)}`)
      .then(res => {
        if (!res.ok) throw new Error('문서를 찾을 수 없습니다.');
        return res.json();
      })
      .then(data => {
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
      .catch(() => setDocContent(null));
  }

  // --------- 본문 내부 링크 라우팅 ---------
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const handler = (e: MouseEvent) => {
      const aTag = (e.target as HTMLElement).closest('a');
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

  // --------- NPC/Head 동적 fetch 및 상태 ---------
  useEffect(() => {
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
    const currentCategory = categoryIdMap[selectedDocPath[selectedDocPath.length - 1]];
    const catName = currentCategory?.name;
    if (catName === "머리찾기") {
      setHeadLoading(true); setHeadList([]); setHeadPage(0);
      fetch(`/api/villages?name=${encodeURIComponent(selectedDocTitle)}`)
        .then(res => res.json())
        .then(village => {
          if (!village || !village.id) {
            setHeadList([]); setHeadLoading(false); return;
          }
          return fetch(`/api/head?village_id=${village.id}`);
        })
        .then(res => (res && res.json ? res.json() : []))
        .then(heads => {
          setHeadList(Array.isArray(heads) ? heads : []);
          setHeadLoading(false);
        })
        .catch(() => {
          setHeadList([]); setHeadLoading(false);
        });
      return;
    }
    if (catName !== "퀘스트" && catName !== "NPC") {
      setNpcList([]); setNpcLoading(false); setNpcPage(0);
      setHeadList([]); setHeadLoading(false); setHeadPage(0);
      return;
    }
    setNpcLoading(true); setNpcList([]); setNpcPage(0);
    fetch(`/api/villages?name=${encodeURIComponent(selectedDocTitle)}`)
      .then(res => res.json())
      .then(village => {
        if (!village || !village.id) {
          setNpcList([]); setNpcLoading(false); return;
        }
        const npcType = catName === "퀘스트" ? "quest" : "normal";
        return fetch(`/api/npcs?village_id=${village.id}&npc_type=${npcType}`);
      })
      .then(res => (res && res.json ? res.json() : []))
      .then(npcs => {
        setNpcList(Array.isArray(npcs) ? npcs : []);
        setNpcLoading(false);
      })
      .catch(() => {
        setNpcList([]); setNpcLoading(false);
      });
  }, [selectedDocId, selectedDocTitle, selectedDocPath, categoryIdMap]);

  // --------- 렌더 ---------
  return (
    <div className="wiki-container">
      <WikiHeader user={user} />
      <div className="wiki-layout">
        <div className="wiki-main-scrollable">
          {/* ---- 사이드바: 카테고리 트리 ---- */}
          <aside className="wiki-sidebar">
            <h2 className="wiki-sidebar-title">카테고리</h2>
            <CategoryTree
              categories={categories}
              categoryIdMap={categoryIdMap}
              categoryIdToPathMap={categoryIdToPathMap}
              selectedDocPath={selectedDocPath}
              selectedCategoryPath={selectedCategoryPath}
              setSelectedDocPath={setSelectedDocPath}
              setSelectedDocId={setSelectedDocId}
              setSelectedDocTitle={setSelectedDocTitle}
              setSelectedCategoryPath={setSelectedCategoryPath}
              fetchDoc={fetchDoc}
              allDocuments={allDocuments}
              openPaths={openPaths}
              closingPaths={closingPaths}
              togglePath={togglePath}
              toggleArrowOnly={toggleArrowOnly}
              isPathOpen={isPathOpen}
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
            <h2 className="wiki-content-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {/* 문서 아이콘 */}
              {(() => {
                const doc = allDocuments.find(d => d.id === selectedDocId);
                if (doc?.icon) {
                  return doc.icon.startsWith('http')
                    ? <img src={doc.icon} alt="icon" style={{
                      width: 32, height: 32, verticalAlign: 'middle',
                      marginRight: 8, objectFit: 'contain', display: 'inline-block'
                    }} />
                    : <span style={{ fontSize: 28, marginRight: 8 }}>{doc.icon}</span>
                }
                return null;
              })()}
              {selectedDocTitle || '렌독 위키'}
            </h2>
            <div className="wiki-content-body" ref={contentRef}>
              {/* ---- 머리찾기 ---- */}
              {categoryIdMap[selectedDocPath?.[selectedDocPath.length - 1] || -1]?.name === "머리찾기"
                ? headLoading
                  ? <div>머리찾기 목록 로딩 중...</div>
                  : headList.length > 0
                    ? <HeadGrid
                        heads={headList.slice(headPage * 21, (headPage + 1) * 21)}
                        onClick={setSelectedHead}
                        selectedHeadId={selectedHead?.id || null}
                      />
                    : <div>등록된 머리찾기가 없습니다.</div>
                : categoryIdMap[selectedDocPath?.[selectedDocPath.length - 1] || -1]?.name === "퀘스트" ||
                  categoryIdMap[selectedDocPath?.[selectedDocPath.length - 1] || -1]?.name === "NPC"
                  ? npcLoading
                    ? <div>NPC 목록 로딩 중...</div>
                    : npcList.length > 0
                      ? <NpcGrid
                          npcs={npcList.slice(npcPage * 21, (npcPage + 1) * 21)}
                          onClick={setSelectedNpc}
                          selectedNpcId={selectedNpc?.id || null}
                        />
                      : <div>등록된 NPC가 없습니다.</div>
                  : Array.isArray(docContent) && docContent.length > 0
                    ? <WikiReadRenderer content={docContent} />
                    : <div>문서를 찾을 수 없습니다.</div>
              }
              {/* ---- 페이징 ---- */}
              {categoryIdMap[selectedDocPath?.[selectedDocPath.length - 1] || -1]?.name === "머리찾기" && headList.length > 21 &&
                <div style={{ display: 'flex', justifyContent: 'center', gap: 20, margin: '10px 0' }}>
                  <button
                    onClick={() => setHeadPage(p => Math.max(0, p - 1))}
                    disabled={headPage === 0}
                    style={{ fontSize: 20, opacity: headPage === 0 ? 0.5 : 1 }}
                  >◀</button>
                  <span style={{ fontSize: 16 }}>{headPage + 1} / {Math.ceil(headList.length / 21)}</span>
                  <button
                    onClick={() => setHeadPage(p => Math.min(Math.ceil(headList.length / 21) - 1, p + 1))}
                    disabled={headPage === Math.ceil(headList.length / 21) - 1}
                    style={{ fontSize: 20, opacity: headPage === Math.ceil(headList.length / 21) - 1 ? 0.5 : 1 }}
                  >▶</button>
                </div>
              }
              {["퀘스트", "NPC"].includes(categoryIdMap[selectedDocPath?.[selectedDocPath.length - 1] || -1]?.name || "") && npcList.length > 21 &&
                <div style={{ display: 'flex', justifyContent: 'center', gap: 20, margin: '10px 0' }}>
                  <button
                    onClick={() => setNpcPage(p => Math.max(0, p - 1))}
                    disabled={npcPage === 0}
                    style={{ fontSize: 20, opacity: npcPage === 0 ? 0.5 : 1 }}
                  >◀</button>
                  <span style={{ fontSize: 16 }}>{npcPage + 1} / {Math.ceil(npcList.length / 21)}</span>
                  <button
                    onClick={() => setNpcPage(p => Math.min(Math.ceil(npcList.length / 21) - 1, p + 1))}
                    disabled={npcPage === Math.ceil(npcList.length / 21) - 1}
                    style={{ fontSize: 20, opacity: npcPage === Math.ceil(npcList.length / 21) - 1 ? 0.5 : 1 }}
                  >▶</button>
                </div>
              }
              {/* ---- 상세 모달 ---- */}
              {selectedNpc && (
                <NpcDetailModal npc={selectedNpc} onClose={() => setSelectedNpc(null)} />
              )}
              {selectedHead && (
                <HeadDetailModal head={selectedHead} docIcon={allDocuments.find(d => d.id === selectedDocId)?.icon} onClose={() => setSelectedHead(null)} />
              )}
            </div>
          </main>
        </div>
        {/* ---- 목차 ---- */}
        <aside className="wiki-toc-sidebar">
          <TableOfContents headings={tableOfContents} />
        </aside>
      </div>
      {/* ---- 햄버거 메뉴 ---- */}
      {isMenuOpen && (
        <HamburgerMenu
          onClose={() => setIsMenuOpen(false)}
          isLoggedIn={!!user}
          username={user?.minecraft_name || ''}
          uuid={''}
        />
      )}
    </div>
  );
}
