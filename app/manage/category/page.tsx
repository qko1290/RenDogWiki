// =============================================
// File: app/manage/category/page.tsx
// =============================================
/**
 * 카테고리 관리 페이지
 * - 트리형 카테고리(드래그 정렬), 문서 목록, 상세/수정/생성/삭제/하위 추가 등
 */

'use client';

import { useEffect, useState } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import WikiHeader from "@/components/common/Header";
import '@/wiki/css/manage-category.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faList, faBook } from '@fortawesome/free-solid-svg-icons';

// 타입 선언부 (카테고리/문서 타입)
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

// SortableCategoryItem (트리의 한 카테고리 행)
function SortableCategoryItem({
  node,
  selected,
  open,
  onClick,
  onToggleOpen,
  children,
}: {
  node: Category;
  selected: Category | null;
  open: Set<number>;
  onClick: () => void;
  onToggleOpen: (id: number) => void;
  children?: React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: node.id.toString() });

  // 스타일 객체 → 클래스 + 동적 속성만 분리
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <li
      ref={setNodeRef}
      className={`sortable-category-item${selected?.id === node.id ? " selected" : ""}`}
      style={style} // transform, transition, opacity만 동적
      {...attributes}
    >
      <div className="category-row">
        <span
          className="grab-handle"
          {...listeners}
        >
          ⠿
        </span>
        <span className="category-label" onClick={onClick}>
          {node.icon ?? ''} {node.name}
        </span>
        {node.children.length > 0 && (
          <button
            onClick={e => { e.stopPropagation(); onToggleOpen(node.id); }}
            className="category-toggle-btn"
            tabIndex={-1}
          >
            {open.has(node.id) ? '▼' : '▶'}
          </button>
        )}
      </div>
      {children && (
        <div className="category-tree-children">{children}</div>
      )}
    </li>
  );
}

