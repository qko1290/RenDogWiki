// app/manage/category/page.tsx
'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
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
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import WikiHeader from '@/components/common/Header';
import '@/wiki/css/manage-category.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBook, faList } from '@fortawesome/free-solid-svg-icons';
import ImageSelectModal from '@/components/image/ImageSelectModal';
import Image, { type StaticImageData } from 'next/image';
import logo from '../../image/logo.png';
import { toProxyUrl } from '@lib/cdn';

type Role = 'guest' | 'writer' | 'admin';

type Category = {
  id: number;
  name: string;
  parent_id: number | null;
  order: number;
  document_path?: string;
  icon?: string | StaticImageData;
  children: Category[];
  mode_tags?: string[];
  uploader?: string;
};

type Document = {
  id: number;
  title: string;
  path: string;
  order: number;
  created_at: string;
  updated_at: string;
  icon?: string;
  tags?: string;
  is_featured: boolean;
  fullPath?: number[];
  uploader?: string;
};

const MODE_OPTIONS: Array<{ key: string; label: string }> = [{ key: '뉴비', label: '뉴비' }];

const chipStyle: React.CSSProperties = {
  padding: '2px 10px',
  borderRadius: 999,
  border: '1.5px solid #2563eb',
  background: '#eff6ff',
  color: '#1d4ed8',
  fontWeight: 700,
  fontSize: 12,
  lineHeight: 1.2,
  display: 'inline-flex',
  alignItems: 'center',
  whiteSpace: 'nowrap',
};
const moreStyle: React.CSSProperties = {
  padding: '2px 8px',
  borderRadius: 999,
  border: '1px solid #d1d5db',
  background: '#fff',
  color: '#6b7280',
  fontSize: 12,
  lineHeight: 1.2,
  display: 'inline-flex',
  alignItems: 'center',
  whiteSpace: 'nowrap',
};
const MAX_CHIPS = 2;

function BareModal({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div
      className="rd-overlay"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {children}
    </div>
  );
}

function SortableCategoryItem({
  node,
  selected,
  open,
  onClick,
  onToggleOpen,
  hoverId,
  shiftMode,
  children,
  appliedTags,
}: {
  node: Category;
  selected: Category | null;
  open: Set<number>;
  onClick: () => void;
  onToggleOpen: (id: number) => void;
  hoverId: number | null;
  shiftMode: boolean;
  children?: React.ReactNode;
  appliedTags: string[];
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: `cat-${node.id}` });

  const liStyle: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const isOpen = open.has(node.id);
  const highlight = shiftMode && hoverId === node.id;

  const renderIcon = () => {
    const ic = node.icon;
    if (!ic) return null;
    if (typeof ic === 'object' && ic && 'src' in ic) {
      return (
        <Image
          src={ic as StaticImageData}
          alt="icon"
          width={20}
          height={20}
          style={{ borderRadius: 6, objectFit: 'cover' }}
        />
      );
    }
    if (typeof ic === 'string' && ic.startsWith('http')) {
      return (
        <img
          src={toProxyUrl(ic)}
          alt="icon"
          style={{ width: 20, height: 20, borderRadius: 6, objectFit: 'cover' }}
          loading="lazy"
          decoding="async"
        />
      );
    }
    return <span>{ic as string}</span>;
  };

  return (
    <li ref={setNodeRef} className="sortable-category-item" style={liStyle} {...attributes}>
      <div
        className={`category-row${selected?.id === node.id ? ' active' : ''}`}
        style={highlight ? { outline: '2px dashed #7c3aed', outlineOffset: 2, background: 'rgba(124,58,237,0.06)' } : undefined}
      >
        <span className="grab-handle" {...listeners} aria-label="드래그로 순서 변경">⠿</span>

        <button
          type="button"
          className="category-label"
          onClick={onClick}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          aria-current={selected?.id === node.id ? 'true' : undefined}
        >
          {renderIcon()}
          <span>{node.name}</span>
        </button>

        {appliedTags?.length > 0 && (
          <div className="category-tags" style={{ display: 'flex', gap: 6, marginLeft: 8, overflow: 'hidden', alignItems: 'center' }}>
            {appliedTags.slice(0, MAX_CHIPS).map((tag) => (
              <span key={`chip-${node.id}-${tag}`} style={chipStyle}>
                ✓&nbsp;#{tag}
              </span>
            ))}
            {appliedTags.length > MAX_CHIPS && <span style={moreStyle}>+{appliedTags.length - MAX_CHIPS}</span>}
          </div>
        )}

        {node.children.length > 0 && (
          <button
            onClick={(e) => { e.stopPropagation(); onToggleOpen(node.id); }}
            className="category-toggle-btn"
            tabIndex={-1}
            aria-expanded={isOpen}
            aria-label={isOpen ? '하위 닫기' : '하위 열기'}
          >
            {isOpen ? '▼' : '▶'}
          </button>
        )}
      </div>

      {children && <div className="category-tree-children">{children}</div>}
    </li>
  );
}

