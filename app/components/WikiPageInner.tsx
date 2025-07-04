// File: app/wiki/components/WikiPageInner.tsx

'use client';

import { useState, useEffect } from 'react';
import { renderSlateToHtml } from '@wiki/lib/renderSlateToHtml';
import { extractHeadings } from '@/wiki/lib/extractHeadings';
import TableOfContents from '@/components/editor/TableOfContents';
import WikiHeader from "@/components/common/Header";
import '@wiki/css/wiki.css';
import Link from 'next/link';
import HamburgerMenu from '@/components/common/HamburgerMenu';
import { Descendant } from 'slate';

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

  useEffect(() => {
    fetch('/api/documents?all=1')
      .then(res => res.json())
      .then(data => {
        if (Object.keys(categoryIdToPathMap).length === 0) {
          setAllDocuments(data);
          return;
        }
        const mapped = data.map((doc: Document & { path: number }) => ({
          ...doc,
          fullPath: categoryIdToPathMap[doc.path] || [doc.path],
        }));
        setAllDocuments(mapped);
      });
  }, [categoryIdToPathMap]);

  const getDocumentsForCategory = (pathArr: number[]) => {
    return allDocuments.filter(
      (doc) => JSON.stringify(doc.fullPath) === JSON.stringify(pathArr) && !doc.is_featured
    );
  };

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

  const togglePath = async (path: number[]) => {
  const catId = path.at(-1)!;
  const category = categoryIdMap[catId];

  const isSamePath = selectedDocPath && JSON.stringify(selectedDocPath) === JSON.stringify(path);
  const isSameDoc = selectedDocId === category?.document_id;

  if (category?.document_id && (!isSamePath || !isSameDoc)) {
    try {
      const res = await fetch(`/api/documents?id=${category.document_id}`);
      if (!res.ok) throw new Error('대표 문서를 찾을 수 없습니다');
      const doc = await res.json();

      setSelectedDocId(doc.id);
      setSelectedDocPath([...path]);
      setSelectedDocTitle(doc.title);
      setSelectedCategoryPath(path);
      fetchDoc(path, doc.title, doc.id);

      // 대표 문서를 연 직후 반드시 펼쳐진 상태로!
      setOpenPaths((prev) => {
        // 이미 열려있으면 그대로, 아니면 추가
        const alreadyOpen = prev.some((p) => JSON.stringify(p) === JSON.stringify(path));
        return alreadyOpen ? prev : [...prev, path];
      });
    } catch (err) {
      console.error('대표 문서 fetch 실패:', err);
    }
  } else {
    // 대표 문서 없는 카테고리는 기존대로(펼침/접힘만)
    setOpenPaths((prev) => {
      const isExpanded = prev.some((p) => JSON.stringify(p) === JSON.stringify(path));
      return isExpanded ? prev.filter((p) => JSON.stringify(p) !== JSON.stringify(path)) : [...prev, path];
    });
  }
};

  const toggleArrowOnly = (path: number[]) => {
    setOpenPaths((prev) =>
      prev.some((p) => JSON.stringify(p) === JSON.stringify(path))
        ? prev.filter((p) => JSON.stringify(p) !== JSON.stringify(path))
        : [...prev, path]
    );
  };

  const isPathOpen = (path: number[]) =>
    openPaths.some(p => JSON.stringify(p) === JSON.stringify(path));

  const fetchDoc = (
    categoryPath: number[],
    docTitle: string,
    docId?: number,
    options?: { clearCategoryPath?: boolean }  // ← 옵션 추가
  ) => {
    if (options?.clearCategoryPath) {
      setSelectedCategoryPath(null); // 문서 클릭에서만 카테고리 active 해제
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
      })
      .catch(() => setDocContent('<p>문서를 찾을 수 없습니다.</p>'));
  };

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
                  await togglePath(currentPath); // 대표 문서만 열기
                } else {
                  toggleArrowOnly(currentPath); // 이미 열려 있으면 펼침/접힘
                }
              } else {
                // 대표 문서가 없으면 바로 토글
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
                  cursor:
                    node.document_id != null &&
                    selectedCategoryPath &&
                    JSON.stringify(selectedCategoryPath) === JSON.stringify(currentPath)
                      ? 'pointer'
                      : 'pointer', // 일단 pointer로 두고 비활성화는 시각적 효과만 주자(아래서 컨트롤)
                  opacity:
                    node.document_id != null ? 1 : 0.5,
                }}
                onClick={async (e) => {
                  e.stopPropagation();
                  // 대표 문서가 있으면, 먼저 대표 문서가 열려 있는지 확인
                  if (node.document_id != null) {
                    const isActive =
                      selectedCategoryPath &&
                      JSON.stringify(selectedCategoryPath) === JSON.stringify(currentPath);

                    if (!isActive) {
                      // 대표 문서가 안 열려있으면 먼저 연다!
                      await togglePath(currentPath);
                      // 열고 나서 펼침/접힘 실행(이미 열려있는 경우라면 togglePath에서 처리됨)
                    } else {
                      // 이미 열려 있으면 그냥 토글만
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
                    onClick={() => fetchDoc(currentPath, doc.title, doc.id, { clearCategoryPath: true })}  // ← 옵션 추가
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

  return (
    <div className="wiki-container">
      <WikiHeader user={user} />
      <div className="wiki-layout">
        <div className="wiki-main-scrollable">
          <aside className="wiki-sidebar">
            <h2 className="wiki-sidebar-title">카테고리</h2>
            <ul className="wiki-nav-list">{renderTree(categories)}</ul>
          </aside>

          <main className="wiki-content">
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
            <h2 className="wiki-content-title">{selectedDocTitle || '렌독 위키'}</h2>

            {selectedDocPath && selectedDocPath.length > 0 && selectedDocTitle && (
              <div style={{ marginBottom: '1rem' }}>
                <Link
                  href={`/wiki/write?path=${selectedDocPath.join('/')}&title=${encodeURIComponent(selectedDocTitle)}`}
                  className="edit-button"
                >
                  수정
                </Link>
              </div>
            )}
            <div
              className="wiki-content-body"
              dangerouslySetInnerHTML={{ __html: docContent || '오른쪽 본문 영역입니다.' }}
            />
          </main>
        </div>

        {tableOfContents.length > 0 && (
          <aside className="wiki-toc-sidebar">
            <ul>
              {tableOfContents.map((heading, idx) => (
                <li
                  key={idx}
                  style={{ marginLeft: `${(heading.level - 1) * 16}px`, lineHeight: 1.8 }}
                >
                  <a href={`#${heading.id}`}>{heading.icon} {heading.text}</a>
                </li>
              ))}
            </ul>
          </aside>
        )}
      </div>

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
