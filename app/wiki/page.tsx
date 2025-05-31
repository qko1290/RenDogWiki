// File: app/wiki/page.tsx

/**
 * 위키 홈/문서 브라우저
 * - 카테고리 경로/문서 선택 -> 본문(HTML) 렌더
 */

'use client';

import './css/wiki.css';
import { useState, useEffect } from 'react';
import { renderSlateToHtml } from './lib/renderSlateToHtml';
import Link from 'next/link';
import HamburgerMenu from '../components/common/HamburgerMenu';
import { useSession } from 'next-auth/react';
import { buildCategoryTree } from '../wiki/lib/buildCategoryTree';

// 타입 정의
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

export default function WikiPage() {
  // 상태 정의
  const [categories, setCategories] = useState<CategoryNode[]>([]);
  const [openPaths, setOpenPaths] = useState<number[][]>([]);
  const [selectedDocPath, setSelectedDocPath] = useState<number[] | null>(null);
  const [selectedDocTitle, setSelectedDocTitle] = useState<string | null>(null);
  const [docContent, setDocContent] = useState<string>('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { data: session } = useSession();
  const [allDocuments, setAllDocuments] = useState<Document[]>([]);

  // 전체 문서 불러오기
  useEffect(() => {
    fetch('/api/documents?all=1')
      .then(res => res.json())
      .then(data => setAllDocuments(data));
  }, []);

  // 카테고리별 문서 필터
  const getDocumentsForCategory = (pathArr: number[]) => {
    const pathStr = pathArr.join('/');
    return allDocuments.filter(doc => doc.path === pathStr);
  };

  // 카테고리 트리 불러오기
  useEffect(() => {
    fetch('/api/categories')
      .then((res) => res.json())
      .then((data) => setCategories(buildCategoryTree(data)))
      .catch((err) => console.error('카테고리 로딩 실패:', err));
  }, []);

  // 네비 상태/트리 구조 처리
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

  // 문서 본문 fetch 및 렌더
  const fetchDoc = (categoryPath: number[], docTitle: string) => {
    setSelectedDocPath(categoryPath);
    setSelectedDocTitle(docTitle);
    fetch(`/api/documents?path=${encodeURIComponent(categoryPath.join('/'))}&title=${encodeURIComponent(docTitle)}`)
      .then((res) => {
        if (!res.ok) throw new Error('문서를 찾을 수 없습니다.');
        return res.json();
      })
      .then((data) => setDocContent(renderSlateToHtml(data.content)))
      .catch(() => setDocContent('<p>문서를 찾을 수 없습니다.</p>'));
  };

  // 트리/문서 네비게이션 렌더
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
            {/* 하위 카테고리 */}
            {node.children && node.children.length > 0 && isOpen && renderTree(node.children, currentPath)}
            {/* 하위 문서 리스트 */}
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

  // 전체 구조 렌더
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
        <button onClick={() => setIsMenuOpen(true)} className="text-white text-2xl absolute top-4 right-4">☰</button>
      </header>

      <div className="wiki-main">
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
                <span>{selectedDocPath.join(' > ')}</span>
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
      {isMenuOpen && (
        <HamburgerMenu
          onClose={() => setIsMenuOpen(false)}
          isLoggedIn={!!session?.minecraft}
          username={session?.minecraft?.name || ''}
          uuid={session?.minecraft?.uuid || ''}
        />
      )}
    </div>
  );
}
