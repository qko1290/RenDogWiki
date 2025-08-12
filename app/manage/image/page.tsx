// =============================================
// File: app/manage/image/page.tsx
// (클라이언트: 캐시 무효화 & 재조회 패턴 + 폴더 DnD 이동)
// =============================================
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import WikiHeader from '@/components/common/Header';
import ImageUploadModal from '@/components/image/ImageUploadModal';
import { ModalCard } from '@/components/common/Modal'; // ✅ 공용 모달 카드만 사용(중복 제거)
import '@/wiki/css/image.css';

/* ─────────────── ArrowIcon ─────────────── */
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

/* ─────────────── FolderTree ─────────────── */
function FolderTree({
  folders,
  parentId,
  selectedId,
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
  folders: Array<{ id: number; name: string; parent_id: number | null }>;
  parentId: number | null;
  selectedId: number | null;
  onSelect: (id: number | null) => void;
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
  onMoveFolder: (dragId: number, newParentId: number) => void;
}) {
  const [editName, setEditName] = useState('');

  useEffect(() => {
    if (editingTarget?.type === 'folder') {
      const t = folders.find((f) => f.id === editingTarget.id);
      if (t) setEditName(t.name);
    }
  }, [editingTarget, folders]);

  const list = folders.filter((f) =>
    parentId === null ? f.parent_id == null : Number(f.parent_id) === Number(parentId)
  );
  if (!list.length) return null;

  return (
    <ul className="folder-list" style={{ paddingLeft: depth === 0 ? 0 : 16 }}>
      {list.map((folder) => {
        const hasChildren = folders.some((f) => Number(f.parent_id) === Number(folder.id));
        const isOpen = treeState[folder.id] ?? false;
        const isEditingThisFolder =
          editingTarget?.type === 'folder' && editingTarget.id === folder.id;
        const isDropTarget = dragOverFolderId === folder.id;

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
                    if (v && v !== (folders.find((f) => f.id === folder.id)?.name ?? '')) {
                      onRename(folder.id, v);
                    }
                    setEditingTarget(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const v = editName.trim();
                      if (v && v !== (folders.find((f) => f.id === folder.id)?.name ?? '')) {
                        onRename(folder.id, v);
                      }
                      setEditingTarget(null);
                    } else if (e.key === 'Escape') {
                      setEditingTarget(null);
                    }
                  }}
                  style={{ width: 120 }}
                />
              ) : (
                <button
                  className={'folder-btn' + (selectedId === folder.id ? ' active' : '')}
                  style={{
                    zIndex: 2,
                    minHeight: 28,
                    outline: isDropTarget ? '2px dashed #86e291' : undefined,
                    background: isDropTarget ? '#f3fff7' : undefined,
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(folder.id);
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onSelect(folder.id);
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
                    if (draggingFolderId === folder.id) return; // 자기 자신 위 하이라이트 방지
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
                      const next = { ...prev, [folder.id]: !isOpen };
                      // ✅ 최근 트리상태 저장
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
                selectedId={selectedId}
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

/* ─────────────── FileList ─────────────── */
function FileList({
  images,
  currentFolderId,
  onSelect,
  onContextMenuImage,
  selectedItems,
  searchQuery,
}: {
  images: Array<{ id: number; name: string; url: string; folder_id: number }>;
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
              src={img.url}
              alt={img.name}
              className="image-explorer-thumbimg"
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

/* ─────────────── Page ─────────────── */
export default function ImageManagePage() {
  const [user, setUser] = useState<any>(null);
  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => setUser(d?.user ?? null));
  }, []);

  const [folders, setFolders] = useState<
    Array<{ id: number; name: string; parent_id: number | null }>
  >([]);
  const [images, setImages] = useState<
    Array<{ id: number; name: string; url: string; folder_id: number }>
  >([]);
  const [selectedFolder, setSelectedFolder] = useState<number | null>(null);

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

  // --- 공통 재조회: 폴더/이미지 ---
  const normalizeFolders = (data: any[]) =>
    data.map((f) => ({
      id: Number(f.id),
      name: String(f.name),
      parent_id: f.parent_id === null || f.parent_id === undefined ? null : Number(f.parent_id),
    }));

  const normalizeImages = (data: any[]) =>
    data.map((i) => ({
      id: Number(i.id),
      name: String(i.name),
      url: String(i.url),
      folder_id: Number(i.folder_id),
    }));

  const reloadFolders = useCallback(async () => {
    const q = `?ts=${Date.now()}`;
    const res = await fetch('/api/image/folder/list' + q, { cache: 'no-store' });
    const raw = await res.json();
    const data = normalizeFolders(raw);
    setFolders(data);

    // ✅ 트리 상태 복원(최초만) 또는 로컬 저장된 상태 사용
    if (typeof window !== 'undefined') {
      const savedTree = localStorage.getItem('imgmgr.treeState');
      if (savedTree) {
        try {
          const parsed: Record<string, boolean> = JSON.parse(savedTree);
          const cast: Record<number, boolean> = {};
          Object.keys(parsed).forEach((k) => (cast[Number(k)] = !!parsed[k]));
          setTreeState((prev) => (Object.keys(prev).length ? prev : cast));
        } catch {
          // 루트 자동 펼침
          const init: Record<number, boolean> = {};
          data.forEach((f: any) => {
            if (f.parent_id == null) init[f.id] = true;
          });
          setTreeState(init);
        }
      } else {
        const init: Record<number, boolean> = {};
        data.forEach((f: any) => {
          if (f.parent_id == null) init[f.id] = true;
        });
        setTreeState(init);
      }

      // ✅ 최근 선택 폴더 복원
      const savedSel = localStorage.getItem('imgmgr.selectedFolder');
      if (savedSel !== null) {
        const v = Number(savedSel);
        setSelectedFolder(Number.isFinite(v) ? v : null);
      }
    }
  }, []);

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

  // 초기 폴더 로드
  useEffect(() => {
    reloadFolders();
  }, [reloadFolders]);

  // 폴더 변경 시 이미지 리프레시 + 최근 경로 저장
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

  // 폴더 생성
  const createFolderRequest = async (name: string, parentId: number | null) => {
    const res = await fetch('/api/image/folder/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, parent_id: parentId }),
    });
    if (!res.ok) throw new Error((await res.json())?.error || '폴더 생성 실패');
    await reloadFolders(); // 항상 재조회
  };

  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const handleCreateFolder = async () => {
    const name = newFolderName.trim();
    if (!name) return;
    try {
      await createFolderRequest(name, selectedFolder ?? null);
      setNewFolderName('');
      setNewFolderOpen(false);
      // 방금 만든 폴더가 보이도록 현재 부모는 열어둠
      if (selectedFolder) {
        setTreeState((prev) => {
          const next = { ...prev, [selectedFolder]: true };
          if (typeof window !== 'undefined') {
            localStorage.setItem('imgmgr.treeState', JSON.stringify(next));
          }
          return next;
        });
      }
    } catch (e: any) {
      alert(e.message || '폴더 생성 실패');
    }
  };

  // 폴더 이름변경
  const handleRename = async (id: number, newName: string) => {
    const res = await fetch('/api/image/folder/rename', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, name: newName }),
    });
    if (res.ok) {
      await reloadFolders();
    } else {
      alert((await res.json()).error || '이름 변경 실패');
    }
  };

  // 폴더 삭제
  const handleDeleteFolder = async () => {
    if (!selectedFolder) return;
    const res = await fetch('/api/image/folder/delete', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: selectedFolder }),
    });
    if (res.ok) {
      await reloadFolders();
      setSelectedFolder(null);
      setSelectedItems([]);
      setImages([]);
    } else {
      alert((await res.json()).error || '삭제 실패');
    }
    setShowDeleteModal(false);
    setDeletingType(null);
  };

  // 이미지 삭제 (선택 항목 기준)
  const handleDeleteImages = async (idsOverride?: number[]) => {
    const ids = idsOverride ?? selectedItems.map((i) => i.id);
    if (!ids.length) return;
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

  // 이미지 이름변경
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

  // 파일리스트 선택
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

  // 썸네일 컨텍스트 메뉴(우클릭)
  const handleThumbContextMenu = (item: any, e: React.MouseEvent) => {
    setSelectedItems([item]); // 우클릭 시 그 이미지를 단일 선택으로 맞춤
    setContextMenu({
      visible: true,
      x: (e as any).clientX,
      y: (e as any).clientY,
      target: { type: 'image', id: item.id },
    });
  };

  // 특정 폴더의 모든 자손 id 집합
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

  // 이동 실행
  const moveFolder = useCallback(
    async (dragId: number, newParentId: number | null) => {
      if (dragId === newParentId) return;
      // 클라 선제 검증(서버에서도 다시 검사)
      if (newParentId !== null) {
        const descendants = getDescendantIds(dragId);
        if (descendants.has(newParentId)) {
          alert('하위 폴더로는 이동할 수 없어요.');
          return;
        }
      }
      // 동일 부모에 동명이 있는지 체크
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

      // 새 부모를 열어 두고, 트리/선택 경로 저장
      setTreeState((prev) => {
        const next = { ...prev };
        if (newParentId !== null) next[newParentId] = true;
        if (typeof window !== 'undefined') {
          localStorage.setItem('imgmgr.treeState', JSON.stringify(next));
        }
        return next;
      });

      await reloadFolders();
      setDraggingFolderId(null);
      setDragOverFolderId(null);
    },
    [folders, getDescendantIds, reloadFolders]
  );

  // 단축키
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const active = document.activeElement as HTMLElement | null;
      if (active && ['INPUT', 'TEXTAREA'].includes(active.tagName)) return;

      if (e.key === 'Delete' || e.key === 'Del') {
        if (selectedItems.length) {
          setShowDeleteModal(true);
          setDeletingType('image');
          e.preventDefault();
        } else if (selectedFolder) {
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
        } else if (!selectedItems.length && selectedFolder) {
          setEditingTarget({ type: 'folder', id: selectedFolder }); // 폴더는 트리 인라인 rename
          e.preventDefault();
        }
      }
    };
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true });
  }, [selectedFolder, selectedItems, editingTarget]);

  // 컨텍스트 메뉴 닫기
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

  return (
    <div className="wiki-container">
      <WikiHeader user={user} />

      <div className="image-explorer-viewport">
        <div className="image-explorer-layout">
          {/* 좌측: 폴더 트리 */}
          <aside className="image-explorer-sidebar">
            <div
              className={'folder-btn' + (selectedFolder === null ? ' active bg-blue-100' : '')}
              onClick={() => {
                setSelectedFolder(null);
                setSelectedItems([]);
                if (typeof window !== 'undefined') {
                  localStorage.setItem('imgmgr.selectedFolder', '');
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
              // 루트로 드롭 → parent_id = null
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
              selectedId={selectedFolder}
              onSelect={(id) => {
                setSelectedFolder(id);
              }}
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

          {/* 우측: 헤더 + 파일리스트 */}
          <section className="image-explorer-content">
            <div className="image-explorer-header-bar">
              <h1 className="image-explorer-title">이미지 업로드/관리</h1>

              {/* 검색 */}
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

              {/* 세그먼트 버튼 */}
              <div className="image-explorer-header-btns">
                <div className="toolbar-seg">
                  <button
                    type="button"
                    className="seg-btn"
                    onClick={() => setNewFolderOpen(true)}
                    title="새 폴더"
                  >
                    <svg
                      className="ico"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    >
                      <path
                        d="M3.75 7.5h6l1.5 1.5h9a1.5 1.5 0 011.5 1.5v7.5A1.5 1.5 0 0120.75 21h-15A2.25 2.25 0 013.5 18.75V9A1.5 1.5 0 013.75 7.5Z"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path d="M12 12v4m-2-2h4" strokeLinecap="round" />
                    </svg>
                    <span className="seg-label">새 폴더</span>
                  </button>

                  <button
                    type="button"
                    className="seg-btn"
                    onClick={() => setUploadOpen(true)}
                    disabled={!selectedFolder}
                    title="업로드"
                  >
                    <svg
                      className="ico"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    >
                      <path
                        d="M6.75 19.5A4.5 4.5 0 015.34 10.725 5.25 5.25 0 0115.573 8.395 3 3 0 0118 14.25h-.75"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M12 15.75V9.75m0 0l3 3m-3-3l-3 3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
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
                      } else if (selectedFolder) {
                        setShowDeleteModal(true);
                        setDeletingType('folder');
                      }
                    }}
                    disabled={!selectedFolder && !selectedItems.length}
                    title="삭제"
                  >
                    <svg
                      className="ico"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    >
                      <path
                        d="M9.75 9.75v6.75M14.25 9.75v6.75M4.5 7.5h15M9 4.5h6m-8.25 3L7.5 19.5a2.25 2.25 0 002.25 2.25h4.5A2.25 2.25 0 0016.5 19.5L18.75 7.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
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
                      } else if (!selectedItems.length && selectedFolder) {
                        setEditingTarget({ type: 'folder', id: selectedFolder }); // 트리 인라인 rename
                        setContextMenu((v) => ({ ...v, visible: false }));
                      }
                    }}
                    disabled={!(canRenameImage || (!selectedItems.length && selectedFolder))}
                    title="이름변경"
                  >
                    <svg
                      className="ico"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    >
                      <path
                        d="M16.5 3.75l3.75 3.75M4.5 19.5l3.75-.938L19.5 7.875l-3.75-3.75L4.5 15.75V19.5Z"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <span className="seg-label">이름변경</span>
                  </button>
                </div>
              </div>
            </div>

            <div
              className="image-explorer-filelist-outer"
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

      {/* 컨텍스트 메뉴 (폴더/이미지 공용) */}
      {contextMenu.visible && (
        <div
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
                  setEditingTarget({ type: 'folder', id: contextMenu.target!.id });
                  setContextMenu((v) => ({ ...v, visible: false }));
                }}
              >
                ✏️ 이름 변경
              </button>
              <button
                className="w-full px-4 py-2 text-left hover:bg-gray-100 text-red-500"
                onClick={() => {
                  setSelectedFolder(contextMenu.target!.id);
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
                    await navigator.clipboard.writeText(target.url);
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
                  setSelectedItems([{ id: contextMenu.target!.id, type: 'image' }]);
                  setContextMenu((v) => ({ ...v, visible: false }));
                }}
              >
                🗑 삭제
              </button>
            </>
          )}
        </div>
      )}

      {/* 새 폴더 */}
      <ModalCard
        open={newFolderOpen}
        onClose={() => setNewFolderOpen(false)}
        title="새 폴더"
        actions={
          <>
            <button className="rd-btn secondary" onClick={() => setNewFolderOpen(false)}>
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
            if (e.key === 'Escape') setNewFolderOpen(false);
          }}
          placeholder="예) 스크린샷"
        />
      </ModalCard>

      {/* 이미지 이름변경 (이미지에만 사용) */}
      <ModalCard
        open={!!editingTarget && editingTarget.type === 'image'}
        onClose={() => setEditingTarget(null)}
        title="이름 변경"
        actions={
          <>
            <button className="rd-btn secondary" onClick={() => setEditingTarget(null)}>
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
            if (e.key === 'Escape') setEditingTarget(null);
          }}
        />
      </ModalCard>

      {/* 삭제 (이미지/폴더 공용) */}
      <ModalCard
        open={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setDeletingType(null);
        }}
        title={deletingType === 'folder' ? '폴더 삭제' : '이미지 삭제'}
        actions={
          <>
            <button
              className="rd-btn secondary"
              onClick={() => {
                setShowDeleteModal(false);
                setDeletingType(null);
              }}
            >
              취소
            </button>
            <button
              className="rd-btn danger"
              onClick={() =>
                deletingType === 'folder' ? handleDeleteFolder() : handleDeleteImages()
              }
            >
              삭제
            </button>
          </>
        }
      >
        <p className="rd-card-description">
          {deletingType === 'folder' ? (
            <>
              <b>{folders.find((f) => f.id === selectedFolder)?.name}</b> 폴더와 모든 하위 항목이
              삭제됩니다. 계속하시겠습니까?
            </>
          ) : selectedItems.length > 1 ? (
            <>
              <b>{selectedItems.length}개</b> 이미지를 삭제하시겠습니까?
            </>
          ) : (
            <>
              정말 <b>{selectedItems[0]?.name ?? '선택 이미지'}</b> 이미지를
              삭제하시겠습니까?
            </>
          )}
        </p>
      </ModalCard>

      {/* 업로드 모달 */}
      <ImageUploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        folderId={selectedFolder}
        onUploaded={handleImagesUploaded}
      />
    </div>
  );
}
