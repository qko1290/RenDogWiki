'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import WikiHeader from "@/components/common/Header";
import ImageUploadModal from "@/components/image/ImageUploadModal";
import '@/wiki/css/image.css';

/* ────────────────────────────────────────────
 * 아주 얇은 오버레이 모달
 * ────────────────────────────────────────────*/
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
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {children}
    </div>
  );
}

/* ────────────────────────────────────────────
 * 카드 모달 공용 스켈레톤 (제목/닫기/액션 버튼 영역 포함)
 * ────────────────────────────────────────────*/
function ModalCard({
  open,
  onClose,
  title,
  children,
  actions,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <BareModal open={open} onClose={onClose}>
      <div className="rd-card" role="dialog" aria-labelledby="rdm-title">
        <button className="rd-exit-btn" onClick={onClose} aria-label="닫기">
          <svg height="20" viewBox="0 0 384 512">
            <path d="M342.6 150.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L192 210.7 86.6 105.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L146.7 256 41.4 361.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L192 301.3 297.4 406.6c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L237.3 256 342.6 150.6z"/>
          </svg>
        </button>
        <div className="rd-card-content">
          <p className="rd-card-heading" id="rdm-title">{title}</p>
          {children}
        </div>
        {actions && <div className="rd-card-button-wrapper">{actions}</div>}
      </div>
    </BareModal>
  );
}

/* ────────────────────────────────────────────
 * 유틸: 펼침/접힘 아이콘(폴더 오른쪽)
 * ────────────────────────────────────────────*/
const ArrowIcon = ({ open }: { open: boolean }) => (
  <span style={{
    display: 'inline-block',
    transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
    transition: 'transform 0.15s',
    fontSize: 16,
    marginLeft: 6,
    color: '#bbb'
  }}>▶</span>
);

/* ────────────────────────────────────────────
 * 폴더 트리 (재귀)
 * ────────────────────────────────────────────*/
