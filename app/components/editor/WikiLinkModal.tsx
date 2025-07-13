// =============================================
// File: app/components/editor/WikiLinkModal.tsx
// =============================================

'use client';

import React, { useEffect, useState } from 'react';

// 타입 정의
type Category = {
  id: number;
  name: string;
  parent_id: number | null;
  order: number;
  icon?: string;
  children?: Category[];
};
type Document = {
  id: number;
  title: string;
  path: string;
  icon?: string;
  tags?: string[];
  fullPath?: number[];
};

// 카테고리 트리 빌드 함수
function buildTree(list: Category[]): Category[] {
  const map = new Map<number, Category>();
  list.forEach((item) => map.set(item.id, { ...item, children: [] }));
  const roots: Category[] = [];
  list.forEach((item) => {
    const node = map.get(item.id)!;
    if (item.parent_id === null || item.parent_id === 0) roots.push(node);
    else {
      const parent = map.get(item.parent_id);
      if (parent) parent.children!.push(node);
    }
  });
  for (const [, node] of map) node.children!.sort((a, b) => (a.order || 0) - (b.order || 0));
  return roots.sort((a, b) => (a.order || 0) - (b.order || 0));
}

// 재귀 트리 컴포넌트
function Tree({
  nodes,
  open,
  onToggle,
  onSelect,
  selectedId,
  path = [],
}: {
  nodes: Category[];
  open: Set<number>;
  onToggle: (id: number) => void;
  onSelect: (node: Category, path: number[]) => void;
  selectedId: number | null;
  path?: number[];
}) {
  return (
    <ul style={{ margin: 0, paddingLeft: 10 }}>
      {nodes.map((node) => {
        const hasChildren = node.children && node.children.length > 0;
        const isOpen = open.has(node.id);
        const isSelected = selectedId === node.id;
        return (
          <li key={node.id} style={{ marginBottom: 2 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                background: isSelected ? '#eaf2ff' : undefined,
                borderRadius: 6,
                padding: '2px 4px',
                cursor: 'pointer',
                fontWeight: isSelected ? 600 : 400,
                fontSize: 15,
              }}
              onClick={() => onSelect(node, [...path, node.id])}
            >
              {hasChildren && (
                <button
                  style={{
                    border: 'none',
                    background: 'none',
                    fontSize: 14,
                    cursor: 'pointer',
                    marginRight: 2,
                  }}
                  onClick={e => { e.stopPropagation(); onToggle(node.id); }}
                >
                  {isOpen ? '▼' : '▶'}
                </button>
              )}
              <span style={{ marginRight: 4 }}>{node.icon ?? ''}</span>
              <span>{node.name}</span>
            </div>
            {hasChildren && isOpen && (
              <Tree
                nodes={node.children!}
                open={open}
                onToggle={onToggle}
                onSelect={onSelect}
                selectedId={selectedId}
                path={[...path, node.id]}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}

// 메인 WikiLinkModal
export default function WikiLinkModal({
  open,
  onClose,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (doc: Document) => void;
}) {
  // 모든 상태를 open=true 진입시에만 생성 (불필요 렌더 X)
  const [categories, setCategories] = useState<Category[]>([]);
  const [tree, setTree] = useState<Category[]>([]);
  const [openSet, setOpenSet] = useState<Set<number>>(new Set([0]));
  const [selectedCat, setSelectedCat] = useState<Category | null>(null);
  const [selectedCatPath, setSelectedCatPath] = useState<number[]>([]);
  const [allDocs, setAllDocs] = useState<Document[]>([]);
  const [filteredDocs, setFilteredDocs] = useState<Document[]>([]);
  const [search, setSearch] = useState('');
  const [selectedDocId, setSelectedDocId] = useState<number | null>(null);

  // 상태 초기화 및 fetch (모달 열릴때만)
  useEffect(() => {
    if (!open) return;

    const handleKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
    };

    const handleClick = (e: MouseEvent) => {
        const modal = document.getElementById('wiki-link-modal');
        // 모달 바깥 클릭만 닫힘
        if (modal && !modal.contains(e.target as Node)) onClose();
    };

    setOpenSet(new Set([0]));
    setSelectedCat(null);
    setSelectedCatPath([]);
    setSelectedDocId(null);
    setSearch('');
    setFilteredDocs([]);
    
    (async () => {
        const catRes = await fetch('/api/categories');
        const cats = await catRes.json();
        setCategories(cats);
        setTree([
        {
            id: 0,
            name: 'RenDog Wiki',
            parent_id: null,
            order: 0,
            icon: '📚',
            children: buildTree(cats),
        },
        ]);
        const docRes = await fetch('/api/documents?all=1');
        const docs = await docRes.json();
        setAllDocs(docs);
    })();

    window.addEventListener('keydown', handleKey);
    window.addEventListener('mousedown', handleClick);

    return () => {
        window.removeEventListener('keydown', handleKey);
        window.removeEventListener('mousedown', handleClick);
    };
    }, [open, onClose]);

  // 카테고리 선택 시 문서 필터링
  useEffect(() => {
    if (!selectedCat) { setFilteredDocs([]); return; }
    const catPath = selectedCatPath[0] === 0 ? selectedCatPath.slice(1) : selectedCatPath;
    setFilteredDocs(allDocs.filter(doc =>
      doc.fullPath
        ? JSON.stringify(doc.fullPath) === JSON.stringify(catPath)
        : Number(doc.path) === catPath.at(-1)
    ));
    setSelectedDocId(null);
  }, [selectedCat, selectedCatPath, allDocs]);

  // 검색 적용
  const docsToShow = search.trim()
    ? allDocs.filter(doc =>
        doc.title.toLowerCase().includes(search.toLowerCase())
      )
    : filteredDocs;

  // ESC 닫기/외부 클릭 닫기
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    const handleClick = (e: MouseEvent) => {
      const modal = document.getElementById('wiki-link-modal');
      if (modal && !modal.contains(e.target as Node)) onClose();
    };
    window.addEventListener('keydown', handleKey);
    window.addEventListener('mousedown', handleClick);
    return () => {
      window.removeEventListener('keydown', handleKey);
      window.removeEventListener('mousedown', handleClick);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(30,40,60,0.18)', zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        id="wiki-link-modal"
        style={{
          background: '#fff',
          borderRadius: 16,
          boxShadow: '0 6px 30px #0012',
          minWidth: 540, maxWidth: 680,
          minHeight: 360, maxHeight: '72vh',
          padding: 0, display: 'flex', flexDirection: 'column',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{
          padding: '18px 20px 12px 20px',
          borderBottom: '1.5px solid #f2f4f6',
          fontWeight: 700,
          fontSize: 18,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          내부 문서 링크 선택
          <button
            onClick={onClose}
            style={{
              background: '#f2f2f2', border: 'none', borderRadius: 6,
              fontWeight: 600, fontSize: 18, cursor: 'pointer', padding: '2px 10px',
            }}
          >닫기</button>
        </div>
        <div style={{
          display: 'flex', flex: 1, minHeight: 0, maxHeight: 480,
        }}>
          {/* 좌: 트리 */}
          <div style={{ width: 210, borderRight: '1.5px solid #f2f4f6', overflowY: 'auto', padding: 12 }}>
            <Tree
              nodes={tree}
              open={openSet}
              onToggle={id => setOpenSet(prev => {
                const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s;
              })}
              onSelect={(cat, path) => { setSelectedCat(cat); setSelectedCatPath(path); }}
              selectedId={selectedCat?.id ?? null}
            />
          </div>
          {/* 우: 문서 목록 */}
          <div style={{ flex: 1, padding: 16, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            <input
              placeholder="문서 제목 검색"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%',
                fontSize: 15,
                marginBottom: 10,
                padding: '6px 10px',
                border: '1px solid #eee',
                borderRadius: 7,
                background: '#fcfcfc',
              }}
            />
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
              {docsToShow.length === 0 ? (
                <div style={{ color: '#aaa', padding: 28, textAlign: 'center', fontSize: 15 }}>문서가 없습니다.</div>
              ) : (
                <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {docsToShow.map(doc => (
                    <li
                      key={doc.id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        background: doc.id === selectedDocId ? '#e7f6ff' : 'none',
                        borderRadius: 8,
                        padding: '8px 9px',
                        marginBottom: 2,
                        cursor: 'pointer',
                        fontWeight: doc.id === selectedDocId ? 600 : 400,
                      }}
                      onClick={() => setSelectedDocId(doc.id)}
                      onDoubleClick={() => { setSelectedDocId(doc.id); onSelect(doc); }}
                    >
                      <span style={{ fontSize: 19, marginRight: 4 }}>{doc.icon ?? '📄'}</span>
                      <span style={{
                        flex: 1,
                        textOverflow: 'ellipsis',
                        overflow: 'hidden',
                        whiteSpace: 'nowrap',
                        fontSize: 15,
                      }}>{doc.title}</span>
                      {Array.isArray(doc.tags) && doc.tags.length > 0 && (
                        <span style={{
                          fontSize: 12,
                          color: '#7b97a4',
                          background: '#f5f7fa',
                          borderRadius: 8,
                          padding: '1px 8px',
                          marginLeft: 2,
                        }}>
                          #{doc.tags[0]}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div style={{ marginTop: 10, textAlign: 'right' }}>
              <button
                onClick={() => {
                  const doc = docsToShow.find(d => d.id === selectedDocId);
                  if (doc) onSelect(doc);
                }}
                disabled={!selectedDocId}
                style={{
                  background: '#2686f8', color: '#fff',
                  padding: '7px 24px',
                  fontSize: 15,
                  border: 'none', borderRadius: 8,
                  fontWeight: 600,
                  cursor: selectedDocId ? 'pointer' : 'not-allowed',
                  opacity: selectedDocId ? 1 : 0.65,
                }}
              >선택</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
