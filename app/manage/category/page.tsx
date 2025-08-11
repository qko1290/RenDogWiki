// =============================================
// File: app/manage/category/page.tsx
// =============================================
/**
 * 카테고리 관리 페이지 (모달 리팩터링)
 * - 트리형 카테고리(드래그 정렬, 중첩), 문서 목록, 상세/수정/생성/삭제/하위 추가
 * - 카테고리 추가/삭제: rd-card 모달 적용 (이미지 관리 페이지 스타일과 동일)
 */

'use client';

import { useEffect, useState } from 'react';
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, arrayMove, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import WikiHeader from "@/components/common/Header";
import '@wiki/css/manage-category.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faList, faBook } from '@fortawesome/free-solid-svg-icons';
import ImageSelectModal from "@/components/image/ImageSelectModal";

// ===== 타입 =====
type Category = {
  id: number;
  name: string;
  parent_id: number | null;
  order: number;
  document_path?: string;
  icon?: string;
  children: Category[];
};

type Document = {
  id: number;
  title: string;
  path: string;
  created_at: string;
  updated_at: string;
  icon?: string;
  tags?: string;
  is_featured: boolean;
  fullPath?: number[];
};

const noSpell = {
  spellCheck: false,
  autoComplete: 'off' as const,
  autoCorrect: 'off' as const,
  autoCapitalize: 'off' as const,
};

// ===== 공용 얇은 모달 =====
function BareModal({
  open, onClose, children,
}: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div
      className="rd-overlay"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {children}
    </div>
  );
}

// ===== 트리 아이템 =====
function SortableCategoryItem({
  node, selected, open, onClick, onToggleOpen, children,
}: {
  node: Category;
  selected: Category | null;
  open: Set<number>;
  onClick: () => void;
  onToggleOpen: (id: number) => void;
  children?: React.ReactNode;
}) {
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id: node.id.toString() });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <li ref={setNodeRef} className="sortable-category-item" style={style} {...attributes}>
      <div className={`category-row${selected?.id === node.id ? " active" : ""}`}>
        <span className="grab-handle" {...listeners}>⠿</span>
        <span
          className="category-label"
          onClick={onClick}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          {node.icon
            ? node.icon.startsWith('http')
              ? (
                <img
                  src={node.icon}
                  alt="icon"
                  style={{ width: 20, height: 20, borderRadius: 6, objectFit: 'cover' }}
                />
              )
              : <span>{node.icon}</span>
            : null}
          <span>{node.name}</span>
        </span>
        {node.children.length > 0 && (
          <button
            onClick={(e) => { e.stopPropagation(); onToggleOpen(node.id); }}
            className="category-toggle-btn"
            tabIndex={-1}
          >
            {open.has(node.id) ? '▼' : '▶'}
          </button>
        )}
      </div>
      {children && <div className="category-tree-children">{children}</div>}
    </li>
  );
}