function FolderTree({
  folders,
  parentId,
  selectedId,
  onSelect,
  editingId,
  setEditingId,
  onRename,
  depth = 0,
  treeState,
  setTreeState,
  setContextMenu,
}: {
  folders: any[];
  parentId: number | null;
  selectedId: number | null;
  onSelect: (id: number | null) => void;
  editingId: number | null;
  setEditingId: (id: number | null) => void;
  onRename: (id: number, newName: string) => void;
  depth?: number;
  treeState: Record<number, boolean>;
  setTreeState: (v: (prev: Record<number, boolean>) => Record<number, boolean>) => void;
  setContextMenu: React.Dispatch<React.SetStateAction<{
    visible: boolean,
    x: number,
    y: number,
    folderId: number | null
  }>>;
}) {
  const [editName, setEditName] = useState("");

  useEffect(() => {
    if (editingId) {
      const t = folders.find(f => f.id === editingId);
      if (t) setEditName(t.name);
    }
  }, [editingId, folders]);

  const list = folders.filter(f =>
    parentId === null ? f.parent_id == null : Number(f.parent_id) === Number(parentId)
  );
  if (!list.length) return null;

  return (
    <ul className="folder-list" style={{ paddingLeft: depth === 0 ? 0 : 16 }}>
      {list.map(folder => {
        const hasChildren = folders.some(f => f.parent_id === folder.id);
        const isOpen = treeState[folder.id] ?? false;

        return (
          <li key={folder.id} className="folder-item" style={{ position: "relative" }}>
            <div className="folder-row">
              {editingId === folder.id ? (
                <input
                  type="text"
                  className="folder-edit-input"
                  autoFocus
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  onBlur={() => {
                    const v = editName.trim();
                    if (v && v !== folder.name) onRename(folder.id, v);
                    setEditingId(null);
                  }}
                  onKeyDown={e => {
                    if (e.key === "Enter") {
                      const v = editName.trim();
                      if (v && v !== folder.name) onRename(folder.id, v);
                      setEditingId(null);
                    } else if (e.key === "Escape") {
                      setEditingId(null);
                    }
                  }}
                  style={{ width: 120 }}
                />
              ) : (
                <button
                  className={"folder-btn" + (selectedId === folder.id ? " active" : "")}
                  style={{ zIndex: 2, minHeight: 28 }}
                  onClick={e => { e.stopPropagation(); onSelect(folder.id); }}
                  onContextMenu={e => {
                    e.preventDefault();
                    e.stopPropagation();
                    onSelect(folder.id);
                    setContextMenu({ visible: true, x: e.clientX, y: e.clientY, folderId: folder.id });
                  }}
                >
                  <span role="img" aria-label="folder">📁</span>
                  {folder.name}
                </button>
              )}

              {hasChildren && (
                <button
                  onClick={e => {
                    e.stopPropagation();
                    setTreeState(prev => ({ ...prev, [folder.id]: !isOpen }));
                  }}
                  aria-label={isOpen ? "접기" : "펼치기"}
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
                editingId={editingId}
                setEditingId={setEditingId}
                onRename={onRename}
                depth={depth + 1}
                treeState={treeState}
                setTreeState={setTreeState}
                setContextMenu={setContextMenu}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}

/* ────────────────────────────────────────────
 * 파일 썸네일 리스트
 * ────────────────────────────────────────────*/
function FileList({
  images,
  currentFolderId,
  onSelect,
  selectedItems,
  searchQuery,
}: {
  images: any[];
  currentFolderId: number | null;
  onSelect: (item: any, e: React.MouseEvent) => void;
  selectedItems: any[];
  searchQuery: string;
}) {
  const q = searchQuery.trim().toLowerCase();
  const imgs = useMemo(
    () =>
      images
        .filter(img => Number(img.folder_id) === Number(currentFolderId))
        .filter(img => !q || img.name.toLowerCase().includes(q)),
    [images, currentFolderId, q]
  );

  const isSelected = (img: any) => selectedItems.some(sel => sel.id === img.id);

  return (
    <div className="image-explorer-filelist">
      {imgs.map(img =>
        <div
          key={'img-' + img.id}
          className={"image-explorer-thumbnail" + (isSelected(img) ? " selected" : "")}
          onClick={e => { e.stopPropagation(); onSelect({ ...img, type: 'image' }, e); }}
          tabIndex={0}
        >
          <div className="image-explorer-thumbbox">
            <img
              src={img.url}
              alt={img.name}
              className="image-explorer-thumbimg"
              onError={e => { (e.currentTarget as HTMLImageElement).src = '/default-thumbnail.png'; }}
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
      )}
      {imgs.length === 0 &&
        <div className="text-gray-400 mt-8">이 폴더에는 이미지가 없습니다.</div>
      }
    </div>
  );
}

/* ────────────────────────────────────────────
 * 메인
 * ────────────────────────────────────────────*/
export default function ImageManagePage() {
  const [user, setUser] = useState<any>(null);
  useEffect(() => {
    fetch('/api/auth/me').then(res => res.ok ? res.json() : null).then(d => setUser(d?.user ?? null));
  }, []);

  const [folders, setFolders] = useState<any[]>([]);
  const [images, setImages] = useState<any[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<number | null>(null);

  const [selectedItems, setSelectedItems] = useState<any[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [imageEditName, setImageEditName] = useState('');
  const [treeState, setTreeState] = useState<Record<number, boolean>>({});
  const [uploadOpen, setUploadOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ visible: boolean, x: number, y: number, folderId: number | null }>({ visible: false, x: 0, y: 0, folderId: null });
  const [deletingType, setDeletingType] = useState<'folder' | 'image' | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // 새 폴더 모달
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  // 공통: 현재 폴더 이미지 새로고침
  const refreshImages = useCallback(() => {
    if (!selectedFolder) { setImages([]); return; }
    fetch(`/api/image/view?folder_id=${selectedFolder}`, { cache: 'no-store' })
      .then(res => res.json())
      .then(setImages);
  }, [selectedFolder]);

  // 초기 폴더 로드 + 1단계 자동 펼침
  useEffect(() => {
    fetch('/api/image/folder/list')
      .then(res => res.json())
      .then(data => {
        setFolders(data);
        const init: Record<number, boolean> = {};
        data.forEach((f: any) => { if (f.parent_id == null) init[f.id] = true; });
        setTreeState(init);
      });
  }, []);

  useEffect(() => {
    setSelectedItems([]);
    refreshImages();
  }, [selectedFolder, refreshImages]);

  const handleImagesUploaded = () => refreshImages();

  const createFolderRequest = async (name: string, parentId: number | null) => {
    const res = await fetch('/api/image/folder/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, parent_id: parentId }),
    });
    if (!res.ok) throw new Error((await res.json())?.error || '폴더 생성 실패');
    return res.json();
  };

  const handleCreateFolder = async () => {
    const name = newFolderName.trim();
    if (!name) return;
    try {
      const folder = await createFolderRequest(name, selectedFolder ?? null);
      setFolders(prev => [...prev, folder]);
      setTreeState(prev => ({ ...prev, [folder.parent_id ?? folder.id]: true }));
      setNewFolderName('');
      setNewFolderOpen(false);
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
    if (res.ok) setFolders(prev => prev.map(f => f.id === id ? { ...f, name: newName } : f));
    else alert((await res.json()).error || '이름 변경 실패');
  };

  const handleDeleteFolder = async () => {
    if (!selectedFolder) return;
    const res = await fetch('/api/image/folder/delete', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: selectedFolder }),
    });
    if (res.ok) {
      setFolders(prev => prev.filter(f => f.id !== selectedFolder));
      setSelectedFolder(null);
      setSelectedItems([]);
    } else {
      alert((await res.json()).error || '삭제 실패');
    }
    setShowDeleteModal(false);
    setDeletingType(null);
  };

  const handleDeleteImages = async () => {
    if (!selectedItems.length) return;
    const res = await fetch('/api/image/delete', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: selectedItems.map(i => i.id) }),
    });
    if (res.ok) { refreshImages(); setSelectedItems([]); }
    else alert('삭제 실패');
    setShowDeleteModal(false);
    setDeletingType(null);
  };

  const handleImageRename = async () => {
    if (editingId == null) return;
    const res = await fetch('/api/image/rename', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: editingId, name: imageEditName.trim() }),
    });
    if (res.ok) { refreshImages(); setEditingId(null); }
    else alert('이름 변경 실패');
  };

  const handleFileListSelect = (item: any, e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey) {
      setSelectedItems(prev => {
        const exists = prev.some(i => i.id === item.id);
        return exists ? prev.filter(i => i.id !== item.id) : [...prev, item];
      });
    } else {
      setSelectedItems([item]);
    }
    setEditingId(null);
  };

  // 단축키
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const active = document.activeElement as HTMLElement | null;
      if (active && ['INPUT', 'TEXTAREA'].includes(active.tagName)) return;

      if (e.key === 'Delete' || e.key === 'Del') {
        if (selectedItems.length) { setShowDeleteModal(true); setDeletingType('image'); e.preventDefault(); }
        else if (selectedFolder) { setShowDeleteModal(true); setDeletingType('folder'); e.preventDefault(); }
      }
      if (e.key === 'F2') {
        if (selectedItems.length === 1 && selectedItems[0].type === 'image') {
          setEditingId(selectedItems[0].id);
          setImageEditName(selectedItems[0].name);
          e.preventDefault();
        } else if (!selectedItems.length && selectedFolder) {
          setEditingId(selectedFolder); // 폴더 이름변경은 트리의 inline input 사용
          e.preventDefault();
        }
      }
    };
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true });
  }, [selectedFolder, selectedItems]);

  // 컨텍스트 메뉴 닫기
  useEffect(() => {
    if (!contextMenu.visible) return;
    const close = () => setContextMenu(v => ({ ...v, visible: false }));
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener("mousedown", close);
    window.addEventListener("scroll", close, true);
    window.addEventListener("contextmenu", close);
    window.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("contextmenu", close);
      window.removeEventListener("keydown", esc);
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
              className={"folder-btn" + (selectedFolder === null ? " active bg-blue-100" : "")}
              onClick={() => { setSelectedFolder(null); setSelectedItems([]); }}
              style={{ cursor: "pointer" }}
            >
              <span>📂</span> RDWIKI
            </div>
            <FolderTree
              folders={folders}
              parentId={null}
              selectedId={selectedFolder}
              onSelect={id => { setSelectedFolder(id); }}
              editingId={editingId}
              setEditingId={setEditingId}
              onRename={handleRename}
              treeState={treeState}
              setTreeState={setTreeState}
              setContextMenu={setContextMenu}
            />
          </aside>

          {/* 우측: 헤더 + 파일리스트 */}
          <section className="image-explorer-content">
            <div className="image-explorer-header-bar">
              <h1 className="image-explorer-title">이미지 업로드/관리</h1>

              {/* 검색 */}
              <div className="toolbar-search">
                <div className="seg-input">
                  <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
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
                      <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                        <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round"/>
                      </svg>
                    </button>
                  )}
                </div>
              </div>

              {/* 세그먼트 버튼 */}
              <div className="image-explorer-header-btns">
                <div className="toolbar-seg">
                  <button type="button" className="seg-btn" onClick={() => setNewFolderOpen(true)} title="새 폴더">
                    <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M3.75 7.5h6l1.5 1.5h9a1.5 1.5 0 011.5 1.5v7.5A1.5 1.5 0 0120.75 21h-15A2.25 2.25 0 013.5 18.75V9A1.5 1.5 0 013.75 7.5Z" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M12 12v4m-2-2h4" strokeLinecap="round"/>
                    </svg>
                    <span className="seg-label">새 폴더</span>
                  </button>

                  <button type="button" className="seg-btn" onClick={() => setUploadOpen(true)} disabled={!selectedFolder} title="업로드">
                    <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M6.75 19.5A4.5 4.5 0 015.34 10.725 5.25 5.25 0 0115.573 8.395 3 3 0 0118 14.25h-.75" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M12 15.75V9.75m0 0l3 3m-3-3l-3 3" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span className="seg-label">업로드</span>
                  </button>

                  <button
                    type="button"
                    className="seg-btn danger"
                    onClick={() => {
                      if (selectedItems.length) { setShowDeleteModal(true); setDeletingType('image'); }
                      else if (selectedFolder) { setShowDeleteModal(true); setDeletingType('folder'); }
                    }}
                    disabled={!selectedFolder && !selectedItems.length}
                    title="삭제"
                  >
                    <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M9.75 9.75v6.75M14.25 9.75v6.75M4.5 7.5h15M9 4.5h6m-8.25 3L7.5 19.5a2.25 2.25 0 002.25 2.25h4.5A2.25 2.25 0 0016.5 19.5L18.75 7.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span className="seg-label">삭제</span>
                  </button>

                  <button
                    type="button"
                    className="seg-btn"
                    onClick={() => {
                      if (canRenameImage) {
                        setEditingId(selectedItems[0].id);
                        setImageEditName(selectedItems[0].name);
                      } else if (!selectedItems.length && selectedFolder) {
                        setEditingId(selectedFolder); // 트리에서 inline rename
                        setContextMenu(v => ({ ...v, visible: false }));
                      }
                    }}
                    disabled={!(canRenameImage || (!selectedItems.length && selectedFolder))}
                    title="이름변경"
                  >
                    <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M16.5 3.75l3.75 3.75M4.5 19.5l3.75-.938L19.5 7.875l-3.75-3.75L4.5 15.75V19.5Z" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span className="seg-label">이름변경</span>
                  </button>
                </div>
              </div>
            </div>

            <div
              className="image-explorer-filelist-outer"
              onDragEnter={(e) => { e.preventDefault(); e.currentTarget.classList.add('dragover'); }}
              onDragOver={(e) => e.preventDefault()}
              onDragLeave={(e) => { e.currentTarget.classList.remove('dragover'); }}
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
                selectedItems={selectedItems}
                searchQuery={searchQuery}
              />
            </div>
          </section>
        </div>
      </div>

      {/* 컨텍스트 메뉴 */}
      {contextMenu.visible && contextMenu.folderId && (
        <div
          style={{
            position: "fixed",
            top: contextMenu.y,
            left: contextMenu.x,
            background: "#fff",
            border: "1.5px solid #bbb",
            borderRadius: 8,
            boxShadow: "0 2px 14px 0 rgba(0,0,0,0.13)",
            zIndex: 3000,
            minWidth: 128,
            padding: "4px 0"
          }}
          onMouseDown={e => e.stopPropagation()}
          onClick={e => e.stopPropagation()}
        >
          <button
            className="w-full px-4 py-2 text-left hover:bg-gray-100"
            onClick={() => { setEditingId(contextMenu.folderId!); setContextMenu(v => ({ ...v, visible: false })); }}
          >✏️ 이름 변경</button>
          <button
            className="w-full px-4 py-2 text-left hover:bg-gray-100 text-red-500"
            onClick={() => { setSelectedFolder(contextMenu.folderId!); setShowDeleteModal(true); setDeletingType('folder'); setContextMenu(v => ({ ...v, visible: false })); }}
          >🗑 삭제</button>
        </div>
      )}

      {/* 새 폴더 */}
      <ModalCard
        open={newFolderOpen}
        onClose={() => setNewFolderOpen(false)}
        title="새 폴더"
        actions={
          <>
            <button className="rd-btn secondary" onClick={() => setNewFolderOpen(false)}>취소</button>
            <button className="rd-btn primary" onClick={handleCreateFolder} disabled={!newFolderName.trim()}>생성</button>
          </>
        }
      >
        <p className="rd-card-description">폴더 이름을 입력하세요.</p>
        <input
          className="rd-input"
          value={newFolderName}
          onChange={e => setNewFolderName(e.target.value)}
          autoFocus
          onKeyDown={e => {
            if (e.key === "Enter") handleCreateFolder();
            if (e.key === "Escape") setNewFolderOpen(false);
          }}
          placeholder="예) 스크린샷"
        />
      </ModalCard>

      {/* 이미지 이름변경 (이미지에만 사용) */}
      <ModalCard
        open={!!editingId && selectedItems.some(i => i.id === editingId)}
        onClose={() => setEditingId(null)}
        title="이름 변경"
        actions={
          <>
            <button className="rd-btn secondary" onClick={() => setEditingId(null)}>취소</button>
            <button className="rd-btn primary" onClick={handleImageRename}>저장</button>
          </>
        }
      >
        <p className="rd-card-description">새 파일명을 입력하세요.</p>
        <input
          className="rd-input"
          value={imageEditName}
          onChange={e => setImageEditName(e.target.value)}
          autoFocus
          onKeyDown={e => {
            if (e.key === "Enter") handleImageRename();
            if (e.key === "Escape") setEditingId(null);
          }}
        />
      </ModalCard>

      {/* 삭제 (이미지/폴더 공용) */}
      <ModalCard
        open={showDeleteModal}
        onClose={() => { setShowDeleteModal(false); setDeletingType(null); }}
        title={deletingType === 'folder' ? '폴더 삭제' : '이미지 삭제'}
        actions={
          <>
            <button className="rd-btn secondary" onClick={() => { setShowDeleteModal(false); setDeletingType(null); }}>취소</button>
            <button
              className="rd-btn danger"
              onClick={deletingType === 'folder' ? handleDeleteFolder : handleDeleteImages}
            >
              삭제
            </button>
          </>
        }
      >
        <p className="rd-card-description">
          {deletingType === 'folder'
            ? <> <b>{folders.find(f => f.id === selectedFolder)?.name}</b> 폴더와 모든 하위 항목이 삭제됩니다. 계속하시겠습니까?</>
            : (selectedItems.length > 1
                ? <><b>{selectedItems.length}개</b> 이미지를 삭제하시겠습니까?</>
                : <>정말 <b>{selectedItems[0]?.name}</b> 이미지를 삭제하시겠습니까?</>)
          }
        </p>
      </ModalCard>

      {/* 업로드 모달 (기존 컴포넌트) */}
      <ImageUploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        folderId={selectedFolder}
        onUploaded={handleImagesUploaded}
      />
    </div>
  );
}