function SortableDocItem({
  doc,
  onClick,
  isSelected,
}: {
  doc: Document;
  onClick: () => void;
  isSelected: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: `doc-${doc.id}` });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`category-doc-item${isSelected ? ' selected' : ''}`}
      {...attributes}
      onClick={onClick}
    >
      {/* :: 그랩 핸들 */}
      <span className="grab-handle" {...listeners} aria-label="드래그로 순서 변경">⠿</span>

      <span className="doc-icon">
        {doc.icon ? (
          doc.icon.startsWith('http') ? (
            <img
              src={toProxyUrl(doc.icon)}   // ✅ CloudFront 경유
              alt="icon"
              className="doc-img-icon"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <span>{doc.icon}</span>
          )
        ) : (
          <span className="doc-icon-placeholder">😀</span>
        )}
      </span>
      &nbsp;{doc.title}
      {doc.is_featured ? <span className="doc-featured-label">대표 문서</span> : null}
    </li>
  );
}

export default function CategoryManager() {
  const [user, setUser] = useState<any>(null);

  const [tree, setTree] = useState<Category[]>([]);
  const [open, setOpen] = useState<Set<number>>(new Set());
  const [selected, setSelected] = useState<Category | null>(null);
  const [selectedCategoryPath, setSelectedCategoryPath] = useState<number[]>([]);
  const [allDocuments, setAllDocuments] = useState<Document[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [categoryIdToPathMap, setCategoryIdToPathMap] = useState<Record<number, number[]>>({});
  const [showImageModal, setShowImageModal] = useState(false);

  const [newCatOpen, setNewCatOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [loadingCreate, setLoadingCreate] = useState(false);

  const [catDeleteOpen, setCatDeleteOpen] = useState(false);
  const [docDeleteOpen, setDocDeleteOpen] = useState(false);
  const [loadingDelete, setLoadingDelete] = useState(false);
  const [loadingDocDelete, setLoadingDocDelete] = useState(false);

  const [hoverId, setHoverId] = useState<number | null>(null);
  const hoverTimerRef = useRef<number | null>(null);
  const shiftRef = useRef(false);
  const [isShift, setIsShift] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setUser(data?.user ?? null))
      .catch(() => setUser(null));
  }, []);

  const role: Role = user?.role === 'admin' ? 'admin' : user?.role === 'writer' ? 'writer' : 'guest';
  const isAdmin = role === 'admin';
  const isWriter = role === 'writer';
  const myName = (user?.minecraft_name ?? '').toLowerCase();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') { shiftRef.current = true; setIsShift(true); }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') { shiftRef.current = false; setIsShift(false); }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  useEffect(() => {
    fetchCategories();
    const handleToggleOpen = (e: any) => { if (e.detail) toggleOpen(e.detail); };
    window.addEventListener('toggleOpen', handleToggleOpen);
    return () => window.removeEventListener('toggleOpen', handleToggleOpen);
  }, []);

  useEffect(() => { refreshDocuments(); }, [categoryIdToPathMap]);

  const handleCategorySelect = (node: Category, currentPath: number[]) => {
    setSelected(node);
    setSelectedDoc(null);
    setSelectedCategoryPath(currentPath);
  };

  const filteredDocs = (() => {
    if (!selectedCategoryPath.length) return [];
    const last = selectedCategoryPath.at(-1)!;
    return allDocuments.filter((d) => String(d.path) === String(last));
  })();

  const docsSorted = [...filteredDocs].sort((a, b) => a.order - b.order);

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/categories');
      if (!res.ok) throw new Error();
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
        id: 0, name: 'RenDog Wiki', parent_id: null, order: 0, icon: logo, document_path: '', children: built,
      }]);
    } catch {
      setTree([]);
      setCategoryIdToPathMap({});
    }
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

  const appliedTagsMap = useMemo(() => {
    const map = new Map<number, string[]>();
    const getOwnTags = (n: Category) =>
      (selected && selected.id === n.id ? (selected.mode_tags ?? []) : (n.mode_tags ?? []))
        .map((t) => String(t).trim().toLowerCase())
        .filter(Boolean);
    const dfs = (node: Category, parentSet: Set<string>) => {
      const merged = new Set(parentSet);
      getOwnTags(node).forEach((t) => merged.add(t));
      map.set(node.id, Array.from(merged));
      node.children.forEach((ch) => dfs(ch, merged));
    };
    const roots = tree.length && tree[0]?.id === 0 ? tree[0].children : tree;
    roots.forEach((n) => dfs(n, new Set()));
    map.set(0, []);
    return map;
  }, [tree, selected]);

  const toggleOpen = (id: number) => {
    setOpen((prev) => {
      const copy = new Set(prev);
      copy.has(id) ? copy.delete(id) : copy.add(id);
      return copy;
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

  const isDescendant = (nodes: Category[], ancestorId: number, childId: number): boolean => {
    const ancestor = findCategoryById(nodes, ancestorId);
    if (!ancestor) return false;
    const stack = [...ancestor.children];
    while (stack.length) {
      const n = stack.pop()!;
      if (n.id === childId) return true;
      stack.push(...n.children);
    }
    return false;
  };

  const removeFromOldParent = (nodes: Category[], id: number) => {
    const parent = findParent(nodes, id);
    if (!parent) return { parent: null, removed: null as Category | null, index: -1 };
    const idx = parent.children.findIndex((c) => c.id === id);
    const [removed] = parent.children.splice(idx, 1);
    return { parent, removed, index: idx };
  };

  async function deleteDocument() {
    if (!selectedDoc) return;
    if (!isAdmin) {
      const ownerOk = isWriter && selectedDoc.uploader?.toLowerCase?.() === myName;
      if (!ownerOk) { alert('본인이 만든 문서만 삭제할 수 있습니다.'); return; }
    }
    try {
      setLoadingDocDelete(true);
      const res = await fetch(`/api/documents?id=${selectedDoc.id}`, { method: 'DELETE' });
      if (!res.ok) { alert('문서 삭제에 실패했습니다.'); return; }
      setDocDeleteOpen(false);
      setSelectedDoc(null);
      await refreshDocuments();
    } finally {
      setLoadingDocDelete(false);
    }
  }

  async function refreshDocuments() {
    try {
      const res = await fetch('/api/documents?all=1');
      const data = await res.json();
      if (!Array.isArray(data)) { setAllDocuments([]); return; }
      if (Object.keys(categoryIdToPathMap).length === 0) {
        setAllDocuments(data);
        return;
      }
      const mapped = data.map((doc: Document & { path: number | string }) => ({
        ...doc,
        order: Number((doc as any).order ?? 0),
        fullPath: categoryIdToPathMap[Number(doc.path)] || [Number(doc.path)],
      }));
      setAllDocuments(mapped);
    } catch {
      setAllDocuments([]);
    }
  }

  function moveToParent(dragId: number, targetParentId: number) {
    if (targetParentId === dragId || isDescendant(tree, dragId, targetParentId)) return;

    const newTree: Category[] = structuredClone(tree);
    const { parent: oldParent, removed } = removeFromOldParent(newTree, dragId);
    const newParent = findCategoryById(newTree, targetParentId);
    if (!removed || !newParent) return;

    const insertIndex = newParent.children.length;
    removed.parent_id = targetParentId === 0 ? null : targetParentId;
    removed.order = insertIndex;
    newParent.children.splice(insertIndex, 0, removed);

    setTree(newTree);
    if (selected) {
      const u = findCategoryById(newTree, selected.id);
      if (u) setSelected(u);
    }

    fetch(`/api/categories/${dragId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: removed.name,
        parent_id: removed.parent_id,
        order: insertIndex,
        icon: typeof removed.icon === 'string' ? removed.icon : '',
      }),
    }).catch(() => {});

    if (oldParent) {
      oldParent.children.forEach((c, idx) => {
        fetch(`/api/categories/${c.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order: idx }),
        }).catch(() => {});
      });
    }
    newParent.children.forEach((c, idx) => {
      fetch(`/api/categories/${c.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: idx }),
      }).catch(() => {});
    });
  }

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
    if (!isAdmin) {
      const ownerOk = isWriter && selected.uploader?.toLowerCase?.() === myName;
      if (!ownerOk) { alert('본인이 만든 카테고리만 삭제할 수 있습니다.'); return; }
    }
    try {
      setLoadingDelete(true);
      await fetch(`/api/categories/${selected.id}`, { method: 'DELETE' });
      setCatDeleteOpen(false);
      setSelected(null);
      await fetchCategories();
    } finally {
      setLoadingDelete(false);
    }
  };

  // ---------- DnDContext: 페이지 전체(카테고리 + 문서) 감쌈 ----------
  const onDragOver = (e: any) => {
    if (!shiftRef.current) { setHoverId(null); return; }
    const overIdStr = String(e.over?.id ?? '');
    if (!overIdStr.startsWith('cat-')) { setHoverId(null); return; }
    const id = Number(overIdStr.slice(4));
    if (!Number.isFinite(id)) { setHoverId(null); return; }
    setHoverId(id);
    if (!open.has(id)) {
      if (hoverTimerRef.current) window.clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = window.setTimeout(() => toggleOpen(id), 350);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (hoverTimerRef.current) { window.clearTimeout(hoverTimerRef.current); hoverTimerRef.current = null; }
    setHoverId(null);
    if (!over) return;

    const a = String(active.id);
    const b = String(over.id);

    // 문서 드래그
    if (a.startsWith('doc-')) {
      const docId = Number(a.slice(4));
      // Shift + 카테고리로 이동
      if (shiftRef.current && b.startsWith('cat-')) {
        const targetCatId = Number(b.slice(4));
        if (!Number.isFinite(targetCatId)) return;
        fetch(`/api/documents/${docId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: String(targetCatId) }),
        }).then(() => refreshDocuments()).catch(() => {});
        return;
      }
      // 같은 리스트 내 정렬
      if (b.startsWith('doc-')) {
        const overDocId = Number(b.slice(4));
        const oldIdx = docsSorted.findIndex((d) => d.id === docId);
        const newIdx = docsSorted.findIndex((d) => d.id === overDocId);
        if (oldIdx === -1 || newIdx === -1) return;

        const re = arrayMove(docsSorted, oldIdx, newIdx);

        // 프론트 상태 갱신
        setAllDocuments((prev) => {
          const copy = [...prev];
          re.forEach((d, idx) => {
            const i = copy.findIndex((x) => x.id === d.id);
            if (i >= 0) copy[i] = { ...copy[i], order: idx };
          });
          return copy;
        });

        // 서버에 일괄 반영
        re.forEach((d, idx) => {
          fetch(`/api/documents/${d.id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ order: idx }),
          }).catch(() => {});
        });
      }
      return;
    }

    // 카테고리 드래그
    if (!(a.startsWith('cat-') && b.startsWith('cat-'))) return;

    const activeId = Number(a.slice(4));
    const overId = Number(b.slice(4));
    if (!Number.isFinite(activeId) || !Number.isFinite(overId) || activeId === overId) return;

    if (shiftRef.current) {
      moveToParent(activeId, overId);
      return;
    }

    const newTree: Category[] = structuredClone(tree);
    const parentA = findParent(newTree, activeId);
    const parentB = findParent(newTree, overId);
    if (!parentA || !parentB || parentA !== parentB) return;

    const oldIndex = parentA.children.findIndex((c) => c.id === activeId);
    const newIndex = parentA.children.findIndex((c) => c.id === overId);
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
      }).catch(() => {});
    });
  };

  const renderTree = (nodes: Category[], currentPath: number[] = [], depth = 0): JSX.Element => (
    <SortableContext items={nodes.map((n) => `cat-${n.id}`)} strategy={verticalListSortingStrategy}>
      <ul className="category-tree-list" role={depth === 0 ? 'tree' : 'group'}>
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
              hoverId={hoverId}
              shiftMode={isShift}
              appliedTags={appliedTagsMap.get(node.id) ?? []}
            >
              {open.has(node.id) && node.children.length > 0 && (
                <div className="category-tree-children">{renderTree(node.children, path, depth + 1)}</div>
              )}
            </SortableCategoryItem>
          );
        })}
      </ul>
    </SortableContext>
  );

  const handleSaveCategory = async () => {
    if (!selected || selected.id === 0) return;

    const modeTags = Array.isArray(selected.mode_tags)
      ? Array.from(new Set(selected.mode_tags.map((s) => String(s).trim().toLowerCase()).filter(Boolean)))
      : [];

    const payload = {
      name: selected.name,
      parent_id: selected.parent_id,
      order: selected.order,
      document_id: (selected as any).document_id ?? null,
      icon: typeof selected.icon === 'string' ? selected.icon : null,
      mode_tags: modeTags,
    };

    const res = await fetch(`/api/categories/${selected.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) { alert('카테고리 저장에 실패했습니다.'); return; }
    await fetchCategories();
  };

  const canDeleteSelectedCategory =
    !!selected &&
    selected.id !== 0 &&
    (isAdmin || (isWriter && selected.uploader?.toLowerCase?.() === myName));

  const canDeleteSelectedDoc =
    !!selectedDoc &&
    (isAdmin || (isWriter && selectedDoc.uploader?.toLowerCase?.() === myName));

  const canOpenCreateModal = !!selected && (isAdmin || isWriter);

  return (
    <div className="category-manager-container">
      <WikiHeader user={user} />

      {/* ✅ DnDContext로 좌/우 영역 모두 감싸기 */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragOver={onDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={() => {
          if (hoverTimerRef.current) { window.clearTimeout(hoverTimerRef.current); hoverTimerRef.current = null; }
          setHoverId(null);
        }}
      >
        <div className="category-sidebar">
          <h2 className="category-tree-title">
            <FontAwesomeIcon icon={faList} />
            &nbsp;카테고리
          </h2>
          {renderTree(tree)}
        </div>

        <div className="category-doclist">
          <h2 className="category-doclist-title">
            <FontAwesomeIcon icon={faBook} />
            &nbsp;문서 목록
          </h2>
          {docsSorted.length > 0 ? (
            <SortableContext items={docsSorted.map((d) => `doc-${d.id}`)} strategy={verticalListSortingStrategy}>
              <ul>
                {docsSorted.map((doc) => (
                  <SortableDocItem
                    key={doc.id}
                    doc={doc}
                    isSelected={selectedDoc?.id === doc.id}
                    onClick={() => setSelectedDoc(doc)}
                  />
                ))}
              </ul>
            </SortableContext>
          ) : (
            <p className="text-gray-500">문서가 없습니다.</p>
          )}
        </div>

        <div className="category-detail-panel">
          {selectedDoc ? (
            <div>
              <div className="cat-detail-header">
                <h2 className="cat-detail-title">문서 정보</h2>
                <div className="toolbar-seg">
                  <button
                    className="seg-btn"
                    onClick={() => {
                      location.href = `/wiki/write?path=${encodeURIComponent(
                        selectedDoc.path
                      )}&title=${encodeURIComponent(selectedDoc.title)}&id=${selectedDoc.id}`;
                    }}
                    title="수정"
                  >
                    <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M16.5 3.75l3.75 3.75M4.5 19.5l3.75-.938L19.5 7.875l-3.75-3.75L4.5 15.75V19.5Z" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span className="seg-label">수정</span>
                  </button>
                  <button
                    className="seg-btn danger"
                    onClick={() => { if (!canDeleteSelectedDoc) return; setDocDeleteOpen(true); }}
                    disabled={!canDeleteSelectedDoc}
                    title="삭제"
                  >
                    <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true" preserveAspectRatio="xMidYMid meet">
                      <path d="M3 6h18" strokeLinecap="round" />
                      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" strokeLinecap="round" />
                      <rect x="5" y="6" width="14" height="14" rx="2" />
                      <path d="M10 11v6M14 11v6" strokeLinecap="round" />
                    </svg>
                    <span className="seg-label">삭제</span>
                  </button>
                </div>
              </div>
              <p><strong>제목:</strong> {selectedDoc.title}</p>
              <p>
                <strong>태그:</strong>{' '}
                {selectedDoc.tags && (selectedDoc as any).tags.length > 0
                  ? (Array.isArray(selectedDoc.tags)
                      ? (selectedDoc.tags as any)
                      : (selectedDoc.tags as any)
                          .split(',')
                          .map((t: string) => t.trim())
                          .filter(Boolean)
                    ).map((tag: string) => (
                      <span key={tag} className="doc-tag">#{tag}</span>
                    ))
                  : <span style={{ color: '#aaa' }}>태그 없음</span>}
              </p>
            </div>
          ) : selected ? (
            <div>
              <div className="cat-detail-header">
                <div className="cat-title-wrap">
                  <div className="cat-avatar">
                    {(() => {
                      const ic = selected.icon;
                      if (typeof ic === 'object' && ic && 'src' in ic) {
                        return <Image src={ic as StaticImageData} alt="icon" width={32} height={32} />;
                      }
                      if (typeof ic === 'string' && ic.startsWith('http')) {
                        return (
                          <img
                            src={toProxyUrl(ic)}                           {/* ✅ CDN 우회 */}
                            alt="icon"
                            style={{ width: 32, height: 32, borderRadius: 6, objectFit: 'cover' }}
                            loading="lazy"                                  {/* ✅ lazy */}
                            decoding="async"                                {/* ✅ async */}
                          />
                        );
                      }
                      return <span>{typeof ic === 'string' ? ic : '📁'}</span>;
                    })()}
                  </div>
                  <h2 className="cat-detail-title">{selected.name}</h2>
                </div>

                <div className="toolbar-seg">
                  <button className="seg-btn" onClick={handleSaveCategory} disabled={selected.id === 0} title="저장">
                    <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                      <circle cx="12" cy="12" r="9" />
                      <path d="M8.5 12.5l2.5 2.5 4.5-4.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span className="seg-label">저장</span>
                  </button>
                  {selected.id !== 0 && (
                    <button
                      className="seg-btn danger"
                      onClick={() => { if (!canDeleteSelectedCategory) return; setCatDeleteOpen(true); }}
                      disabled={!canDeleteSelectedCategory}
                      title="삭제"
                    >
                      <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true" preserveAspectRatio="xMidYMid meet">
                        <path d="M3 6h18" strokeLinecap="round" />
                        <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" strokeLinecap="round" />
                        <rect x="5" y="6" width="14" height="14" rx="2" />
                        <path d="M10 11v6M14 11v6" strokeLinecap="round" />
                      </svg>
                      <span className="seg-label">삭제</span>
                    </button>
                  )}
                  <button
                    className="seg-btn"
                    onClick={() => { if (!canOpenCreateModal) return; setNewCatName(''); setNewCatOpen(true); }}
                    disabled={!canOpenCreateModal}
                    title={canOpenCreateModal ? '카테고리 추가' : '부모를 선택하거나 권한이 필요합니다'}
                  >
                    <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M12 6v12M6 12h12" strokeLinecap="round" />
                    </svg>
                    <span className="seg-label">카테고리</span>
                  </button>
                  <button
                    className="seg-btn"
                    onClick={() => { location.href = `/wiki/write?path=${encodeURIComponent(selected.id)}`; }}
                    title="문서"
                  >
                    <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M12 6v12M6 12h12" strokeLinecap="round" />
                    </svg>
                    <span className="seg-label">문서</span>
                  </button>
                </div>
              </div>

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

                <div className="rd-field">
                  <label className="rd-label">이모지 / 이미지</label>
                  <div className="input-with-btn">
                    <input
                      className="rd-input"
                      value={typeof selected.icon === 'string' ? selected.icon : ''}
                      onChange={(e) => setSelected({ ...selected, icon: e.target.value })}
                      disabled={selected.id === 0}
                      placeholder="🙂 또는 https://... 이미지 URL"
                      spellCheck={false}
                      autoCorrect="off"
                      autoCapitalize="off"
                    />
                    <button className="chip-btn emoji" type="button" aria-label="이미지 선택" title="이미지 선택" onClick={() => setShowImageModal(true)}>
                      🖼️
                    </button>
                  </div>
                </div>

                <div className="rd-field">
                  <label className="rd-label">모드 태그</label>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {MODE_OPTIONS.map((opt) => {
                      const active = (selected?.mode_tags ?? []).includes(opt.key);
                      const baseBtn: React.CSSProperties = {
                        padding: '6px 10px',
                        borderRadius: 999,
                        border: '1.5px solid #d1d5db',
                        background: '#fff',
                        color: '#374151',
                        fontWeight: 600,
                        lineHeight: 1,
                        cursor: selected?.id === 0 ? 'not-allowed' : 'pointer',
                        opacity: selected?.id === 0 ? 0.6 : 1,
                        transition: 'all .12s ease',
                      };
                      const activeBtn: React.CSSProperties = active
                        ? { borderColor: '#2563eb', background: '#eff6ff', color: '#1d4ed8', boxShadow: '0 0 0 3px rgba(37,99,235,.15) inset' }
                        : {};
                      return (
                        <button
                          key={opt.key}
                          type="button"
                          aria-pressed={active}
                          title={active ? '태그 해제' : '태그 적용'}
                          style={{ ...baseBtn, ...activeBtn }}
                          disabled={selected?.id === 0}
                          onClick={() => {
                            if (!selected) return;
                            const cur = new Set(selected.mode_tags ?? []);
                            cur.has(opt.key) ? cur.delete(opt.key) : cur.add(opt.key);
                            setSelected({ ...selected, mode_tags: Array.from(cur) });
                          }}
                        >
                          {active ? '✓ ' : ''}#{opt.label}
                        </button>
                      );
                    })}
                  </div>
                  <small className="help" style={{ color: '#777' }}>
                    상위 카테고리에 태그를 지정하면 하위 카테고리는 태그 유무와 관계없이 포함됩니다.
                  </small>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-gray-500">좌측에서 카테고리를 선택해주세요</p>
          )}
        </div>
      </DndContext>

      <ImageSelectModal
        open={showImageModal}
        onClose={() => setShowImageModal(false)}
        onSelectImage={(url) => {
          if (!selected) return;
          setSelected({ ...selected, icon: url });
        }}
      />

      {/* 새 카테고리 모달 */}
      <BareModal open={newCatOpen} onClose={() => setNewCatOpen(false)}>
        <div className="rd-card" role="dialog" aria-labelledby="rd-newcat-title">
          <button className="rd-exit-btn" onClick={() => setNewCatOpen(false)} aria-label="닫기">
            <svg height="20" viewBox="0 0 384 512">
              <path d="M342.6 150.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L192 210.7 86.6 105.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L146.7 256 41.4 361.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 0 45.3L192 301.3 297.4 406.6c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L237.3 256 342.6 150.6z" />
            </svg>
          </button>
          <div className="rd-card-content">
            <p className="rd-card-heading" id="rd-newcat-title">새 카테고리</p>
            <p className="rd-card-description">추가할 카테고리 이름을 입력하세요.</p>
            <input
              className="rd-input"
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newCatName.trim() && !loadingCreate) createCategory();
                if (e.key === 'Escape') setNewCatOpen(false);
              }}
              placeholder="예) 공략 모음"
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

      {/* 문서 삭제 모달 */}
      <BareModal open={docDeleteOpen} onClose={() => setDocDeleteOpen(false)}>
        <div className="rd-card" role="dialog" aria-labelledby="rd-deldoc-title">
          <button className="rd-exit-btn" onClick={() => setDocDeleteOpen(false)} aria-label="닫기">
            <svg height="20" viewBox="0 0 384 512">
              <path d="M342.6 150.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L192 210.7 86.6 105.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L146.7 256 41.4 361.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 0 45.3L192 301.3 297.4 406.6c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L237.3 256 342.6 150.6z" />
            </svg>
          </button>
          <div className="rd-card-content">
            <p className="rd-card-heading" id="rd-deldoc-title">문서 삭제</p>
            <p className="rd-card-description">
              <b>{selectedDoc?.title}</b> 문서를 삭제합니다. 계속할까요?
            </p>
          </div>
          <div className="rd-card-button-wrapper">
            <button className="rd-btn secondary" onClick={() => setDocDeleteOpen(false)}>취소</button>
            <button className="rd-btn danger" onClick={deleteDocument} disabled={loadingDocDelete}>
              {loadingDocDelete ? '삭제 중…' : '삭제'}
            </button>
          </div>
        </div>
      </BareModal>

      {/* 카테고리 삭제 모달 */}
      <BareModal open={catDeleteOpen} onClose={() => setCatDeleteOpen(false)}>
        <div className="rd-card" role="dialog" aria-labelledby="rd-delcat-title">
          <button className="rd-exit-btn" onClick={() => setCatDeleteOpen(false)} aria-label="닫기">
            <svg height="20" viewBox="0 0 384 512">
              <path d="M342.6 150.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L192 210.7 86.6 105.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L146.7 256 41.4 361.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 0 45.3L192 301.3 297.4 406.6c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L237.3 256 342.6 150.6z" />
            </svg>
          </button>
          <div className="rd-card-content">
            <p className="rd-card-heading" id="rd-delcat-title">카테고리 삭제</p>
            <p className="rd-card-description">
              <b>{selected?.name}</b> 카테고리와 그 하위 항목이 삭제됩니다. 계속할까요?
            </p>
          </div>
          <div className="rd-card-button-wrapper">
            <button className="rd-btn secondary" onClick={() => setCatDeleteOpen(false)}>취소</button>
            <button className="rd-btn danger" onClick={deleteCategory} disabled={loadingDelete}>
              {loadingDelete ? '삭제 중…' : '삭제'}
            </button>
          </div>
        </div>
      </BareModal>
    </div>
  );
}