// ===== 메인 =====
export default function CategoryManager() {
  const [user, setUser] = useState<any>(null);

  // 상태
  const [tree, setTree] = useState<Category[]>([]);
  const [open, setOpen] = useState<Set<number>>(new Set());
  const [selected, setSelected] = useState<Category | null>(null);
  const [selectedCategoryPath, setSelectedCategoryPath] = useState<number[]>([]);
  const [allDocuments, setAllDocuments] = useState<Document[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [categoryIdToPathMap, setCategoryIdToPathMap] = useState<Record<number, number[]>>({});
  const [showImageModal, setShowImageModal] = useState(false);

  // 모달 상태 (추가/삭제)
  const [newCatOpen, setNewCatOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [loadingCreate, setLoadingCreate] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [loadingDelete, setLoadingDelete] = useState(false);

  // DnD 센서
  const sensors = useSensors(useSensor(PointerSensor));

  // 유저
  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => res.ok ? res.json() : null)
      .then(data => setUser(data?.user ?? null));
  }, []);

  // 카테고리 & 토글 핸들러
  useEffect(() => {
    fetchCategories();
    const handleToggleOpen = (e: any) => { if (e.detail) toggleOpen(e.detail); };
    window.addEventListener("toggleOpen", handleToggleOpen);
    return () => window.removeEventListener("toggleOpen", handleToggleOpen);
  }, []);

  // 문서
  useEffect(() => {
    fetch('/api/documents?all=1')
      .then(res => res.json())
      .then(data => {
        if (Object.keys(categoryIdToPathMap).length === 0) {
          setAllDocuments(data);
          return;
        }
        const mapped = data.map((doc: Document & { path: number | string }) => ({
          ...doc,
          fullPath: categoryIdToPathMap[Number(doc.path)] || [Number(doc.path)],
        }));
        setAllDocuments(mapped);
      });
  }, [categoryIdToPathMap]);

  // 카테고리 선택
  const handleCategorySelect = (node: Category, currentPath: number[]) => {
    setSelected(node);
    setSelectedDoc(null);
    setSelectedCategoryPath(currentPath);
  };

  // 문서 필터
  const filteredDocs = allDocuments.filter(doc => {
    if (!selectedCategoryPath.length) return false;
    const categoryPath = selectedCategoryPath[0] === 0 ? selectedCategoryPath.slice(1) : selectedCategoryPath;
    if (doc.fullPath) return JSON.stringify(doc.fullPath) === JSON.stringify(categoryPath);
    return Number(doc.path) === categoryPath.at(-1);
  });
  const featuredDoc = filteredDocs.find(doc => doc.is_featured);
  const otherDocs = filteredDocs.filter(doc => !doc.is_featured);

  // 카테고리 fetch + 맵 생성
  const fetchCategories = async () => {
    const res = await fetch('/api/categories');
    const flat: Category[] = await res.json();
    const built = buildTree(flat);

    const idToPathMap: Record<number, number[]> = {};
    (function buildMap(nodes: Category[], path: number[] = []) {
      for (const node of nodes) {
        const currentPath = [...path, node.id];
        idToPathMap[node.id] = currentPath;
        if (node.children.length) buildMap(node.children, currentPath);
      }
    })(built);
    setCategoryIdToPathMap(idToPathMap);

    setTree([{
      id: 0,
      name: 'RenDog Wiki',
      parent_id: null,
      order: 0,
      icon: '📚',
      document_path: '',
      children: built,
    }]);
  };

  const buildTree = (list: Category[]): Category[] => {
    const map = new Map<number, Category>();
    list.forEach(item => map.set(item.id, { ...item, children: [] }));
    const roots: Category[] = [];
    list.forEach(item => {
      const node = map.get(item.id)!;
      if (item.parent_id === null || item.parent_id === 0) roots.push(node);
      else {
        const parent = map.get(item.parent_id);
        if (parent) parent.children.push(node);
      }
    });
    for (const [, node] of map) node.children.sort((a, b) => a.order - b.order);
    return roots.sort((a, b) => a.order - b.order);
  };

  const toggleOpen = (id: number) => {
    setOpen(prev => {
      const copy = new Set(prev);
      copy.has(id) ? copy.delete(id) : copy.add(id);
      return copy;
    });
  };

  // DnD 정렬
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeId = parseInt(active.id as string);
    const overId = parseInt(over.id as string);

    const newTree = structuredClone(tree);
    const parentA = findParent(newTree, activeId);
    const parentB = findParent(newTree, overId);
    if (!parentA || !parentB || parentA !== parentB) return;

    const oldIndex = parentA.children.findIndex(c => c.id === activeId);
    const newIndex = parentA.children.findIndex(c => c.id === overId);
    if (oldIndex === -1 || newIndex === -1) return;

    parentA.children = arrayMove(parentA.children, oldIndex, newIndex);
    setTree(newTree);

    if (selected) {
      const newSelected = findCategoryById(newTree, selected.id);
      if (newSelected) setSelected(newSelected);
    }

    parentA.children.forEach((item, idx) => {
      fetch(`/api/categories/${item.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: idx }),
      });
    });
  };

  const findCategoryById = (nodes: Category[], id: number): Category | null => {
    for (const node of nodes) {
      if (node.id === id) return node;
      const found = findCategoryById(node.children, id);
      if (found) return found;
    }
    return null;
  };

  const findParent = (nodes: Category[], childId: number): Category | null => {
    for (const node of nodes) {
      if (node.children.some(c => c.id === childId)) return node;
      const deeper = findParent(node.children, childId);
      if (deeper) return deeper;
    }
    return null;
  };

  // 카테고리 생성/삭제 요청
  const createCategory = async () => {
    if (!selected) return;
    const name = newCatName.trim();
    if (!name) return;
    try {
      setLoadingCreate(true);
      await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, parent_id: selected.id, order: 0, icon: '' }),
      });
      setNewCatOpen(false);
      setNewCatName('');
      await fetchCategories();
    } finally {
      setLoadingCreate(false);
    }
  };

  const deleteCategory = async () => {
    if (!selected || selected.id === 0) return;
    try {
      setLoadingDelete(true);
      await fetch(`/api/categories/${selected.id}`, { method: 'DELETE' });
      setDeleteOpen(false);
      setSelected(null);
      await fetchCategories();
    } finally {
      setLoadingDelete(false);
    }
  };

  // 트리 재귀 렌더
  const renderTree = (nodes: Category[], currentPath: number[] = [], depth = 0): JSX.Element => (
    <SortableContext items={nodes.map(n => n.id.toString())} strategy={verticalListSortingStrategy}>
      <ul className="category-tree-list">
        {nodes.map(node => {
          const path = [...currentPath, node.id];
          return (
            <SortableCategoryItem
              key={node.id}
              node={node}
              selected={selected}
              open={open}
              onClick={() => handleCategorySelect(node, path)}
              onToggleOpen={toggleOpen}
            >
              {open.has(node.id) && node.children.length > 0 && (
                <div className="category-tree-children">
                  {renderTree(node.children, path, depth + 1)}
                </div>
              )}
            </SortableCategoryItem>
          );
        })}
      </ul>
    </SortableContext>
  );

  const handleSaveCategory = async () => {
    if (!selected || selected.id === 0) return;
    await fetch(`/api/categories/${selected.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(selected),
    });
    fetchCategories();
  };

  // ===== 렌더 =====
  return (
    <div className="category-manager-container">
      <WikiHeader user={user} />

      {/* 좌: 트리 */}
      <div className="category-sidebar">
        <h2 className="category-tree-title">
          <FontAwesomeIcon icon={faList} />&nbsp;카테고리
        </h2>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          {renderTree(tree)}
        </DndContext>
      </div>

      {/* 중: 문서 목록 */}
      <div className="category-doclist">
        <h2 className="category-doclist-title">
          <FontAwesomeIcon icon={faBook} />&nbsp;문서 목록
        </h2>
        {filteredDocs.length > 0 ? (
          <ul>
            {featuredDoc && (
              <li
                key={featuredDoc.id}
                className={`category-doc-item${selectedDoc?.id === featuredDoc.id ? " selected" : ""} featured`}
                onClick={() => setSelectedDoc(featuredDoc)}
              >
                <span className="doc-icon">
                  {featuredDoc.icon
                    ? (featuredDoc.icon.startsWith('http')
                      ? <img src={featuredDoc.icon} alt="icon" className="doc-img-icon" />
                      : <span>{featuredDoc.icon}</span>)
                    : <span className="doc-icon-placeholder">😀</span>}
                </span>
                &nbsp;{featuredDoc.title}
                <span className="doc-featured-label">대표 문서</span>
              </li>
            )}
            {otherDocs.map(doc => (
              <li
                key={doc.id}
                className={`category-doc-item${selectedDoc?.id === doc.id ? " selected" : ""}`}
                onClick={() => setSelectedDoc(doc)}
              >
                <span className="doc-icon">
                  {doc.icon
                    ? (doc.icon.startsWith('http')
                      ? <img src={doc.icon} alt="icon" className="doc-img-icon" />
                      : <span>{doc.icon}</span>)
                    : <span className="doc-icon-placeholder">😀</span>}
                </span>
                &nbsp;{doc.title}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-500">문서가 없습니다.</p>
        )}
      </div>

      {/* 우: 상세/설정 */}
      <div className="category-detail-panel">
        {selectedDoc ? (
          // --- 문서 정보 영역: 기존 유지 ---
          <div>
            <div className="cat-detail-header">
              <h2 className="cat-detail-title">문서 정보</h2>
              <div className="toolbar-seg">
                <button
                  className="seg-btn"
                  onClick={() => {
                    location.href = `/wiki/write?path=${encodeURIComponent(selectedDoc.path)}&title=${encodeURIComponent(selectedDoc.title)}&id=${selectedDoc.id}`;
                  }}
                  title="수정"
                >
                  <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M16.5 3.75l3.75 3.75M4.5 19.5l3.75-.938L19.5 7.875l-3.75-3.75L4.5 15.75V19.5Z" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  <span className="seg-label">수정</span>
                </button>
                 <button className="seg-btn danger" onClick={() => setDeleteOpen(true)} title="삭제">
                    <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true" preserveAspectRatio="xMidYMid meet">
                      <path d="M3 6h18" strokeLinecap="round"/>
                      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" strokeLinecap="round"/>
                      <rect x="5" y="6" width="14" height="14" rx="2"/>
                      <path d="M10 11v6M14 11v6" strokeLinecap="round"/>
                    </svg>
                    <span className="seg-label">삭제</span>
                  </button>
              </div>
            </div>
            <p><strong>제목:</strong> {selectedDoc.title}</p>
            <p>
              <strong>태그:</strong>{" "}
              {selectedDoc.tags && selectedDoc.tags.length > 0
                ? (Array.isArray(selectedDoc.tags) ? selectedDoc.tags : selectedDoc.tags.split(',').map(t => t.trim()).filter(Boolean))
                    .map((tag: string) => <span key={tag} className="doc-tag">#{tag}</span>)
                : <span style={{ color: "#aaa" }}>태그 없음</span>}
            </p>
          </div>
        ) : selected ? (
          // --- 카테고리 설정 영역: 리디자인 ---
          <div>
            {/* 상단 툴바 (제목 왼쪽에 아바타 추가 + 제목 크게) */}
            <div className="cat-detail-header">
              <div className="cat-title-wrap">
                <div className="cat-avatar">
                  {selected.icon?.startsWith('http') ? (
                    <img src={selected.icon} alt="icon" />
                  ) : (
                    <span>{selected.icon || '📁'}</span>
                  )}
                </div>
                <h2 className="cat-detail-title">{selected.name}</h2>
              </div>

              <div className="toolbar-seg">
                {/* (버튼들은 기존 그대로) */}
                <button
                  className="seg-btn"
                  onClick={handleSaveCategory}
                  disabled={selected.id === 0}
                  title="저장"
                >
                  <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M8.5 12.5l2.5 2.5 4.5-4.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span className="seg-label">저장</span>
                </button>
                {selected.id !== 0 && (
                  <button className="seg-btn danger" onClick={() => setDeleteOpen(true)} title="삭제">
                    <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true" preserveAspectRatio="xMidYMid meet">
                      <path d="M3 6h18" strokeLinecap="round"/>
                      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" strokeLinecap="round"/>
                      <rect x="5" y="6" width="14" height="14" rx="2"/>
                      <path d="M10 11v6M14 11v6" strokeLinecap="round"/>
                    </svg>
                    <span className="seg-label">삭제</span>
                  </button>
                )}
                <button className="seg-btn" onClick={() => { setNewCatName(''); setNewCatOpen(true); }} title="카테고리 추가">
                  <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 6v12M6 12h12" strokeLinecap="round"/></svg>
                  <span className="seg-label">카테고리 추가</span>
                </button>
                <button
                  className="seg-btn"
                  onClick={() => {
                    if (featuredDoc) {
                      // 대표 문서가 있으면 → 해당 문서 수정 화면으로
                      location.href = `/wiki/write?path=${encodeURIComponent(
                        featuredDoc.path
                      )}&title=${encodeURIComponent(featuredDoc.title)}&id=${featuredDoc.id}`;
                    } else {
                      // 없으면 → 대표 문서 새로 작성
                      location.href = `/wiki/write?path=${encodeURIComponent(selected.id)}&main=1`;
                    }
                  }}
                  title={featuredDoc ? '대표 문서 수정' : '대표 문서 추가'}
                >
                  <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M4 6h16M6 10h8M6 14h12M6 18h6" strokeLinecap="round"/>
                  </svg>
                  <span className="seg-label">{featuredDoc ? '대표 문서 수정' : '대표 문서 추가'}</span>
                </button>
                <button className="seg-btn" onClick={() => { location.href = `/wiki/write?path=${encodeURIComponent(selected.id)}`; }} title="문서 추가">
                  <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 6v12M6 12h12" strokeLinecap="round"/></svg>
                  <span className="seg-label">문서 추가</span>
                </button>
              </div>
            </div>

            {/* 폼 */}
            <div className="rd-form">
              <div className="rd-field">
                <label className="rd-label">카테고리 이름</label>
                <input
                  className="rd-input rd-input-lg"
                  value={selected.name}
                  onChange={(e) => setSelected({ ...selected, name: e.target.value })}
                  disabled={selected.id === 0}
                  placeholder="예) 게임 공략"
                  spellCheck={false}
                  autoCorrect="off"
                  autoCapitalize="off"
                />
              </div>

              {/* 이모지 / 이미지 */}
              <div className="rd-field">
                <label className="rd-label">이모지 / 이미지</label>
                <div className="input-with-btn">
                  <input
                    className="rd-input"
                    value={selected.icon ?? ''}
                    onChange={(e) => setSelected({ ...selected, icon: e.target.value })}
                    disabled={selected.id === 0}
                    placeholder="🙂 또는 https://... 이미지 URL"
                    spellCheck={false}
                    autoCorrect="off"
                    autoCapitalize="off"
                  />
                  {/* ⬇️ 한글 대신 이모지 버튼 */}
                  <button
                    className="chip-btn emoji"
                    type="button"
                    aria-label="이미지 선택"
                    title="이미지 선택"
                    onClick={() => setShowImageModal(true)}
                  >
                    🖼️
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-gray-500">좌측에서 카테고리를 선택해주세요</p>
        )}
      </div>

      {/* 이미지 선택 모달(기존) */}
      <ImageSelectModal
        open={showImageModal}
        onClose={() => setShowImageModal(false)}
        onSelectImage={(url) => {
          if (!selected) return;
          setSelected({ ...selected, icon: url });
        }}
      />

      {/* ===== 모달들 ===== */}

      {/* 카테고리 추가 모달 */}
      <BareModal open={newCatOpen} onClose={() => setNewCatOpen(false)}>
        <div className="rd-card" role="dialog" aria-labelledby="rd-newcat-title">
          <button className="rd-exit-btn" onClick={() => setNewCatOpen(false)} aria-label="닫기">
            <svg height="20" viewBox="0 0 384 512"><path d="M342.6 150.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L192 210.7 86.6 105.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L146.7 256 41.4 361.4c12.5 12.5 12.5 32.8 0 45.3s32.8 12.5 45.3 0L192 301.3 297.4 406.6c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L237.3 256 342.6 150.6z"/></svg>
          </button>
          <div className="rd-card-content">
            <p className="rd-card-heading" id="rd-newcat-title">카테고리 추가</p>
            <p className="rd-card-description"><b>{selected?.name}</b> 하위에 새 카테고리를 생성합니다.</p>
            <input
              className="rd-input"
              placeholder="새 카테고리 이름"
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && newCatName.trim()) createCategory(); }}
              autoFocus
              {...noSpell}
            />
          </div>
          <div className="rd-card-button-wrapper">
            <button className="rd-btn secondary" onClick={() => setNewCatOpen(false)}>취소</button>
            <button className="rd-btn primary" onClick={createCategory} disabled={!newCatName.trim() || loadingCreate}>
              {loadingCreate ? '생성 중…' : '생성'}
            </button>
          </div>
        </div>
      </BareModal>

      {/* 카테고리 삭제 모달 */}
      <BareModal open={deleteOpen} onClose={() => setDeleteOpen(false)}>
        <div className="rd-card" role="dialog" aria-labelledby="rd-delcat-title">
          <button className="rd-exit-btn" onClick={() => setDeleteOpen(false)} aria-label="닫기">
            <svg height="20" viewBox="0 0 384 512"><path d="M342.6 150.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L192 210.7 86.6 105.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L146.7 256 41.4 361.4c12.5 12.5 12.5 32.8 0 45.3s32.8 12.5 45.3 0L192 301.3 297.4 406.6c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L237.3 256 342.6 150.6z"/></svg>
          </button>
          <div className="rd-card-content">
            <p className="rd-card-heading" id="rd-delcat-title">카테고리 삭제</p>
            <p className="rd-card-description"><b>{selected?.name}</b> 카테고리와 그 하위 항목이 삭제됩니다. 계속할까요?</p>
          </div>
          <div className="rd-card-button-wrapper">
            <button className="rd-btn secondary" onClick={() => setDeleteOpen(false)}>취소</button>
            <button className="rd-btn danger" onClick={deleteCategory} disabled={loadingDelete}>
              {loadingDelete ? '삭제 중…' : '삭제'}
            </button>
          </div>
        </div>
      </BareModal>
    </div>
  );
}
