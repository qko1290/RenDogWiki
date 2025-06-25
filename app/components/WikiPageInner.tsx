// File: app/wiki/components/WikiPageInner.tsx

'use client';

// import './WikiPageInner.css';
import { useState, useEffect } from 'react';
import { renderSlateToHtml } from '@wiki/lib/renderSlateToHtml';
import { extractHeadings } from '@/wiki/lib/extractHeadings';
import TableOfContents from '@/components/editor/TableOfContents';
// import '@wiki/css/WikiPageInner.css';
import Link from 'next/link';
import HamburgerMenu from '@/components/common/HamburgerMenu';
import { Descendant } from 'slate';

type CategoryNode = {
  id: number;
  name: string;
  order?: number;
  children?: CategoryNode[];
};

type Document = {
  title: string;
  path: string;
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

  useEffect(() => {
    fetch('/api/documents?all=1')
      .then(res => res.json())
      .then(data => setAllDocuments(data));
  }, []);

  const getDocumentsForCategory = (pathArr: number[]) => {
    const pathStr = pathArr.join('/');
    return allDocuments.filter(doc => doc.path === pathStr);
  };

  useEffect(() => {
    fetch('/api/categories')
      .then((res) => res.json())
      .then((data) => import('@wiki/lib/buildCategoryTree').then(mod => setCategories(mod.buildCategoryTree(data))))
      .catch((err) => console.error('카테고리 로딩 실패:', err));
  }, []);

  const togglePath = (path: number[]) => {
    setOpenPaths(prev =>
      prev.some(p => JSON.stringify(p) === JSON.stringify(path))
        ? prev.filter(p => JSON.stringify(p) !== JSON.stringify(path))
        : [...prev, path]
    );
  };

  const isPathOpen = (path: number[]) =>
    openPaths.some(p => JSON.stringify(p) === JSON.stringify(path));
  const isLeaf = (node: CategoryNode) => !node.children || node.children.length === 0;

  const fetchDoc = (categoryPath: number[], docTitle: string) => {
    setSelectedDocPath(categoryPath);
    setSelectedDocTitle(docTitle);
    fetch(`/api/documents?path=${encodeURIComponent(categoryPath.join('/'))}&title=${encodeURIComponent(docTitle)}`)
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

  const renderTree = (nodes: CategoryNode[], parentPath: number[] = []) => (
    <ul className={parentPath.length > 0 ? 'wiki-sub-nav-list' : 'wiki-nav-list'}>
      {nodes.map((node) => {
        const currentPath = [...parentPath, node.id];
        const isOpen = isPathOpen(currentPath);
        const isActive = selectedDocPath &&
          JSON.stringify(selectedDocPath) === JSON.stringify(currentPath);
        const docs = getDocumentsForCategory(currentPath);

        return (
          <li key={node.id}>
            <button
              className={
                parentPath.length > 0
                  ? `wiki-sub-nav-item ${isActive ? 'active' : ''}`
                  : `wiki-nav-item ${isOpen ? 'active' : ''}`
              }
              onClick={() => togglePath(currentPath)}
            >
              {node.name}
              {node.children && node.children.length > 0 && (
                <span className="wiki-arrow">{isOpen ? '▼' : '▶'}</span>
              )}
            </button>
            {node.children && node.children.length > 0 && isOpen && renderTree(node.children, currentPath)}
            {isOpen && docs.length > 0 && (
              <ul className="wiki-doc-list">
                {docs.map(doc => (
                  <li
                    key={doc.title}
                    className="wiki-doc-item"
                    onClick={() => fetchDoc(currentPath, doc.title)}
                  >
                    📄 {doc.title}
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );

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
      <header className="wiki-header">
        <h1 className="wiki-logo">RDWIKI</h1>
        <div className="wiki-search-container">
          <div className="flex items-center justify-center gap-4 w-full">
            <input
              type="text"
              placeholder="검색어를 입력하세요..."
              className="w-1/2 px-4 py-2 rounded bg-slate-700 text-white placeholder-gray-400"
            />
          </div>
        </div>
        <button
          onClick={() => setIsMenuOpen(true)}
          className="text-white text-2xl absolute top-4 right-4"
        >
          ☰
        </button>
      </header>

      {/* ✅ 스크롤/레이아웃 구조 수정됨 */}
      <div className="wiki-layout">
        {/* 왼쪽: 사이드바 + 본문 (스크롤 가능) */}
        <div className="wiki-main-scrollable">
          <aside className="wiki-sidebar">
            <h2 className="wiki-sidebar-title">카테고리</h2>
            {renderTree(categories)}
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
            <h2 className="wiki-content-title">
              {selectedDocTitle || '렌독 위키'}
            </h2>

            {selectedDocPath && selectedDocPath.length > 0 && selectedDocTitle && (
              <div style={{ marginBottom: '1rem' }}>
                <Link
                  href={`/wiki/write?path=${selectedDocPath.join(
                    '/'
                  )}&title=${encodeURIComponent(selectedDocTitle)}`}
                  className="edit-button"
                >
                  수정
                </Link>
              </div>
            )}
            <div
              className="wiki-content-body"
              dangerouslySetInnerHTML={{
                __html: docContent || '오른쪽 본문 영역입니다.',
              }}
            />
          </main>
        </div>

        {/* 오른쪽 고정 목차 */}
        {tableOfContents.length > 0 && (
          <aside className="wiki-toc-sidebar">
            <ul>
              {tableOfContents.map((heading, idx) => (
                <li
                  key={idx}
                  style={{
                    marginLeft: `${(heading.level - 1) * 16}px`,
                    lineHeight: 1.8,
                  }}
                >
                  <a href={`#${heading.id}`}>
                    {heading.icon} {heading.text}
                  </a>
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
