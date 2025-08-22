// =============================================
// File: app/manage/image/page.tsx
// =============================================
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import WikiHeader from '@/components/common/Header';
import ImageUploadModal from '@/components/image/ImageUploadModal';
import { ModalCard } from '@/components/common/Modal';
import '@/wiki/css/image.css';
import { toProxyUrl } from '@lib/cdn';

type Role = 'guest' | 'writer' | 'admin';

const ArrowIcon = ({ open }: { open: boolean }) => (
  <span
    style={{
      display: 'inline-block',
      transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
      transition: 'transform 0.15s',
      fontSize: 16,
      marginLeft: 6,
      color: '#bbb',
    }}
  >
    ▶
  </span>
);

function FolderTree({
  folders,
  parentId,
  activeId,
  selectedIds,
  onSelect,
  editingTarget,
  setEditingTarget,
  onRename,
  depth = 0,
  treeState,
  setTreeState,
  setContextMenu,
  draggingFolderId,
  dragOverFolderId,
  setDraggingFolderId,
  setDragOverFolderId,
  onMoveFolder,
}: {
  folders: Array<{ id: number; name: string; parent_id: number | null; uploader?: string }>;
  parentId: number | null;
  activeId: number | null;
  selectedIds: number[];
  onSelect: (id: number, e: React.MouseEvent) => void;
  editingTarget: { type: 'folder' | 'image'; id: number } | null;
  setEditingTarget: (t: { type: 'folder' | 'image'; id: number } | null) => void;
  onRename: (id: number, newName: string) => void;
  depth?: number;
  treeState: Record<number, boolean>;
  setTreeState: (v: (prev: Record<number, boolean>) => Record<number, boolean>) => void;
  setContextMenu: React.Dispatch<
    React.SetStateAction<{
      visible: boolean;
      x: number;
      y: number;
      target: { type: 'folder' | 'image'; id: number } | null;
    }>
  >;
  draggingFolderId: number | null;
  dragOverFolderId: number | null;
  setDraggingFolderId: (id: number | null) => void;
  setDragOverFolderId: (id: number | null) => void;
  onMoveFolder: (dragId: number, newParentId: number | null) => void;
}) {
  const [editName, setEditName] = useState('');

  useEffect(() => {
    if (editingTarget?.type === 'folder') {
      const t = folders.find((f) => f.id === editingTarget.id);
      setEditName(t?.name ?? '');
    }
  }, [editingTarget]); // folders 의존성 제거(포커스 유지)

  const list = folders.filter((f) =>
    parentId === null ? f.parent_id == null : Number(f.parent_id) === Number(parentId)
  );
  if (!list.length) return null;

  function closeSubtree(rootId: number, prev: Record<number, boolean>): Record<number, boolean> {
    const next = { ...prev };
    const childrenMap = new Map<number, number[]>();
    for (const f of folders) {
      const pid = f.parent_id == null ? -1 : Number(f.parent_id);
      (childrenMap.get(pid) ?? childrenMap.set(pid, []).get(pid)!).push(f.id);
    }
    next[rootId] = false;
    const stack = [...(childrenMap.get(rootId) || [])];
    while (stack.length) {
      const id = stack.pop()!;
      next[id] = false;
      const kids = childrenMap.get(id);
      if (kids && kids.length) stack.push(...kids);
    }
    return next;
  }

  return (
    <ul className="folder-list" style={{ paddingLeft: depth === 0 ? 0 : 16 }}>
      {list.map((folder) => {
        const hasChildren = folders.some((f) => Number(f.parent_id) === Number(folder.id));
        const isOpen = treeState[folder.id] ?? false;
        const isEditingThisFolder =
          editingTarget?.type === 'folder' && editingTarget.id === folder.id;
        const isDropTarget = dragOverFolderId === folder.id;
        const isSelected = selectedIds.includes(folder.id);
        const isActive = activeId === folder.id;

        return (
          <li key={folder.id} className="folder-item" style={{ position: 'relative' }}>
            <div className="folder-row">
              {isEditingThisFolder ? (
                <input
                  type="text"
                  className="folder-edit-input"
                  autoFocus
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onBlur={() => {
                    const v = editName.trim();
                    const before = folders.find((f) => f.id === folder.id)?.name ?? '';
                    if (v && v !== before) onRename(folder.id, v);
                    setEditingTarget(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const v = editName.trim();
                      const before = folders.find((f) => f.id === folder.id)?.name ?? '';
                      if (v && v !== before) onRename(folder.id, v);
                      setEditingTarget(null);
                    } else if (e.key === 'Escape') {
                      setEditingTarget(null);
                    }
                  }}
                  style={{ width: 120 }}
                />
              ) : (
                <button
                  className={'folder-btn' + (isActive || isSelected ? ' active' : '')}
                  style={{
                    zIndex: 2,
                    minHeight: 28,
                    outline: isDropTarget ? '2px dashed #86e291' : undefined,
                    background: isDropTarget ? '#f3fff7' : undefined,
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(folder.id, e);
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onSelect(folder.id, e);
                    setContextMenu({
                      visible: true,
                      x: e.clientX,
                      y: e.clientY,
                      target: { type: 'folder', id: folder.id },
                    });
                  }}
                  draggable
                  onDragStart={(e) => {
                    setDraggingFolderId(folder.id);
                    e.dataTransfer.setData('text/plain', String(folder.id));
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                  onDragOver={(e) => {
                    if (draggingFolderId === folder.id) return;
                    e.preventDefault();
                    setDragOverFolderId(folder.id);
                    e.dataTransfer.dropEffect = 'move';
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const dragId =
                      draggingFolderId ?? Number(e.dataTransfer.getData('text/plain'));
                    setDragOverFolderId(null);
                    if (Number.isFinite(dragId) && dragId !== folder.id) {
                      onMoveFolder(dragId, folder.id);
                    }
                  }}
                  onDragEnd={() => {
                    setDraggingFolderId(null);
                    setDragOverFolderId(null);
                  }}
                >
                  <span role="img" aria-label="folder">
                    📁
                  </span>
                  {folder.name}
                </button>
              )}

              {hasChildren && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setTreeState((prev) => {
                      const isOpen = !!prev[folder.id];
                      let next: Record<number, boolean>;
                      if (isOpen) next = closeSubtree(folder.id, prev);
                      else next = { ...prev, [folder.id]: true };
                      if (typeof window !== 'undefined') {
                        localStorage.setItem('imgmgr.treeState', JSON.stringify(next));
                      }
                      return next;
                    });
                  }}
                  aria-label={isOpen ? '접기' : '펼치기'}
                  className="folder-tree-arrowbtn"
                  tabIndex={-1}
                >
                  <ArrowIcon open={isOpen} />
                </button>
              )}
            </div>

            {hasChildren && isOpen && (
              <FolderTree
                folders={folders}
                parentId={folder.id}
                activeId={activeId}
                selectedIds={selectedIds}
                onSelect={onSelect}
                editingTarget={editingTarget}
                setEditingTarget={setEditingTarget}
                onRename={onRename}
                depth={depth + 1}
                treeState={treeState}
                setTreeState={setTreeState}
                setContextMenu={setContextMenu}
                draggingFolderId={draggingFolderId}
                dragOverFolderId={dragOverFolderId}
                setDraggingFolderId={setDraggingFolderId}
                setDragOverFolderId={setDragOverFolderId}
                onMoveFolder={onMoveFolder}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}

function FileList({
  images,
  currentFolderId,
  onSelect,
  onContextMenuImage,
  selectedItems,
  searchQuery,
}: {
  images: Array<{ id: number; name: string; url: string; folder_id: number; uploader?: string }>;
  currentFolderId: number | null;
  onSelect: (item: any, e: React.MouseEvent) => void;
  onContextMenuImage: (item: any, e: React.MouseEvent) => void;
  selectedItems: any[];
  searchQuery: string;
}) {
  const q = searchQuery.trim().toLowerCase();
  const imgs = useMemo(
    () =>
      images
        .filter((img) => Number(img.folder_id) === Number(currentFolderId))
        .filter((img) => !q || img.name.toLowerCase().includes(q)),
    [images, currentFolderId, q]
  );

  const isSelected = (img: any) => selectedItems.some((sel) => sel.id === img.id);

  return (
    <div className="image-explorer-filelist">
      {imgs.map((img) => (
        <div
          key={'img-' + img.id}
          className={'image-explorer-thumbnail' + (isSelected(img) ? ' selected' : '')}
          onClick={(e) => {
            e.stopPropagation();
            onSelect({ ...img, type: 'image' }, e);
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onContextMenuImage({ ...img, type: 'image' }, e);
          }}
          tabIndex={0}
        >
          <div className="image-explorer-thumbbox">
            <img
              src={toProxyUrl(img.url)}       // ✅ CloudFront 경유
              alt={img.name}
              className="image-explorer-thumbimg"
              loading="lazy"                  // ✅ lazy
              decoding="async"                // ✅ async
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = '/default-thumbnail.png';
              }}
            />
          </div>
          <span className="thumbnail-label">
            {(() => {
              const i = img.name.lastIndexOf('.');
              const base = i !== -1 ? img.name.slice(0, i) : img.name;
              return base.length > 12 ? base.slice(0, 12) + '…' : base;
            })()}
          </span>
        </div>
      ))}
      {imgs.length === 0 && <div className="text-gray-400 mt-8">이 폴더에는 이미지가 없습니다.</div>}
    </div>
  );
}

export default function ImageManagePage() {
  const [user, setUser] = useState<any>(null);
  useEffect(() => {
    fetch('/api/auth/me', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => setUser(d?.user ?? null));
  }, []);

  const role: Role =
    (user?.role === 'admin' || user?.role === 'writer') ? (user.role as Role) : 'guest';
  const isAdmin = role === 'admin';
  const isWriter = role === 'writer';

  const myName = (user?.minecraft_name ?? '').toLowerCase(); // ⚠️ 업로더 비교는 minecraft_name 기준

  const [folders, setFolders] = useState<
    Array<{ id: number; name: string; parent_id: number | null; uploader?: string }>
  >([]);
  const [images, setImages] = useState<
    Array<{ id: number; name: string; url: string; folder_id: number; uploader?: string }>
  >([]);
  const [selectedFolder, setSelectedFolder] = useState<number | null>(null);
  const [selectedFolderIds, setSelectedFolderIds] = useState<number[]>([]);
  const [selectedItems, setSelectedItems] = useState<any[]>([]);
  const [editingTarget, setEditingTarget] = useState<{ type: 'image' | 'folder'; id: number } | null>(
    null
  );
  const [imageEditName, setImageEditName] = useState('');
  const [treeState, setTreeState] = useState<Record<number, boolean>>({});
  const [uploadOpen, setUploadOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    target: { type: 'folder' | 'image'; id: number } | null;
  }>({ visible: false, x: 0, y: 0, target: null });
  const [deletingType, setDeletingType] = useState<'folder' | 'image' | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [draggingFolderId, setDraggingFolderId] = useState<number | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<number | null>(null);

  const normalizeFolders = (data: any[]) =>
    data.map((f) => ({
      id: Number(f.id),
      name: String(f.name),
      parent_id: f.parent_id === null || f.parent_id === undefined ? null : Number(f.parent_id),
      uploader: f.uploader ? String(f.uploader) : undefined, // <- 받으면 보관
    }));

  const normalizeImages = (data: any[]) =>
    data.map((i) => ({
      id: Number(i.id),
      name: String(i.name),
      url: String(i.url),
      folder_id: Number(i.folder_id),
      uploader: i.uploader ? String(i.uploader) : undefined, // <- 받으면 보관
    }));

  const reloadFolders = useCallback(
    async ({ restoreSelection = false }: { restoreSelection?: boolean } = {}) => {
      const q = `?ts=${Date.now()}`;
      const res = await fetch('/api/image/folder/list' + q, { cache: 'no-store' });
      const raw = await res.json();
      const data = normalizeFolders(raw);
      setFolders(data);

      if (typeof window !== 'undefined') {
        const savedTree = localStorage.getItem('imgmgr.treeState');
        if (savedTree) {
          try {
            const parsed: Record<string, boolean> = JSON.parse(savedTree);
            const cast: Record<number, boolean> = {};
            Object.keys(parsed).forEach((k) => (cast[Number(k)] = !!parsed[k]));
            setTreeState((prev) => (Object.keys(prev).length ? prev : cast));
          } catch {
            const init: Record<number, boolean> = {};
            data.forEach((f) => {
              if (f.parent_id == null) init[f.id] = true;
            });
            setTreeState(init);
          }
        } else {
          const init: Record<number, boolean> = {};
          data.forEach((f) => {
            if (f.parent_id == null) init[f.id] = true;
          });
          setTreeState(init);
        }

        if (restoreSelection) {
          const savedSel = localStorage.getItem('imgmgr.selectedFolder');
          if (savedSel !== null) {
            if (savedSel === '' || savedSel === 'null') {
              setSelectedFolder(null);
              setSelectedFolderIds([]);
            } else {
              const n = Number(savedSel);
              const valid = Number.isFinite(n) && n > 0 ? n : null;
              setSelectedFolder(valid);
              setSelectedFolderIds(valid != null ? [valid] : []);
            }
          }
        }
      }
    },
    []
  );

  const refreshImages = useCallback(() => {
    if (!selectedFolder) {
      setImages([]);
      return;
    }
    const q = `&ts=${Date.now()}`;
    fetch(`/api/image/view?folder_id=${selectedFolder}${q}`, { cache: 'no-store' })
      .then((res) => res.json())
      .then((raw) => setImages(normalizeImages(raw)));
  }, [selectedFolder]);

  useEffect(() => {
    reloadFolders({ restoreSelection: true });
  }, [reloadFolders]);

  useEffect(() => {
    setSelectedItems([]);
    if (typeof window !== 'undefined') {
      localStorage.setItem(
        'imgmgr.selectedFolder',
        selectedFolder === null ? '' : String(selectedFolder)
      );
    }
    refreshImages();
  }, [selectedFolder, refreshImages]);

  const handleImagesUploaded = () => refreshImages();

  const createFolderRequest = async (name: string, parentId: number | null) => {
    const res = await fetch('/api/image/folder/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, parent_id: parentId ?? null }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || '폴더 생성 실패');
    return data.folder;
  };

  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const handleCreateFolder = async () => {
    const name = newFolderName.trim();
    if (!name) return;
    try {
      const parentId = selectedFolder ?? null;
      await createFolderRequest(name, parentId);
      setNewFolderName('');
      setNewFolderOpen(false);

      if (parentId !== null) {
        setTreeState((prev) => {
          const next = { ...prev, [parentId]: true };
          if (typeof window !== 'undefined') {
            localStorage.setItem('imgmgr.treeState', JSON.stringify(next));
          }
          return next;
        });
      }

      await reloadFolders({ restoreSelection: false });
    } catch (e: any) {
      alert(e.message || '폴더 생성 실패');
    }
  };

  const handleRename = async (id: number, newName: string) => {
    const res = await fetch('/api/image/folder/rename', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, name: newName }),
    });
    if (res.ok) {
      await reloadFolders({ restoreSelection: false });
    } else {
      alert((await res.json()).error || '이름 변경 실패');
    }
  };

  const handleDeleteFolderSingle = async () => {
    if (!selectedFolder) return;

    // writer면 내 폴더만
    if (!isAdmin) {
      const f = folders.find((x) => x.id === selectedFolder);
      const ok = isWriter && f?.uploader?.toLowerCase?.() === myName;
      if (!ok) {
        alert('본인이 생성한 폴더만 삭제할 수 있습니다.');
        return;
      }
    }

    const res = await fetch('/api/image/folder/delete', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: selectedFolder }),
    });
    if (res.ok) {
      await reloadFolders({ restoreSelection: false });
      setSelectedFolder(null);
      setSelectedFolderIds([]);
      setSelectedItems([]);
      setImages([]);
    } else {
      alert((await res.json()).error || '삭제 실패');
    }
    setShowDeleteModal(false);
    setDeletingType(null);
  };

  const handleDeleteImages = async (idsOverride?: number[]) => {
    const ids = idsOverride ?? selectedItems.map((i) => i.id);
    if (!ids.length) return;

    // writer면 내 이미지들만 전부 선택되어 있어야 함
    if (!isAdmin) {
      const allMine = isWriter && selectedItems.every(
        (i) => i.type === 'image' && i.uploader?.toLowerCase?.() === myName
      );
      if (!allMine) {
        alert('본인이 업로드한 이미지만 삭제할 수 있습니다.');
        return;
      }
    }

    const res = await fetch('/api/image/delete', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    });
    if (res.ok) {
      refreshImages();
      setSelectedItems([]);
    } else {
      alert('삭제 실패');
    }
    setShowDeleteModal(false);
    setDeletingType(null);
  };

  const handleImageRename = async () => {
    if (!editingTarget || editingTarget.type !== 'image') return;
    const res = await fetch('/api/image/rename', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: editingTarget.id, name: imageEditName.trim() }),
    });
    if (res.ok) {
      refreshImages();
      setEditingTarget(null);
    } else {
      alert('이름 변경 실패');
    }
  };

  const handleFileListSelect = (item: any, e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey) {
      setSelectedItems((prev) => {
        const exists = prev.some((i) => i.id === item.id);
        return exists ? prev.filter((i) => i.id !== item.id) : [...prev, item];
      });
    } else {
      setSelectedItems([item]);
    }
  };

  const handleThumbContextMenu = (item: any, e: React.MouseEvent) => {
    setSelectedItems([item]);
    setContextMenu({
      visible: true,
      x: (e as any).clientX,
      y: (e as any).clientY,
      target: { type: 'image', id: item.id },
    });
  };

  const getDescendantIds = useCallback(
    (rootId: number) => {
      const childrenMap = new Map<number, number[]>();
      folders.forEach((f) => {
        const pid = f.parent_id ?? -1;
        childrenMap.set(pid, [...(childrenMap.get(pid) || []), f.id]);
      });
      const out = new Set<number>();
      const walk = (id: number) => {
        const kids = childrenMap.get(id) || [];
        for (const k of kids) {
          if (!out.has(k)) {
            out.add(k);
            walk(k);
          }
        }
      };
      walk(rootId);
      return out;
    },
    [folders]
  );

  const moveFolder = useCallback(
    async (dragId: number, newParentId: number | null) => {
      if (dragId === newParentId) return;
      if (newParentId !== null) {
        const descendants = getDescendantIds(dragId);
        if (descendants.has(newParentId)) {
          alert('하위 폴더로는 이동할 수 없어요.');
          return;
        }
      }
      const drag = folders.find((f) => f.id === dragId);
      if (drag) {
        const dup = folders.some(
          (f) =>
            (f.parent_id ?? null) === (newParentId ?? null) &&
            f.name === drag.name &&
            f.id !== dragId
        );
        if (dup) {
          alert('해당 위치에 같은 이름의 폴더가 있어요.');
          return;
        }
      }

      const res = await fetch('/api/image/folder/move', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: dragId, new_parent_id: newParentId }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(d?.error || '폴더 이동 실패');
        return;
      }

      setTreeState((prev) => {
        const next = { ...prev };
        if (newParentId !== null) next[newParentId] = true;
        if (typeof window !== 'undefined') {
          localStorage.setItem(
            'imgmgr.selectedFolder',
            selectedFolder === null ? 'null' : String(selectedFolder)
          );
        }
        return next;
      });

      await reloadFolders();
      setDraggingFolderId(null);
      setDragOverFolderId(null);
    },
    [folders, getDescendantIds, reloadFolders, selectedFolder]
  );

  const clearImageSelection = useCallback(() => {
    setSelectedItems([]);
    setEditingTarget((t) => (t?.type === 'image' ? null : t));
  }, []);

  const isClickOnInteractive = (el: HTMLElement | null) =>
    !!el?.closest('.seg-input, .seg-btn, .rd-context-menu, .rd-btn, .folder-edit-input');

  const onFolderSelect = (id: number, e: React.MouseEvent) => {
    const multi = e.ctrlKey || e.metaKey;
    if (multi) {
      setSelectedFolder(id);
      setSelectedFolderIds((prev) => {
        const has = prev.includes(id);
        const next = has ? prev.filter((v) => v !== id) : [...prev, id];
        return next;
      });
    } else {
      setSelectedFolder(id);
      setSelectedFolderIds([id]);
    }
    clearImageSelection();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const active = document.activeElement as HTMLElement | null;
      if (active && ['INPUT', 'TEXTAREA'].includes(active.tagName)) return;

      if (e.key === 'Delete' || e.key === 'Del') {
        if (selectedItems.length) {
          setShowDeleteModal(true);
          setDeletingType('image');
          e.preventDefault();
        } else if (selectedFolderIds.length || selectedFolder) {
          setShowDeleteModal(true);
          setDeletingType('folder');
          e.preventDefault();
        }
      }
      if (e.key === 'F2') {
        if (selectedItems.length === 1 && selectedItems[0].type === 'image') {
          setEditingTarget({ type: 'image', id: selectedItems[0].id });
          setImageEditName(selectedItems[0].name);
          e.preventDefault();
        } else if (!selectedItems.length && selectedFolder && selectedFolderIds.length <= 1) {
          setEditingTarget({ type: 'folder', id: selectedFolder });
          e.preventDefault();
        }
      }
      if (e.key === 'Escape') {
        if (selectedItems.length || editingTarget?.type === 'image') {
          clearImageSelection();
          e.preventDefault();
        }
      }
    };
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true });
  }, [selectedFolder, selectedFolderIds, selectedItems, editingTarget, clearImageSelection]);

  useEffect(() => {
    if (!contextMenu.visible) return;
    const close = () => setContextMenu((v) => ({ ...v, visible: false }));
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('mousedown', close);
    window.addEventListener('scroll', close, true);
    window.addEventListener('contextmenu', close);
    window.addEventListener('keydown', esc);
    return () => {
      window.removeEventListener('mousedown', close);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('contextmenu', close);
      window.removeEventListener('keydown', esc);
    };
  }, [contextMenu.visible]);

  const canRenameImage = selectedItems.length === 1 && selectedItems[0].type === 'image';
  const isMultiFolder = selectedFolderIds.length > 1;
  const isMultiImage = selectedItems.length > 1;
  const isMultiSelecting = isMultiFolder || isMultiImage;

  // 삭제 버튼 활성화 판단(클라이언트가 1차 가드, 최종 검증은 서버)
  const allSelectedImagesMine =
    selectedItems.length > 0 &&
    selectedItems.every((i) => i.type === 'image' && i.uploader?.toLowerCase?.() === myName);

  const folderOwnedByMe = (id: number | null) => {
    if (id == null) return false;
    const f = folders.find((x) => x.id === id);
    return !!f && f.uploader?.toLowerCase?.() === myName;
  };

  const allSelectedFoldersMine =
    (selectedFolderIds.length > 0 &&
      selectedFolderIds.every((id) => folderOwnedByMe(id))) ||
    (selectedFolder !== null && selectedFolderIds.length === 0 && folderOwnedByMe(selectedFolder));

  const canDeleteAllSelectedImages = isAdmin || (isWriter && allSelectedImagesMine);
  const canDeleteAllSelectedFolders = isAdmin || (isWriter && allSelectedFoldersMine);

  const somethingSelected =
    selectedItems.length > 0 || selectedFolderIds.length > 0 || selectedFolder !== null;

  const deleteBtnDisabled =
    !somethingSelected ||
    (selectedItems.length > 0 && !canDeleteAllSelectedImages) ||
    ((selectedFolderIds.length > 0 || selectedFolder !== null) && !canDeleteAllSelectedFolders);

  const closeNewFolder = useCallback(() => setNewFolderOpen(false), []);
  const closeImageRename = useCallback(() => setEditingTarget(null), []);
  const closeDeleteModal = useCallback(() => {
    setShowDeleteModal(false);
    setDeletingType(null);
  }, []);

  return (
    <div className="wiki-container">
      <WikiHeader user={user} />

      <div className="image-explorer-viewport">
        <div className="image-explorer-layout">
          <aside
            className="image-explorer-sidebar"
            onMouseDown={(e) => {
              const el = e.target as HTMLElement;
              if (el.closest('.folder-edit-input')) return;
              clearImageSelection();
            }}
          >
            <div
              className={'folder-btn' + (selectedFolder === null ? ' active bg-blue-100' : '')}
              onClick={() => {
                setSelectedFolder(null);
                setSelectedFolderIds([]);
                setSelectedItems([]);
                if (typeof window !== 'undefined') {
                  localStorage.setItem('imgmgr.selectedFolder', 'null');
                }
              }}
              style={{
                cursor: 'pointer',
                outline: dragOverFolderId === -1 ? '2px dashed #86e291' : undefined,
                background: dragOverFolderId === -1 ? '#f3fff7' : undefined,
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                setContextMenu({
                  visible: true,
                  x: e.clientX,
                  y: e.clientY,
                  target: null,
                });
              }}
              onDragOver={(e) => {
                if (draggingFolderId != null) {
                  e.preventDefault();
                  setDragOverFolderId(-1);
                }
              }}
              onDragLeave={() => {
                if (dragOverFolderId === -1) setDragOverFolderId(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                const dragId =
                  draggingFolderId ?? Number(e.dataTransfer.getData('text/plain'));
                setDragOverFolderId(null);
                if (Number.isFinite(dragId)) {
                  moveFolder(dragId, null);
                }
              }}
            >
              <span>📂</span> RDWIKI
            </div>
            <FolderTree
              folders={folders}
              parentId={null}
              activeId={selectedFolder}
              selectedIds={selectedFolderIds}
              onSelect={onFolderSelect}
              editingTarget={editingTarget}
              setEditingTarget={setEditingTarget}
              onRename={handleRename}
              treeState={treeState}
              setTreeState={setTreeState}
              setContextMenu={setContextMenu}
              draggingFolderId={draggingFolderId}
              dragOverFolderId={dragOverFolderId}
              setDraggingFolderId={setDraggingFolderId}
              setDragOverFolderId={setDragOverFolderId}
              onMoveFolder={(dragId, newPid) => moveFolder(dragId, newPid)}
            />
          </aside>

          <section
            className="image-explorer-content"
            onMouseDown={(e) => {
              const el = e.target as HTMLElement;
              if (isClickOnInteractive(el) || el.closest('.image-explorer-thumbnail')) return;
              clearImageSelection();
            }}
          >
            <div className="image-explorer-header-bar">
              <h1 className="image-explorer-title">이미지 업로드/관리</h1>

              <div className="toolbar-search">
                <div className="seg-input">
                  <svg
                    className="ico"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    aria-hidden="true"
                  >
                    <circle cx="11" cy="11" r="7" />
                    <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
                  </svg>
                  <input
                    className="seg-input-field"
                    placeholder="파일명 검색"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    aria-label="파일명 검색"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      className="seg-input-clear"
                      onClick={() => setSearchQuery('')}
                      aria-label="검색어 지우기"
                      title="지우기"
                    >
                      <svg
                        className="ico"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        aria-hidden="true"
                      >
                        <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>

              <div className="image-explorer-header-btns">
                <div className="toolbar-seg">
                  <button
                    type="button"
                    className="seg-btn"
                    onClick={() => setNewFolderOpen(true)}
                    title="새 폴더"
                  >
                    <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M3.75 7.5h6l1.5 1.5h9a1.5 1.5 0 011.5 1.5v7.5A1.5 1.5 0 0120.75 21h-15A2.25 2.25 0 013.5 18.75V9A1.5 1.5 0 013.75 7.5Z" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M12 12v4m-2-2h4" strokeLinecap="round" />
                    </svg>
                    <span className="seg-label">새 폴더</span>
                  </button>

                  <button
                    type="button"
                    className="seg-btn"
                    onClick={() => setUploadOpen(true)}
                    disabled={!selectedFolder || isMultiSelecting}
                    title={isMultiSelecting ? '다중 선택 중에는 업로드 불가' : '업로드'}
                  >
                    <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M6.75 19.5A4.5 4.5 0 015.34 10.725 A5.25 5.25 0 0115.573 8.395 A3 3 0 0118 14.25h-.75" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M12 15.75V9.75m0 0l3 3m-3-3l-3 3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span className="seg-label">업로드</span>
                  </button>

                  <button
                    type="button"
                    className="seg-btn danger"
                    onClick={() => {
                      if (selectedItems.length) {
                        setShowDeleteModal(true);
                        setDeletingType('image');
                      } else if (selectedFolderIds.length || selectedFolder !== null) {
                        setShowDeleteModal(true);
                        setDeletingType('folder');
                      }
                    }}
                    disabled={deleteBtnDisabled}
                    title="삭제"
                  >
                    <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M9.75 9.75v6.75M14.25 9.75v6.75M4.5 7.5h15M9 4.5h6m-8.25 3L7.5 19.5a2.25 2.25 0 002.25 2.25h4.5A2.25 2.25 0 0016.5 19.5L18.75 7.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span className="seg-label">삭제</span>
                  </button>

                  <button
                    type="button"
                    className="seg-btn"
                    onClick={() => {
                      if (canRenameImage) {
                        setEditingTarget({ type: 'image', id: selectedItems[0].id });
                        setImageEditName(selectedItems[0].name);
                      } else if (!selectedItems.length && selectedFolder && selectedFolderIds.length <= 1) {
                        setEditingTarget({ type: 'folder', id: selectedFolder });
                        setContextMenu((v) => ({ ...v, visible: false }));
                      }
                    }}
                    disabled={
                      isMultiSelecting ||
                      !(canRenameImage || (!selectedItems.length && selectedFolder && selectedFolderIds.length <= 1))
                    }
                    title={isMultiSelecting ? '다중 선택 중에는 이름 변경 불가' : '이름변경'}
                  >
                    <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M16.5 3.75l3.75 3.75M4.5 19.5l3.75-.938L19.5 7.875l-3.75-3.75L4.5 15.75V19.5Z" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span className="seg-label">이름변경</span>
                  </button>
                </div>
              </div>
            </div>

            <div
              className="image-explorer-filelist-outer"
              onMouseDown={(e) => {
                e.stopPropagation();
                const el = e.target as HTMLElement;
                if (el.closest('.image-explorer-thumbnail')) return;
                clearImageSelection();
              }}
              onDragEnter={(e) => {
                e.preventDefault();
                e.currentTarget.classList.add('dragover');
              }}
              onDragOver={(e) => e.preventDefault()}
              onDragLeave={(e) => {
                e.currentTarget.classList.remove('dragover');
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.currentTarget.classList.remove('dragover');
                if (!selectedFolder) return;
                setUploadOpen(true);
              }}
            >
              <FileList
                images={images}
                currentFolderId={selectedFolder}
                onSelect={handleFileListSelect}
                onContextMenuImage={handleThumbContextMenu}
                selectedItems={selectedItems}
                searchQuery={searchQuery}
              />
            </div>
          </section>
        </div>
      </div>

      {contextMenu.visible && (
        <div
          className="rd-context-menu"
          style={{
            position: 'fixed',
            top: contextMenu.y,
            left: contextMenu.x,
            background: '#fff',
            border: '1.5px solid #bbb',
            borderRadius: 8,
            boxShadow: '0 2px 14px 0 rgba(0,0,0,0.13)',
            zIndex: 3000,
            minWidth: 160,
            padding: '6px 0',
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.target?.type === 'folder' && (
            <>
              <button
                className="w-full px-4 py-2 text-left hover:bg-gray-100"
                onClick={() => {
                  clearImageSelection();
                  setSelectedFolder(contextMenu.target!.id);
                  setSelectedFolderIds([contextMenu.target!.id]);
                  setEditingTarget({ type: 'folder', id: contextMenu.target!.id });
                  setContextMenu((v) => ({ ...v, visible: false }));
                }}
              >
                ✏️ 이름 변경
              </button>
              <button
                className="w-full px-4 py-2 text-left hover:bg-gray-100 text-red-500"
                onClick={() => {
                  clearImageSelection();
                  setSelectedFolder(contextMenu.target!.id);
                  setSelectedFolderIds([contextMenu.target!.id]);
                  setShowDeleteModal(true);
                  setDeletingType('folder');
                  setContextMenu((v) => ({ ...v, visible: false }));
                }}
              >
                🗑 삭제
              </button>
            </>
          )}

          {contextMenu.target?.type === 'image' && (
            <>
              <button
                className="w-full px-4 py-2 text-left hover:bg-gray-100"
                onClick={() => {
                  setSelectedItems([
                    {
                      id: contextMenu.target!.id,
                      type: 'image',
                      name: images.find((i) => i.id === contextMenu.target!.id)?.name,
                      uploader: images.find((i) => i.id === contextMenu.target!.id)?.uploader,
                    },
                  ]);
                  const target = images.find((i) => i.id === contextMenu.target!.id);
                  setEditingTarget({ type: 'image', id: contextMenu.target!.id });
                  setImageEditName(target?.name ?? '');
                  setContextMenu((v) => ({ ...v, visible: false }));
                }}
              >
                ✏️ 이름 변경
              </button>
              <button
                className="w-full px-4 py-2 text-left hover:bg-gray-100"
                onClick={async () => {
                  const target = images.find((i) => i.id === contextMenu.target!.id);
                  if (!target) return;
                  try {
                    await navigator.clipboard.writeText(toProxyUrl(target.url));
                    setContextMenu((v) => ({ ...v, visible: false }));
                  } catch {
                    alert('클립보드 복사 실패');
                  }
                }}
              >
                🔗 URL 복사
              </button>
              <button
                className="w-full px-4 py-2 text-left hover:bg-gray-100 text-red-500"
                onClick={() => {
                  setShowDeleteModal(true);
                  setDeletingType('image');
                  const target = images.find((i) => i.id === contextMenu.target!.id);
                  setSelectedItems([{ id: contextMenu.target!.id, type: 'image', uploader: target?.uploader }]);
                  setContextMenu((v) => ({ ...v, visible: false }));
                }}
              >
                🗑 삭제
              </button>
            </>
          )}
        </div>
      )}

      <ModalCard
        open={newFolderOpen}
        onClose={closeNewFolder}
        title="새 폴더"
        actions={
          <>
            <button className="rd-btn secondary" onClick={closeNewFolder}>
              취소
            </button>
            <button
              className="rd-btn primary"
              onClick={handleCreateFolder}
              disabled={!newFolderName.trim()}
            >
              생성
            </button>
          </>
        }
      >
        <p className="rd-card-description">폴더 이름을 입력하세요.</p>
        <input
          className="rd-input"
          value={newFolderName}
          onChange={(e) => setNewFolderName(e.target.value)}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleCreateFolder();
            if (e.key === 'Escape') closeNewFolder();
          }}
          placeholder="예) 스크린샷"
        />
      </ModalCard>

      <ModalCard
        open={!!editingTarget && editingTarget.type === 'image'}
        onClose={closeImageRename}
        title="이름 변경"
        actions={
          <>
            <button className="rd-btn secondary" onClick={closeImageRename}>
              취소
            </button>
            <button className="rd-btn primary" onClick={handleImageRename}>
              저장
            </button>
          </>
        }
      >
        <p className="rd-card-description">새 파일명을 입력하세요.</p>
        <input
          className="rd-input"
          value={imageEditName}
          onChange={(e) => setImageEditName(e.target.value)}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleImageRename();
            if (e.key === 'Escape') closeImageRename();
          }}
        />
      </ModalCard>

      <ModalCard
        open={showDeleteModal}
        onClose={closeDeleteModal}
        title={deletingType === 'folder' ? '폴더 삭제' : '이미지 삭제'}
        actions={
          <>
            <button className="rd-btn secondary" onClick={closeDeleteModal}>
              취소
            </button>
            <button
              className="rd-btn danger"
              onClick={async () => {
                if (deletingType === 'folder') {
                  if (selectedFolderIds.length > 1) {
                    // 다중 폴더 삭제: writer는 전부 본인 폴더여야 함
                    if (!isAdmin) {
                      const mine = isWriter && selectedFolderIds.every((id) => folderOwnedByMe(id));
                      if (!mine) {
                        alert('본인이 생성한 폴더만 삭제할 수 있습니다.');
                        return;
                      }
                    }
                    const exclude = new Set<number>();
                    for (const id of selectedFolderIds) {
                      const desc = getDescendantIds(id);
                      for (const d of desc) if (selectedFolderIds.includes(d)) exclude.add(d);
                    }
                    const roots = selectedFolderIds.filter((id) => !exclude.has(id));
                    for (const id of roots) {
                      const r = await fetch('/api/image/folder/delete', {
                        method: 'DELETE',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ id }),
                      });
                      if (!r.ok) {
                        const d = await r.json().catch(() => ({}));
                        alert(d?.error || '삭제 실패');
                        break;
                      }
                    }
                    await reloadFolders({ restoreSelection: false });
                    setSelectedFolder(null);
                    setSelectedFolderIds([]);
                    setSelectedItems([]);
                    setImages([]);
                    closeDeleteModal();
                  } else {
                    await handleDeleteFolderSingle();
                  }
                } else {
                  await handleDeleteImages();
                }
              }}
            >
              삭제
            </button>
          </>
        }
      >
        <p className="rd-card-description">
          {deletingType === 'folder' ? (
            selectedFolderIds.length > 1 ? (
              <>선택한 <b>{selectedFolderIds.length}</b>개 폴더와 모든 하위 항목이 삭제됩니다. 계속하시겠습니까?</>
            ) : (
              <>
                <b>{folders.find((f) => f.id === (selectedFolderIds[0] ?? selectedFolder))?.name}</b> 폴더와 모든 하위 항목이
                삭제됩니다. 계속하시겠습니까?
              </>
            )
          ) : selectedItems.length > 1 ? (
            <>정말 <b>{selectedItems.length}개</b> 이미지를 삭제하시겠습니까?</>
          ) : (
            <>정말 <b>{selectedItems[0]?.name ?? '선택 이미지'}</b> 이미지를 삭제하시겠습니까?</>
          )}
        </p>
      </ModalCard>

      <ImageUploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        folderId={selectedFolder}
        onUploaded={handleImagesUploaded}
      />
    </div>
  );
}