// CategoryManager (메인 페이지)
export default function CategoryManager() {
  // 상태 선언
  const [tree, setTree] = useState<Category[]>([]);
  const [open, setOpen] = useState<Set<number>>(new Set());
  const [selected, setSelected] = useState<Category | null>(null);
  const [selectedCategoryPath, setSelectedCategoryPath] = useState<number[]>([]);
  const [allDocuments, setAllDocuments] = useState<Document[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [categoryIdToPathMap, setCategoryIdToPathMap] = useState<Record<number, number[]>>({});

  const sensors = useSensors(useSensor(PointerSensor));

  useEffect(() => {
    fetchCategories();
    window.addEventListener("toggleOpen", (e: any) => {
      if (e.detail) toggleOpen(e.detail);
    });
    return () => {
      window.removeEventListener("toggleOpen", () => {});
    };
  }, []);

  useEffect(() => {
    fetch('/api/documents?all=1')
      .then(res => res.json())
      .then(data => {
        if (Object.keys(categoryIdToPathMap).length === 0) {
          setAllDocuments(data);
          return;
        }
        const mapped = data.map((doc: Document & { path: number|string }) => ({
          ...doc,
          fullPath: categoryIdToPathMap[Number(doc.path)] || [Number(doc.path)],
        }));
        setAllDocuments(mapped);
      });
  }, [categoryIdToPathMap]);

  const handleCategorySelect = (node: Category, currentPath: number[]) => {
    setSelected(node);
    setSelectedDoc(null);
    setSelectedCategoryPath(currentPath);
  };

  const filteredDocs = allDocuments.filter(doc => {
    if (!selectedCategoryPath.length) return false;
    const categoryPath = selectedCategoryPath[0] === 0 ? selectedCategoryPath.slice(1) : selectedCategoryPath;
    if (doc.fullPath) {
      return JSON.stringify(doc.fullPath) === JSON.stringify(categoryPath);
    }
    return Number(doc.path) === categoryPath.at(-1);
  });

  const featuredDoc = filteredDocs.find(doc => doc.is_featured);
  const otherDocs = filteredDocs.filter(doc => !doc.is_featured);

  const fetchCategories = async () => {
  const res = await fetch('/api/categories');
  const flat: Category[] = await res.json();
  const built = buildTree(flat);

  // === [추가] 경로 맵 생성 ===
  const idToPathMap: Record<number, number[]> = {};
    function buildMap(nodes: Category[], path: number[] = []) {
      for (const node of nodes) {
        const currentPath = [...path, node.id];
        idToPathMap[node.id] = currentPath;
        if (node.children.length) buildMap(node.children, currentPath);
      }
    }
    buildMap(built);
    setCategoryIdToPathMap(idToPathMap);

    setTree([
      {
        id: 0,
        name: 'RenDog Wiki',
        parent_id: null,
        order: 0,
        icon: '📚',
        document_path: '',
        children: built,
      },
    ]);
  };

  const buildTree = (list: Category[]): Category[] => {
    const map = new Map<number, Category>();
    list.forEach((item) => map.set(item.id, { ...item, children: [] }));
    const roots: Category[] = [];
    list.forEach((item) => {
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
    setOpen((prev) => {
      const copy = new Set(prev);
      copy.has(id) ? copy.delete(id) : copy.add(id);
      return copy;
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const activeId = parseInt(active.id as string);
    const overId = parseInt(over.id as string);

    // 각각의 부모 찾기
    const newTree = structuredClone(tree);
    const parentA = findParent(newTree, activeId);
    const parentB = findParent(newTree, overId);

    // 같은 부모 내에서만 순서 이동 허용
    if (!parentA || !parentB || parentA !== parentB) return;

    const oldIndex = parentA.children.findIndex((c) => c.id === activeId);
    const newIndex = parentA.children.findIndex((c) => c.id === overId);
    if (oldIndex === -1 || newIndex === -1) return;

    parentA.children = arrayMove(parentA.children, oldIndex, newIndex);
    setTree(newTree);

    // 선택 카테고리 동기화
    if (selected) {
      const newSelected = findCategoryById(newTree, selected.id);
      if (newSelected) setSelected(newSelected);
    }
    // DB 반영
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
      if (node.children.some((c) => c.id === childId)) return node;
      const deeper = findParent(node.children, childId);
      if (deeper) return deeper;
    }
    return null;
  };

  const renderTree = (nodes: Category[], currentPath: number[] = [], depth = 0): JSX.Element => {
    return (
      <SortableContext
        items={nodes.map((node) => node.id.toString())}
        strategy={verticalListSortingStrategy}
      >
        <ul className="category-tree-list">
          {nodes.map((node) => {
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
  };

  return (
    <div className="category-manager-container">
      <WikiHeader user={null} />
      {/* 1. 카테고리 트리 */}
      <div className="category-sidebar">
        <h2 className="category-tree-title"><FontAwesomeIcon icon={faList} />&nbsp;&nbsp;&nbsp;카테고리</h2>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          {renderTree(tree)}
        </DndContext>
      </div>

      {/* 2. 중앙: 문서 목록 */}
      <div className="category-doclist">
      <h2 className="category-doclist-title"><FontAwesomeIcon icon={faBook} />&nbsp;&nbsp;&nbsp;문서 목록</h2>
      {filteredDocs.length > 0 ? (
        <ul>
          {/* 대표 문서 강조 */}
          {featuredDoc && (
            <li
              key={featuredDoc.id}
              className={`category-doc-item${selectedDoc?.id === featuredDoc.id ? " selected" : ""}`}
              style={{
                background: "#ffd6da",
                fontWeight: 600,
                borderRadius: "8px",
                marginBottom: "5px",
                border: "1.5px solid #f89aaf",
              }}
              onClick={() => setSelectedDoc(featuredDoc)}
            >
              <span style={{
                display: "inline-block",
                width: "1.3em",
                textAlign: "center"
              }}>
                {featuredDoc.icon ? featuredDoc.icon : <span style={{ opacity: 0 }}>😀</span>}
              </span>
              &nbsp;&nbsp;{featuredDoc.title}
              <span style={{
                marginLeft: 8,
                fontSize: 12,
                color: "#e5435a",
                fontWeight: 700,
                verticalAlign: "middle"
              }}>대표 문서</span>
            </li>
          )}
          {/* 일반 문서 */}
          {otherDocs.map((doc) => (
            <li
              key={doc.id}
              className={`category-doc-item${selectedDoc?.id === doc.id ? " selected" : ""}`}
              onClick={() => setSelectedDoc(doc)}
            >
              <span style={{
                display: "inline-block",
                width: "1.3em",
                textAlign: "center"
              }}>
                {doc.icon ? doc.icon : <span style={{ opacity: 0 }}>😀</span>}
              </span>
              &nbsp;&nbsp;{doc.title}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-gray-500">문서가 없습니다.</p>
      )}
    </div>

      {/* 3. 오른쪽: 문서 or 카테고리 정보/설정 */}
      <div className="category-detail-panel">
        {/* 문서 정보 (수정/삭제 버튼 포함) */}
        {selectedDoc ? (
          <div>
            <h2 className="text-xl font-bold mb-4">문서 정보</h2>
            <p><strong>제목:</strong> {selectedDoc.title}</p>
            <p>
              <strong>태그:</strong>{" "}
              {selectedDoc.tags && selectedDoc.tags.length > 0
                ? (
                  (Array.isArray(selectedDoc.tags)
                    ? selectedDoc.tags
                    : selectedDoc.tags.split(',').map((t: string) => t.trim()).filter(Boolean)
                  ).map((tag: string, idx: number) => (
                    <span
                      key={tag}
                      style={{
                        display: "inline-block",
                        background: "#f2f2f2",
                        color: "#444",
                        borderRadius: "6px",
                        padding: "2px 9px",
                        fontSize: "13px",
                        marginRight: "6px",
                      }}
                    >
                      #{tag}
                    </span>
                  ))
                )
                : <span style={{ color: "#aaa" }}>태그 없음</span>
              }
            </p>
            <div style={{ marginTop: 20, display: "flex", gap: 10 }}>
              {/* 수정 버튼: /wiki/write 페이지로 이동 */}
              <button
                className="bg-blue-600 text-white px-4 py-2 rounded"
                onClick={() => {
                  location.href = `/wiki/write?path=${encodeURIComponent(selectedDoc.path)}&title=${encodeURIComponent(selectedDoc.title)}&id=${selectedDoc.id}`;
                }}
              >
                수정
              </button>
              {/* 삭제 버튼: 실제로 API로 삭제, 확인창 포함 */}
              <button
                className="bg-red-600 text-white px-4 py-2 rounded"
                onClick={async () => {
                  if (!confirm('정말 삭제하시겠습니까?')) return;
                  await fetch(`/api/documents?id=${selectedDoc.id}`, { method: 'DELETE' });
                  // 삭제 후 상태 초기화 및 문서 리스트 갱신
                  setSelectedDoc(null);
                  // 문서 리스트 다시 불러오기(함수명은 사용 중인 걸로 대체)
                  fetchCategories();
                }}
              >
                삭제
              </button>
            </div>
          </div>
        ) : selected ? (
          <div>
            <h2 className="text-xl font-bold mb-4">{selected.name} 설정</h2>
            <div className="space-y-4">
              <div>
                <label className="block font-semibold">카테고리 이름</label>
                <input
                  className="border px-3 py-1 rounded w-96"
                  value={selected.name}
                  onChange={(e) => setSelected({ ...selected, name: e.target.value })}
                  disabled={selected.id === 0}
                />
              </div>
              <div>
                <label className="block font-semibold">이모지 / 이미지</label>
                <input
                  className="border px-3 py-1 rounded w-96"
                  value={selected.icon ?? ''}
                  onChange={(e) => setSelected({ ...selected, icon: e.target.value })}
                  disabled={selected.id === 0}
                />
              </div>
              <div className="flex gap-2">
                {selected.id !== 0 && (
                  <>
                    <button
                      className="bg-blue-600 text-white px-4 py-2 rounded"
                      onClick={async () => {
                        await fetch(`/api/categories/${selected.id}`, {
                          method: 'PUT',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify(selected),
                        });
                        fetchCategories();
                      }}
                    >
                      저장
                    </button>
                    <button
                      className="bg-red-600 text-white px-4 py-2 rounded"
                      onClick={async () => {
                        if (!confirm('정말 삭제하시겠습니까?')) return;
                        await fetch(`/api/categories/${selected.id}`, { method: 'DELETE' });
                        setSelected(null);
                        fetchCategories();
                      }}
                    >
                      삭제
                    </button>
                  </>
                )}
                <button
                  className="bg-green-600 text-white px-4 py-2 rounded"
                  onClick={async () => {
                    const name = prompt('하위 카테고리 이름을 입력하세요');
                    if (!name?.trim()) return;
                    await fetch('/api/categories', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        name,
                        parent_id: selected.id,
                        order: 0,
                        icon: '',
                      }),
                    });
                    fetchCategories();
                  }}
                >
                  카테고리 추가
                </button>
                <button
                  className="bg-blue-500 text-white px-4 py-2 rounded"
                  onClick={() => {
                    // 대표문서는 카테고리 id 기준으로 path 사용, title 없이 바로 진입
                    location.href = `/wiki/write?path=${encodeURIComponent(selected.id)}&main=1`;
                  }}
                >
                  📘 대표 문서 추가
                </button>
                <button
                  className="bg-green-600 text-white px-4 py-2 rounded"
                  onClick={() => {
                    if (!selected) return alert('카테고리를 먼저 선택하세요');
                    location.href = `/wiki/write?path=${encodeURIComponent(selected.id)}`;
                  }}
                >
                  📄 문서 추가
                </button>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-gray-500">좌측에서 카테고리를 선택해주세요</p>
        )}
      </div>
    </div>
  );
}
