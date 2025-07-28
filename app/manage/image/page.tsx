// =============================================
// File: app/manage/image/page.tsx
// =============================================
/**
 * 이미지 관리(폴더/파일 탐색기) 메인 페이지
 * - 폴더 트리 탐색, 이미지 업로드/미리보기/삭제/이름변경 지원
 * - 폴더 트리, 컨텍스트 메뉴, 다중선택, 키보드 단축키(F2/Del) 지원
 * - 좌측: 폴더/트리, 우측: 이미지 썸네일 리스트
 */
'use client';

import { useEffect, useState } from 'react';
import WikiHeader from "@/components/common/Header";
import CreateFolder from "@/components/image/CreateFolder";
import ImageUploadModal from "@/components/image/ImageUploadModal";
import Modal from "@/components/common/Modal";
import '@/wiki/css/image.css';

// === 트리 펼침/접힘 아이콘 ===
const ArrowIcon = ({ open }: { open: boolean }) => (
  <span style={{
    display: 'inline-block',
    transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
    transition: 'transform 0.15s',
    fontSize: 16,
    marginRight: 2,
    color: '#bbb'
  }}>▶</span>
);

// === 폴더 트리(재귀, 폴더 이름/편집/컨텍스트/트리 상태 관리) ===
function FolderTree({
  folders, parentId, selectedId, onSelect,
  editingId, setEditingId, onRename,
  depth = 0, treeState, setTreeState, setContextMenu,
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
      const target = folders.find(f => f.id === editingId);
      if (target) setEditName(target.name);
    }
  }, [editingId, folders]);

  const list = folders.filter(f => (parentId === null ? f.parent_id == null : Number(f.parent_id) === Number(parentId)));
  if (list.length === 0) return null;

  return (
    <ul className="folder-list" style={{ paddingLeft: depth === 0 ? 0 : 16 }}>
      {list.map(folder => {
        const hasChildren = folders.some(f => f.parent_id === folder.id);
        const isOpen = treeState[folder.id] ?? true;
        return (
          <li key={folder.id} className="folder-item" style={{ position: "relative" }}>
            <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
              {/* ┃ 트리 세로선 */}
              {depth > 0 &&
                <span
                  className="folder-tree-vertline"
                  style={{
                    borderLeft: '2px solid #bbb',
                    height: '32px',
                    position: 'absolute',
                    left: -(14 + (depth - 1) * 16),
                    top: '-3px',
                    zIndex: 0,
                  }}
                />
              }
              {/* 트리 펼침/접힘 */}
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
              {/* 폴더 이름/편집 */}
              {editingId === folder.id ? (
                <input
                  type="text"
                  className="folder-edit-input"
                  autoFocus
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  onBlur={() => {
                    if (editName.trim() && editName !== folder.name) onRename(folder.id, editName.trim());
                    setEditingId(null);
                  }}
                  onKeyDown={e => {
                    if (e.key === "Enter") {
                      if (editName.trim() && editName !== folder.name) onRename(folder.id, editName.trim());
                      setEditingId(null);
                    } else if (e.key === "Escape") setEditingId(null);
                  }}
                  style={{ width: 120, marginLeft: 2 }}
                />
              ) : (
                <button
                  className={"folder-btn" + (selectedId === folder.id ? " active" : "")}
                  style={{
                    marginLeft: hasChildren ? 0 : 18,
                    zIndex: 2,
                    minHeight: 28,
                  }}
                  onClick={e => { e.stopPropagation(); onSelect(folder.id); }}
                  onContextMenu={e => {
                    e.preventDefault();
                    e.stopPropagation();
                    onSelect(folder.id);
                    setContextMenu({
                      visible: true,
                      x: e.clientX,
                      y: e.clientY,
                      folderId: folder.id,
                    });
                  }}
                >
                  <span role="img" aria-label="folder">📁</span>
                  {folder.name}
                </button>
              )}
            </div>
            {/* 하위 폴더 */}
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

// === 현재 폴더 이미지 썸네일 리스트 ===
function FileList({
  images, currentFolderId, onSelect, selectedItems,
}: {
  images: any[], currentFolderId: number | null,
  onSelect: (item: any, e: React.MouseEvent) => void,
  selectedItems: any[]
}) {
  const imgs = images.filter(img => Number(img.folder_id) === Number(currentFolderId));
  function isSelected(img: any) { return selectedItems.some(sel => sel.id === img.id); }
  return (
    <div className="image-explorer-filelist">
      {imgs.map(img =>
        <div
          key={'img-' + img.id}
          className={"image-explorer-thumbnail" + (isSelected(img) ? " selected" : "")}
          onClick={e => { e.stopPropagation(); onSelect({ ...img, type: 'image' }, e); }}
        >
          <div style={{
            width: 120, height: 120, overflow: 'hidden', margin: '0 auto',
            background: '#f7f8fa', borderRadius: 16, border: '1.5px solid #e5e5e5',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <img
              src={img.url}
              alt={img.name}
              style={{
                width: '100%', height: '100%', objectFit: 'contain',
                borderRadius: 12, background: '#eee', display: 'block',
              }}
              onError={e => { e.currentTarget.src = '/default-thumbnail.png'; }}
            />
          </div>
          <span className="thumbnail-label">
            {(() => {
              const extIdx = img.name.lastIndexOf('.');
              const baseName = extIdx !== -1 ? img.name.slice(0, extIdx) : img.name;
              return baseName.length > 6 ? baseName.slice(0, 6) + '...' : baseName;
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

// === 이미지 관리 메인 페이지 ===
export default function ImageManagePage() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => res.ok ? res.json() : null)
      .then(data => setUser(data?.user ?? null));
  }, []);

  // === 폴더/이미지/선택 상태 ===
  const [folders, setFolders] = useState<any[]>([]);
  const [images, setImages] = useState<any[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<number | null>(null);
  const [selectedItems, setSelectedItems] = useState<any[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingType, setEditingType] = useState<'folder' | 'image' | null>(null);
  const [imageEditName, setImageEditName] = useState('');
  const [treeState, setTreeState] = useState<Record<number, boolean>>({});
  const [uploadOpen, setUploadOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ visible: boolean, x: number, y: number, folderId: number | null }>({ visible: false, x: 0, y: 0, folderId: null });
  const [deletingType, setDeletingType] = useState<'folder' | 'image' | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [createFolderAt, setCreateFolderAt] = useState<number | null>(null);
  const [createFolderKey, setCreateFolderKey] = useState<number>(0);

  // === 폴더/이미지 fetch ===
  useEffect(() => {
    fetch('/api/image/folder/list')
      .then(res => res.json())
      .then(data => setFolders(data));
  }, []);
  useEffect(() => {
    if (!selectedFolder) {
      setImages([]); setSelectedItems([]); return;
    }
    fetch(`/api/image/view?folder_id=${selectedFolder}`, { cache: 'no-store' })
      .then(res => res.json())
      .then(data => setImages(data));
  }, [selectedFolder]);

  // === 이미지 업로드 완료시 새로고침 ===
  const handleImagesUploaded = () => {
    if (!selectedFolder) return;
    fetch(`/api/image/view?folder_id=${selectedFolder}`, { cache: 'no-store' })
      .then(res => res.json())
      .then(data => setImages(data));
  }

  // === 폴더/이미지 생성/이름변경/삭제 핸들러 ===
  const handleFolderCreated = (folder: any) => {
    setFolders(prev => [...prev, folder]);
    setCreateFolderAt(null);
  };

  // 폴더 이름변경
  const handleRename = async (id: number, newName: string) => {
    const res = await fetch('/api/image/folder/rename', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, name: newName }),
    });
    if (res.ok) setFolders(prev => prev.map(f => f.id === id ? { ...f, name: newName } : f));
    else alert((await res.json()).error || '이름 변경 실패');
  };

  // 폴더 삭제
  const handleDelete = async () => {
    if (!selectedFolder) return;
    const res = await fetch('/api/image/folder/delete', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: selectedFolder }),
    });
    if (res.ok) {
      setFolders(prev => prev.filter(f => f.id !== selectedFolder));
      setSelectedFolder(null); setSelectedItems([]); setShowDeleteModal(false); setDeletingType(null);
    } else alert((await res.json()).error || '삭제 실패');
  };

  // 다중 이미지 삭제
  const handleImageDelete = async () => {
    if (selectedItems.length === 0) return;
    const res = await fetch('/api/image/delete', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: selectedItems.map(i => i.id) }),
    });
    if (res.ok) {
      fetch(`/api/image/view?folder_id=${selectedFolder}`, { cache: 'no-store' })
        .then(res => res.json())
        .then(data => setImages(data));
      setSelectedItems([]); setShowDeleteModal(false); setDeletingType(null);
    } else alert('삭제 실패');
  };

  // 이름변경 단축키/버튼
  const handleRenameClick = () => {
    if (selectedItems.length === 1 && selectedItems[0].type === 'image') {
      setEditingId(selectedItems[0].id); setEditingType('image'); setImageEditName(selectedItems[0].name);
    } else if (selectedItems.length === 0 && selectedFolder) {
      setEditingId(selectedFolder); setEditingType('folder'); setContextMenu(v => ({ ...v, visible: false }));
    }
  };

  // 삭제 단축키/버튼
  const handleDeleteClick = () => {
    if (selectedItems.length > 0) {
      setShowDeleteModal(true); setDeletingType('image');
    } else if (selectedFolder) {
      setShowDeleteModal(true); setDeletingType('folder');
    }
  };

  // 이미지 이름변경 저장
  const handleImageRename = async () => {
    if (editingId == null) return;
    const res = await fetch('/api/image/rename', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: editingId, name: imageEditName.trim() }),
    });
    if (res.ok) {
      fetch(`/api/image/view?folder_id=${selectedFolder}`, { cache: 'no-store' })
        .then(res => res.json())
        .then(data => setImages(data));
      setEditingId(null); setEditingType(null);
    } else alert('이름 변경 실패');
  };

  // 다중 선택/파일리스트 선택
  const handleFileListSelect = (item: any, e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey) {
      setSelectedItems(prev => {
        const exists = prev.find(i => i.id === item.id);
        return exists ? prev.filter(i => i.id !== item.id) : [...prev, item];
      });
    } else setSelectedItems([item]);
    setEditingId(null); setEditingType(null);
  };

  // === 키보드 단축키(F2/Del) ===
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement && ['INPUT', 'TEXTAREA'].includes((document.activeElement as HTMLElement).tagName)) return;
      if ((e.key === "Delete" || e.key === "Del")) {
        if (selectedItems.length > 0) { setShowDeleteModal(true); setDeletingType('image'); e.preventDefault(); }
        else if (selectedFolder) { setShowDeleteModal(true); setDeletingType('folder'); e.preventDefault(); }
      }
      if (e.key === "F2") {
        if (selectedItems.length === 1 && selectedItems[0].type === 'image') {
          setEditingId(selectedItems[0].id); setEditingType('image'); setImageEditName(selectedItems[0].name); e.preventDefault();
        }
        else if (selectedFolder) {
          setEditingId(selectedFolder); setEditingType('folder'); setContextMenu(v => ({ ...v, visible: false })); e.preventDefault();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [selectedFolder, selectedItems, editingId]);

  // === 컨텍스트 메뉴 외부 클릭/닫기 ===
  useEffect(() => {
    if (!contextMenu.visible) return;
    const close = () => setContextMenu(v => ({ ...v, visible: false }));
    const closeEsc = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("mousedown", close);
    window.addEventListener("scroll", close, true);
    window.addEventListener("contextmenu", close);
    window.addEventListener("keydown", closeEsc);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("contextmenu", close);
      window.removeEventListener("keydown", closeEsc);
    };
  }, [contextMenu.visible]);

  // === 렌더링 ===
  return (
    <div className="wiki-container">
      <WikiHeader user={user} />
      <div style={{ marginTop: 64 }}>
        <div className="image-explorer-layout">
          {/* --- 좌측: 폴더 탐색기 --- */}
          <div className="image-explorer-sidebar">
            <div
              className={"folder-btn" + (selectedFolder === null ? " active bg-blue-100" : "")}
              onClick={e => { e.stopPropagation(); setSelectedFolder(null); setSelectedItems([]); }}
              style={{ cursor: "pointer" }}
            >
              <span>📂</span> 루트(최상위)
            </div>
            <FolderTree
              folders={folders}
              parentId={null}
              selectedId={selectedFolder}
              onSelect={id => { setSelectedFolder(id); setSelectedItems([]); }}
              editingId={editingId}
                            setEditingId={setEditingId}
              onRename={handleRename}
              treeState={treeState}
              setTreeState={setTreeState}
              setContextMenu={setContextMenu}
            />
            <div style={{ margin: '14px 0 0 6px' }}>
              <button className="folder-btn small" style={{ width: 108 }} onClick={() => { setCreateFolderAt(selectedFolder); setCreateFolderKey(k => k + 1); }}>
                + 새 폴더 생성
              </button>
            </div>
          </div>

          {/* --- 가운데: 이미지 리스트 --- */}
          <div className="image-explorer-filepanel">
            <div className="image-explorer-filepanel-header">
              <span>
                {selectedFolder
                  ? `폴더: ${(folders.find(f => f.id === selectedFolder) || {}).name || "알 수 없음"}`
                  : "루트 이미지"}
              </span>
              <button className="upload-btn" onClick={() => setUploadOpen(true)}>+ 이미지 업로드</button>
              <button className="rename-btn" onClick={handleRenameClick} disabled={!selectedItems.length && !selectedFolder}>이름 변경(F2)</button>
              <button className="delete-btn" onClick={handleDeleteClick} disabled={!selectedItems.length && !selectedFolder}>삭제(Del)</button>
            </div>
            {/* 이미지 썸네일 목록 */}
            <FileList
              images={images}
              currentFolderId={selectedFolder}
              onSelect={handleFileListSelect}
              selectedItems={selectedItems}
            />
          </div>
        </div>
      </div>

      {/* === 폴더 생성 === */}
      {createFolderAt !== null && (
        <CreateFolder
          parentId={createFolderAt}
          key={createFolderKey}
          onClose={() => setCreateFolderAt(null)}
          onCreated={handleFolderCreated}
        />
      )}

      {/* === 이미지 업로드 === */}
      <ImageUploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        folderId={selectedFolder}
        onUploaded={handleImagesUploaded}
      />

      {/* === 이름 변경 모달 === */}
      {editingType === 'image' && (
        <Modal open={!!editingId} onClose={() => { setEditingId(null); setEditingType(null); }}>
          <div style={{ padding: 20, minWidth: 280 }}>
            <h3>이미지 이름 변경</h3>
            <input
              className="image-edit-input"
              value={imageEditName}
              onChange={e => setImageEditName(e.target.value)}
              autoFocus
              onKeyDown={e => {
                if (e.key === 'Enter') handleImageRename();
                else if (e.key === 'Escape') { setEditingId(null); setEditingType(null); }
              }}
            />
            <div style={{ marginTop: 16, textAlign: "right" }}>
              <button className="image-edit-cancel-btn" onClick={() => { setEditingId(null); setEditingType(null); }}>취소</button>
              <button className="image-edit-save-btn" onClick={handleImageRename} disabled={!imageEditName.trim()}>저장</button>
            </div>
          </div>
        </Modal>
      )}
      {editingType === 'folder' && (
        <Modal open={!!editingId} onClose={() => { setEditingId(null); setEditingType(null); }}>
          <div style={{ padding: 20, minWidth: 280 }}>
            <h3>폴더 이름 변경</h3>
            <input
              className="image-edit-input"
              value={folders.find(f => f.id === editingId)?.name || ''}
              onChange={e => {
                if (editingId !== null) {
                  handleRename(editingId, e.target.value)
                }
              }}
              autoFocus
              onBlur={() => setEditingId(null)}
              onKeyDown={e => {
                if (e.key === 'Enter') setEditingId(null);
                else if (e.key === 'Escape') setEditingId(null);
              }}
            />
            <div style={{ marginTop: 16, textAlign: "right" }}>
              <button className="image-edit-cancel-btn" onClick={() => setEditingId(null)}>닫기</button>
            </div>
          </div>
        </Modal>
      )}

      {/* === 삭제 확인 모달 === */}
      <Modal open={showDeleteModal} onClose={() => setShowDeleteModal(false)}>
        <div style={{ padding: 28, minWidth: 280 }}>
          <h3 style={{ color: "#e43" }}>정말 삭제할까요?</h3>
          <div style={{ margin: "20px 0", fontSize: 15 }}>
            {deletingType === 'image'
              ? `선택한 이미지 ${selectedItems.length}개를 삭제합니다.`
              : deletingType === 'folder'
                ? `이 폴더와 하위 이미지/폴더를 모두 삭제합니다.`
                : ''}
          </div>
          <div style={{ textAlign: "right" }}>
            <button className="image-edit-cancel-btn" onClick={() => setShowDeleteModal(false)}>취소</button>
            <button
              className="image-edit-save-btn"
              style={{ background: "#e43", marginLeft: 8 }}
              onClick={() => {
                if (deletingType === 'image') handleImageDelete();
                else if (deletingType === 'folder') handleDelete();
              }}
            >삭제</button>
          </div>
        </div>
      </Modal>

      {/* === 폴더 컨텍스트 메뉴 === */}
      {contextMenu.visible && (
        <div
          className="folder-context-menu"
          style={{ position: 'fixed', left: contextMenu.x, top: contextMenu.y, zIndex: 10001 }}
        >
          <button onClick={() => { setEditingId(contextMenu.folderId); setEditingType('folder'); setContextMenu(v => ({ ...v, visible: false })); }}>이름 변경</button>
          <button onClick={() => { setShowDeleteModal(true); setDeletingType('folder'); setContextMenu(v => ({ ...v, visible: false })); }}>삭제</button>
          <button onClick={() => { setCreateFolderAt(contextMenu.folderId); setCreateFolderKey(k => k + 1); setContextMenu(v => ({ ...v, visible: false })); }}>하위 폴더 생성</button>
        </div>
      )}
    </div>
  );
}