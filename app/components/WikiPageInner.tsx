// =============================================
// File: app/components/WikiPageInner.tsx
// =============================================
/**
 * 위키 페이지 메인 영역 (본문/카테고리/목차/헤더 등)
 * - 카테고리 트리, 문서 트리, 대표문서 클릭, 문서 내용 로딩
 * - 목차 추출/브레드크럼/사이드바/수정 버튼
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { renderSlateToHtml } from '@wiki/lib/renderSlateToHtml';
import { extractHeadings } from '@/wiki/lib/extractHeadings';
import TableOfContents from '@/components/editor/TableOfContents';
import WikiHeader from "@/components/common/Header";
import '@wiki/css/wiki.css';
import Link from 'next/link';
import HamburgerMenu from '@/components/common/HamburgerMenu';
import { Descendant } from 'slate';
import { useRouter, useSearchParams } from 'next/navigation';

// 카테고리 타입 정의
type CategoryNode = {
  id: number;
  name: string;
  icon?: string;
  order?: number;
  document_id?: number;         // 대표 문서 ID
  children?: CategoryNode[];
};

// 문서 타입 정의
type Document = {
  id: number;
  title: string;
  path: string | number;
  icon?: string;
  fullPath?: number[];
  is_featured?: boolean;
};

// Props: 로그인 유저 정보
type Props = {
  user: {
    id: number;
    username: string;
    minecraft_name: string;
    email: string;
  } | null;
};

// 메인 컴포넌트
export default function WikiPageInner({ user }: Props) {
  // 상태 선언
  const [categories, setCategories] = useState<CategoryNode[]>([]);
  const [openPaths, setOpenPaths] = useState<number[][]>([]);
  const [selectedDocPath, setSelectedDocPath] = useState<number[] | null>(null);
  const [selectedDocTitle, setSelectedDocTitle] = useState<string | null>(null);
  const [docContent, setDocContent] = useState<string>('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [allDocuments, setAllDocuments] = useState<Document[]>([]);
  const [tableOfContents, setTableOfContents] = useState<any[]>([]);
  const [categoryIdToPathMap, setCategoryIdToPathMap] = useState<Record<number, number[]>>({});
  const [categoryIdMap, setCategoryIdMap] = useState<Record<number, CategoryNode>>({});
  const [selectedDocId, setSelectedDocId] = useState<number | null>(null);
  const [selectedCategoryPath, setSelectedCategoryPath] = useState<number[] | null>(null);

  const router = useRouter();
  const searchParams = useSearchParams();
  const contentRef = useRef<HTMLDivElement>(null);
  const selectedDoc = allDocuments.find(doc => doc.id === selectedDocId);

  // 전체 문서 불러오기
  useEffect(() => {
    fetch('/api/documents?all=1')
      .then(res => res.json())
      .then(data => {
        // 반드시 배열로 변환
        const docs = Array.isArray(data)
          ? data
          : Array.isArray(data.documents)
            ? data.documents
            : [];
        if (Object.keys(categoryIdToPathMap).length === 0) {
          setAllDocuments(docs);
          return;
        }
        // fullPath 붙여서 저장
        const mapped = docs.map((doc: Document & { path: number }) => ({
          ...doc,
          fullPath: categoryIdToPathMap[doc.path] || [doc.path],
        }));
        setAllDocuments(mapped);
      });
  }, [categoryIdToPathMap]);

  // 카테고리 -> path별 문서 리스트 필터
  const getDocumentsForCategory = (pathArr: number[]) => {
    return allDocuments.filter(
      (doc) => JSON.stringify(doc.fullPath) === JSON.stringify(pathArr) && !doc.is_featured
    );
  };

  // 카테고리 트리/ID -> 경로 맵/ID -> 노드맵 빌드
  useEffect(() => {
    fetch('/api/categories')
      .then((res) => res.json())
      .then((data) => {
        import('@wiki/lib/buildCategoryTree').then(mod => {
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
      .catch((err) => console.error('카테고리 로딩 실패:', err));
  }, []);

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

  // 카테고리 클릭(대표문서 있으면 본문 , 없으면 펼침/접힘만)
  const togglePath = async (path: number[]) => {
    const catId = path.at(-1)!;
    const category = categoryIdMap[catId];
    const isSamePath = selectedDocPath && JSON.stringify(selectedDocPath) === JSON.stringify(path);
    const isSameDoc = selectedDocId === category?.document_id;

    // 여기서 document_id가 정상적인 number(정수)인지 검사
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

        setSelectedDocId(doc.id);
        setSelectedDocPath([...path]);
        setSelectedDocTitle(doc.title);
        setSelectedCategoryPath(path);
        fetchDoc(path, doc.title, doc.id);

        setOpenPaths((prev) => {
          const alreadyOpen = prev.some((p) => JSON.stringify(p) === JSON.stringify(path));
          return alreadyOpen ? prev : [...prev, path];
        });
      } catch (err) {
        console.error('대표 문서 fetch 실패:', err);
      }
    } else if (!category?.document_id || !Number.isInteger(docId)) {
      alert('대표 문서 ID가 잘못되어 열 수 없습니다: ' + String(category?.document_id));
    }
  };

  // 화살표 클릭: 펼침/접힘만 (대표문서 열지 않음)
  const toggleArrowOnly = (path: number[]) => {
    setOpenPaths((prev) =>
      prev.some((p) => JSON.stringify(p) === JSON.stringify(path))
        ? prev.filter((p) => JSON.stringify(p) !== JSON.stringify(path))
        : [...prev, path]
    );
  };

  // 현재 경로가 열려있는지 여부
  const isPathOpen = (path: number[]) =>
    openPaths.some(p => JSON.stringify(p) === JSON.stringify(path));

  // 문서 불러오기 (카테고리/제목/ID)
  const fetchDoc = (
    categoryPath: number[],
    docTitle: string,
    docId?: number,
    options?: { clearCategoryPath?: boolean }
  ) => {
    if (options?.clearCategoryPath) {
      setSelectedCategoryPath(null); // 일반 문서 클릭 시 카테고리 active 해제
    }
    setSelectedDocTitle(docTitle);

    if (docId) {
      setSelectedDocId(docId);
      setSelectedDocPath([...categoryPath]);
    } else {
      const doc = allDocuments.find(
        (d) => d.title === docTitle && JSON.stringify(d.fullPath) === JSON.stringify(categoryPath)
      );
      if (doc) {
        setSelectedDocId(doc.id);
        setSelectedDocPath([...categoryPath]);
      }
    }

    fetch(`/api/documents?path=${String(categoryPath.at(-1))}&title=${encodeURIComponent(docTitle)}`)
      .then((res) => {
        if (!res.ok) throw new Error('문서를 찾을 수 없습니다.');
        return res.json();
      })
      .then((data) => {
        const content: Descendant[] = typeof data.content === 'string' ? JSON.parse(data.content) : data.content;
        const html = renderSlateToHtml(content);
        setDocContent(html);
        setTableOfContents(extractHeadings(content));
        if (data.fullPath && Array.isArray(data.fullPath)) {
          setSelectedDocPath([...data.fullPath]);
        }
      })
      .catch(() => setDocContent('<p>문서를 찾을 수 없습니다.</p>'));
  };

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

  // 카테고리/문서 트리 재귀 렌더링
  const renderTree = (nodes: CategoryNode[], parentPath: number[] = []) => {
    const result: JSX.Element[] = [];

    for (const node of nodes) {
      const currentPath = [...parentPath, node.id];
      const isOpen = isPathOpen(currentPath);
      const docs = getDocumentsForCategory(currentPath);
      const isCategoryActive =
        node.document_id != null &&
        selectedCategoryPath &&
        JSON.stringify(selectedCategoryPath) === JSON.stringify(currentPath);

      result.push(
        <li key={`cat-${node.id}`}>
          <button
            className={`wiki-nav-item ${isCategoryActive ? 'active' : ''}`}
            onClick={async () => {
              if (node.document_id != null) {
                const isActive =
                  selectedCategoryPath &&
                  JSON.stringify(selectedCategoryPath) === JSON.stringify(currentPath);

                if (!isActive) {
                  await togglePath(currentPath); // 대표문서 열기
                } else {
                  toggleArrowOnly(currentPath); // 이미 열려 있으면 펼침/접힘만
                }
              } else {
                // 대표 문서 없으면 펼침/접힘만
                toggleArrowOnly(currentPath);
              }
            }}
          >
            {node.icon && (
              <span className="wiki-category-icon" style={{ marginRight: '0.3em' }}>
                {node.icon.startsWith('http') ? (
                  <img src={node.icon} alt="icon" style={{ width: '1em', verticalAlign: 'middle' }} />
                ) : (
                  node.icon
                )}
              </span>
            )}
            <span className="wiki-category-label">{node.name}</span>
            {(node.children?.length || docs.length) > 0 && (
              <span
                className="wiki-category-arrow"
                style={{
                  cursor: 'pointer',
                  opacity: node.document_id != null ? 1 : 0.5,
                }}
                onClick={async (e) => {
                  e.stopPropagation();
                  // 대표 문서가 있으면 먼저 대표 문서 열림 -> 펼침/접힘
                  if (node.document_id != null) {
                    const isActive =
                      selectedCategoryPath &&
                      JSON.stringify(selectedCategoryPath) === JSON.stringify(currentPath);

                    if (!isActive) {
                      await togglePath(currentPath);
                    } else {
                      toggleArrowOnly(currentPath);
                    }
                  }
                }}
              >
                {isOpen ? '▼' : '▶'}
              </span>
            )}
          </button>
          {isOpen && (
            <ul className="wiki-doc-list">
              {docs.map(doc => {
                const isDocActive = selectedDocId === doc.id;
                return (
                  <li
                    key={`doc-${doc.title}`}
                    className={`wiki-doc-item ${isDocActive ? 'active' : ''}`}
                    onClick={() => fetchDoc(currentPath, doc.title, doc.id, { clearCategoryPath: true })}
                  >
                    <span style={{ marginRight: '0.3em' }}>
                      {doc.icon?.startsWith('http') ? (
                        <img src={doc.icon} alt="icon" style={{ width: '1em', verticalAlign: 'middle' }} />
                      ) : (
                        doc.icon || '📄'
                      )}
                    </span>
                    {doc.title}
                  </li>
                );
              })}
              {node.children && renderTree(node.children, currentPath)}
            </ul>
          )}
        </li>
      );
    }
    return result;
  };

  // 현재 경로로 브레드크럼(카테고리 이름) 추출
  const getCategoryNamesFromPath = (tree: CategoryNode[], path: number[]): string[] => {
    const names: string[] = [];
    let currentTree = tree;
    for (const id of path) {
      const match = currentTree.find(node => node.id === id);
      if (!match) break;
      names.push(match.name);
      currentTree = match.children || [];
    }
    return names;
  };

  // 렌더: 헤더/사이드바/목차/본문/수정/햄버거
  return (
    <div className="wiki-container">
      <WikiHeader user={user} />
      <div className="wiki-layout">
        <div className="wiki-main-scrollable">
          {/* 사이드바(카테고리) */}
          <aside className="wiki-sidebar">
            <h2 className="wiki-sidebar-title">카테고리</h2>
            <ul className="wiki-nav-list">{renderTree(categories)}</ul>
          </aside>

          {/* 본문 영역 */}
          <main className="wiki-content">
            {/* 브레드크럼 */}
            <div className="wiki-breadcrumb">
              {selectedDocPath ? (
                <div className="wiki-breadcrumb-flex">
                  <button
                    className="wiki-back-button"
                    onClick={() => {
                      setSelectedDocPath(null);
                      setSelectedDocTitle(null);
                      setDocContent('');
                    }}
                  >
                    ←
                  </button>
                  <span>{getCategoryNamesFromPath(categories, selectedDocPath).join(' > ')}</span>
                </div>
              ) : (
                <span>렌독 위키 - 문서 목록</span>
              )}
            </div>
            <h2 className="wiki-content-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {/* 문서 아이콘 (있으면) */}
              {selectedDoc?.icon && (
                selectedDoc.icon.startsWith('http') ? (
                  <img
                    src={selectedDoc.icon}
                    alt="icon"
                    style={{
                      width: 32, height: 32, verticalAlign: 'middle',
                      marginRight: 8, objectFit: 'contain', display: 'inline-block'
                    }}
                  />
                ) : (
                  <span style={{ fontSize: 28, marginRight: 8 }}>{selectedDoc.icon}</span>
                )
              )}
              {selectedDocTitle || '렌독 위키'}
            </h2>
            {/* 본문 */}
            <div
              className="wiki-content-body"
              ref={contentRef}
              dangerouslySetInnerHTML={{ __html: docContent || '오른쪽 본문 영역입니다.' }}
            />
          </main>
        </div>

        {/* 목차(heading) */}
        {/* 목차(heading) - 항상 고정 렌더링 */}
        <aside className="wiki-toc-sidebar">
          {tableOfContents.length > 0 ? (
            <ul>
              {tableOfContents.map((heading, idx) => (
                <li
                  key={idx}
                  style={{ marginLeft: `${(heading.level - 1) * 16}px`, lineHeight: 1.8 }}
                >
                  <a
                    href={`#${heading.id}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      textDecoration: 'none',
                      color: 'inherit',
                      minHeight: 24,
                      marginBottom: 6
                    }}
                  >
                    {heading.icon?.startsWith('http') ? (
                      <img
                        src={heading.icon}
                        alt="icon"
                        style={{
                          width: 26,         // 13 * 2 = 26px
                          height: 26,
                          verticalAlign: 'middle',
                          marginRight: 3,
                          objectFit: 'contain',
                          display: 'inline-block'
                        }}
                      />
                    ) : (
                      <span style={{ fontSize: 20, marginRight: 3 }}>{heading.icon}</span>
                    )}
                    <span style={{ fontSize: 20, fontWeight: 'bold' }}>{heading.text}</span>
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <div style={{ color: '#bbb', padding: '1rem', fontSize: '0.96em', textAlign: 'center' }}>
              목차 없음
            </div>
          )}
        </aside>

      </div>

      {/* 우측 햄버거 메뉴 */}
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
