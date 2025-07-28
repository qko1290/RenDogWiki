// =============================================
// File: components/wiki/WikiPageInner.tsx
// =============================================
/**
 * 렌독 위키 메인 페이지 본체
 * - 상태/데이터 로딩 및 주요 분기 컨트롤
 * - 카테고리/문서/머리찾기/NPC 그리드/목차/브레드크럼 컴포넌트 호출
 * - 본문 내 내부 링크 클릭 시 라우팅
 */

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

import { Descendant } from 'slate';
import { useRouter, useSearchParams } from 'next/navigation';

// 카테고리/문서 타입 정의
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
  // 추가로 heads, npcs 등 동적 필드가 붙을 수 있음
  heads?: any[];
  npcs?: any[];
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

  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const router = useRouter();
  const searchParams = useSearchParams();
  const contentRef = useRef<HTMLDivElement>(null);

  // --------- 카테고리 트리 + 경로맵 로드 ---------
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
      })
      .catch(err => console.error('카테고리 로딩 실패:', err));
  }, []);

  // --------- 전체 문서 로드 + 경로 부여 ---------
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
        // fullPath 세팅
        const mapped = docs.map((doc: Document & { path: number }) => ({
          ...doc,
          fullPath: categoryIdToPathMap[doc.path] || [doc.path],
        }));
        setAllDocuments(mapped);
      });
  }, [categoryIdToPathMap]);

  // --------- 쿼리 파라미터 진입시 문서 자동 오픈 ---------
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

  // --------- 문서 로드 함수 ---------
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

  // --------- 본문 내부 링크 클릭 시 라우팅 ---------
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

  // --------- 선택 문서/카테고리 판별 ---------
  const selectedDoc = allDocuments.find(doc => doc.id === selectedDocId);
  const selectedCategoryName = categoryIdMap[selectedDoc?.path as number]?.name;
  const isHeadCategory = selectedCategoryName === "머리찾기";
  const isNpcOrQuestCategory = selectedCategoryName === "퀘스트" || selectedCategoryName === "NPC";

  // --------- 렌더 ---------
  return (
    <div className="wiki-container">
      <WikiHeader user={user} />
      <div className="wiki-layout">
        <div className="wiki-main-scrollable">
          {/* ----- 사이드바: 카테고리/문서 트리 ----- */}
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
            />
          </aside>
          {/* ----- 본문 영역 ----- */}
          <main className="wiki-content">
            <Breadcrumb
              selectedDocPath={selectedDocPath}
              categories={categories}
              setSelectedDocPath={setSelectedDocPath}
              setSelectedDocTitle={setSelectedDocTitle}
              setDocContent={setDocContent}
            />
            <h2 className="wiki-content-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {/* 문서 아이콘 출력 */}
              {selectedDoc?.icon && (
                selectedDoc.icon.startsWith('http') ? (
                  <img
                    src={selectedDoc.icon}
                    alt="icon"
                    style={{ width: 32, height: 32, verticalAlign: 'middle', marginRight: 8, objectFit: 'contain', display: 'inline-block' }}
                  />
                ) : (
                  <span style={{ fontSize: 28, marginRight: 8 }}>{selectedDoc.icon}</span>
                )
              )}
              {selectedDocTitle || '렌독 위키'}
            </h2>
            <div className="wiki-content-body" ref={contentRef}>
              {isHeadCategory ? (
                <HeadGrid
                  heads={selectedDoc && Array.isArray(selectedDoc.heads) ? selectedDoc.heads : []}
                />
              ) : isNpcOrQuestCategory ? (
                <NpcGrid
                  npcs={selectedDoc && Array.isArray(selectedDoc.npcs) ? selectedDoc.npcs : []}
                />
              ) : (
                Array.isArray(docContent) && docContent.length > 0
                  ? <WikiReadRenderer content={docContent} />
                  : <div>문서를 찾을 수 없습니다.</div>
              )}
            </div>
          </main>
        </div>
        {/* ----- 목차 영역 ----- */}
        <aside className="wiki-toc-sidebar">
          <TableOfContents headings={tableOfContents} />
        </aside>
      </div>
      {/* ----- 우측 햄버거 메뉴 ----- */}
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
