// File: app/manage/category/page.tsx

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

// --- 타입 선언
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
};

// --- Sortable Category Item(핸들)
function SortableCategoryItem({
  node,
  selected,
  onClick,
  onToggleOpen,
  children,
}: {
  node: Category;
  selected: Category | null;
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

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        listStyle: "none",
      }}
      {...attributes}
    >
      <div
        className={`flex items-center justify-between px-2 py-1 cursor-pointer ${
          selected?.id === node.id ? 'bg-blue-100' : ''
        }`}
        onClick={onClick}
        style={{ userSelect: "none" }}
      >
        {/* 드래그 핸들만 listeners 부착 */}
        <span className="flex-1" {...listeners}>
          {node.icon ?? ''} {node.name}
        </span>
        {node.children.length > 0 && (
          <button
            onClick={e => {
              e.stopPropagation();
              onToggleOpen(node.id);
            }}
            className="text-gray-500 ml-2"
            tabIndex={-1}
          >
            ▼
          </button>
        )}
      </div>
      {children}
    </li>
  );
}

// --- 메인 컴포넌트
export default function CategoryManager() {
  const [tree, setTree] = useState<Category[]>([]);
  const [open, setOpen] = useState<Set<number>>(new Set());
  const [selected, setSelected] = useState<Category | null>(null);
  const [selectedCategoryPath, setSelectedCategoryPath] = useState<number[]>([]);
  const [allDocuments, setAllDocuments] = useState<Document[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);

  const sensors = useSensors(useSensor(PointerSensor));

  useEffect(() => {
    fetchCategories();
    // 열림 이벤트 window 단위로 전달 받음
    window.addEventListener("toggleOpen", (e: any) => {
      if (e.detail) toggleOpen(e.detail);
    });
    return () => {
      window.removeEventListener("toggleOpen", () => {});
    };
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    fetch('/api/documents?all=1')
      .then(res => res.json())
      .then(data => setAllDocuments(data));
  }, []);

  const handleCategorySelect = (node: Category, currentPath: number[]) => {
    setSelected(node);
    setSelectedDoc(null);
    setSelectedCategoryPath(currentPath);
  };

  const realPath = selectedCategoryPath.slice(1).join('/');
  const filteredDocs = allDocuments.filter(doc => String(doc.path) === realPath);

  // --- 카테고리 트리 fetch
  const fetchCategories = async () => {
    const res = await fetch('/api/categories');
    const flat: Category[] = await res.json();
    const built = buildTree(flat);
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

  // --- flat -> 트리 변환
  const buildTree = (list: Category[]): Category[] => {
    const map = new Map<number, Category>();
    list.forEach((item) => map.set(item.id, { ...item, children: [] }));
    const roots: Category[] = [];
    list.forEach((item) => {
      const node = map.get(item.id)!;
      if (item.parent_id === null) roots.push(node);
      else {
        const parent = map.get(item.parent_id);
        if (parent) parent.children.push(node);
      }
    });
    for (const [, node] of map) node.children.sort((a, b) => a.order - b.order);
    return roots.sort((a, b) => a.order - b.order);
  };

  // --- 열림/닫힘
  const toggleOpen = (id: number) => {
    setOpen((prev) => {
      const copy = new Set(prev);
      copy.has(id) ? copy.delete(id) : copy.add(id);
      return copy;
    });
  };

  // --- 트리 드래그 & 정렬 (동일)
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const activeId = parseInt(active.id as string);
    const overId = parseInt(over.id as string);
    const newTree = structuredClone(tree);
    const parent = findParent(newTree, activeId);
    if (!parent) return;
    const oldIndex = parent.children.findIndex((c) => c.id === activeId);
    const newIndex = parent.children.findIndex((c) => c.id === overId);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(parent.children, oldIndex, newIndex);
    parent.children = reordered;
    setTree(newTree);
    if (selected) {
      const newSelected = findCategoryById(newTree, selected.id);
      if (newSelected) setSelected(newSelected);
    }
    reordered.forEach((item, index) => {
      fetch(`/api/categories/${item.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: index }),
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

  // --- 트리 렌더링 (핸들 적용)
  const renderTree = (nodes: Category[], currentPath: number[] = [], depth = 0): JSX.Element => {
    return (
      <SortableContext
        items={nodes.map((node) => node.id.toString())}
        strategy={verticalListSortingStrategy}
      >
        <ul className="space-y-1">
          {nodes.map((node) => {
            const path = [...currentPath, node.id];
            return (
              <SortableCategoryItem
                key={node.id}
                node={node}
                selected={selected}
                onClick={() => handleCategorySelect(node, path)}
                onToggleOpen={toggleOpen}
              >
                {open.has(node.id) && node.children.length > 0 && (
                  <div className="ml-4">
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

  // --- 렌더링
  return (
    <div className="flex h-screen">
      {/* 왼쪽: 카테고리 트리 */}
      <div className="w-1/4 bg-gray-100 overflow-y-auto border-r p-4">
        <h2 className="text-lg font-bold mb-2">카테고리 구조</h2>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          {renderTree(tree)}
        </DndContext>
      </div>

      {/* 중앙: 문서 목록 */}
      <div className="w-1/4 bg-white border-r p-4 overflow-y-auto">
        <h2 className="text-lg font-bold mb-2">문서 목록</h2>
        {filteredDocs.length > 0 ? (
          <ul>
            {filteredDocs.map((doc) => (
              <li
                key={doc.id}
                className={`cursor-pointer px-2 py-1 rounded hover:bg-gray-100 ${
                  selectedDoc?.id === doc.id ? 'bg-blue-100' : ''
                }`}
                onClick={() => setSelectedDoc(doc)}
              >
                📄 {doc.title}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-500">문서가 없습니다.</p>
        )}
      </div>

      {/* 오른쪽: 문서 정보 or 카테고리 설정 */}
      <div className="flex-1 p-6 overflow-y-auto">
        {selectedDoc ? (
          <div>
            <h2 className="text-xl font-bold mb-4">문서 정보</h2>
            <p><strong>제목:</strong> {selectedDoc.title}</p>
            <p><strong>경로:</strong> {selectedDoc.path}</p>
            <p><strong>생성일:</strong> {selectedDoc.created_at}</p>
            <p><strong>수정일:</strong> {selectedDoc.updated_at}</p>
            <button className="mt-4 bg-blue-600 text-white px-4 py-2 rounded">수정하기</button>
          </div>
        ) : selected ? (
          <div>
            <h2 className="text-xl font-bold mb-4">{selected.name} 설정</h2>
            <div className="space-y-4">
              {/* 카테고리 이름 */}
              <div>
                <label className="block font-semibold">카테고리 이름</label>
                <input
                  className="border px-3 py-1 rounded w-96"
                  value={selected.name}
                  onChange={(e) =>
                    setSelected({ ...selected, name: e.target.value })
                  }
                  disabled={selected.id === 0}
                />
              </div>
              {/* 아이콘 */}
              <div>
                <label className="block font-semibold">이모지 / 이미지</label>
                <input
                  className="border px-3 py-1 rounded w-96"
                  value={selected.icon ?? ''}
                  onChange={(e) =>
                    setSelected({ ...selected, icon: e.target.value })
                  }
                  disabled={selected.id === 0}
                />
              </div>
              {/* 문서 경로 */}
              <div>
                <label className="block font-semibold">문서 경로</label>
                <input
                  className="border px-3 py-1 rounded w-96"
                  value={selected.document_path ?? ''}
                  onChange={(e) =>
                    setSelected({ ...selected, document_path: e.target.value })
                  }
                  disabled={selected.id === 0}
                />
              </div>
              {/* 카테고리 조작 버튼 */}
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
                        document_path: '',
                      }),
                    });
                    fetchCategories();
                  }}
                >
                  하위 카테고리 추가
                </button>
                <button
                  className="bg-blue-500 text-white px-4 py-2 rounded"
                  onClick={() => {
                    const basePath = selected.document_path ?? `${selected.id}`;
                    const title = prompt('대표 문서 제목을 입력하세요') || '대표문서';
                    location.href = `/wiki/write?path=${encodeURIComponent(basePath)}&title=${encodeURIComponent(title)}`;
                  }}
                >
                  📘 카테고리 대표 문서 작성
                </button>
                <button
                  className="bg-green-600 text-white px-4 py-2 rounded"
                  onClick={() => {
                    if (!selected) return alert('카테고리를 먼저 선택하세요');
                    const basePath = selected.document_path ?? `${selected.id}`;
                    const timestamp = Date.now();
                    const title = prompt('문서 제목을 입력하세요') || `untitled-${timestamp}`;
                    location.href = `/wiki/write?path=${encodeURIComponent(basePath)}&title=${encodeURIComponent(title)}`;
                  }}
                >
                  📄 하위 문서 추가
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
