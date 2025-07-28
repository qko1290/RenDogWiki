// =============================================
// File: app/manage/image/page.tsx
// =============================================
/**
 * 이미지 관리(폴더/파일 탐색기) 메인 페이지
 * - 폴더 트리 탐색, 이미지 업로드/미리보기/삭제/이름변경
 * - 폴더 트리 , 컨텍스트 메뉴, 다중선택 지원
 * - 좌측: 폴더/트리, 우측: 이미지 썸네일 리스트
 */
'use client';

import { useEffect, useState } from 'react';
import WikiHeader from "@/components/common/Header";
import CreateFolder from "@/components/image/CreateFolder";
import ImageUploadModal from "@/components/image/ImageUploadModal";
import '@/wiki/css/image.css';
import Modal from "@/components/common/Modal";

// 트리 펼침/접힘용 아이콘
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

// FolderTree: 폴더 트리(재귀)
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
  // 폴더 이름 편집 상태
  const [editName, setEditName] = useState("");
  useEffect(() => {
    if (editingId) {
      const target = folders.find(f => f.id === editingId);
      if (target) setEditName(target.name);
    }
  }, [editingId, folders]);

  // 현재 parentId 하위 폴더 리스트
  const list = folders.filter(f => {
    if (parentId === null) return f.parent_id == null;
    return Number(f.parent_id) === Number(parentId);
  });

  if (list.length === 0) return null;

  return (
    <ul className="folder-list" style={{ paddingLeft: depth === 0 ? 0 : 16 }}>
      {list.map(folder => {
        const hasChildren = folders.some(f => f.parent_id === folder.id);
        const isOpen = treeState[folder.id] ?? true;
        return (
          <li key={folder.id} className="folder-item" style={{ position: "relative" }}>
            <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
              {/* ┃형 라인 */}
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
              {/* 펼침/접힘 버튼 */}
              {hasChildren && (
                <button
                  onClick={e => {
                    e.stopPropagation();
                    setTreeState(prev => ({
                      ...prev,
                      [folder.id]: !isOpen,
                    }));
                  }}
                  aria-label={isOpen ? "접기" : "펼치기"}
                  className="folder-tree-arrowbtn"
                  tabIndex={-1}
                >
                  <ArrowIcon open={isOpen} />
                </button>
              )}
              {/* 이름 변경 input or 버튼 */}
              {editingId === folder.id ? (
                <input
                  type="text"
                  className="folder-edit-input"
                  autoFocus
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  onBlur={() => {
                    if (editName.trim() && editName !== folder.name) {
                      onRename(folder.id, editName.trim());
                    }
                    setEditingId(null);
                  }}
                  onKeyDown={e => {
                    if (e.key === "Enter") {
                      if (editName.trim() && editName !== folder.name) {
                        onRename(folder.id, editName.trim());
                      }
                      setEditingId(null);
                    } else if (e.key === "Escape") {
                      setEditingId(null);
                    }
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
                  onClick={e => {
                    e.stopPropagation();
                    onSelect(folder.id);
                  }}
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
            {/* 하위 폴더 재귀 */}
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

// 현재 폴더 이미지 썸네일 리스트
function FileList({
  images, currentFolderId, onSelect, selectedItems,
}: {
  images: any[], currentFolderId: number | null,
  onSelect: (item: any, e: React.MouseEvent) => void,
  selectedItems: any[]
}) {
  const imgs = images.filter(img => Number(img.folder_id) === Number(currentFolderId));
  console.log("images:", images, "currentFolderId:", currentFolderId);

  function isSelected(img: any) {
    return selectedItems.some(sel => sel.id === img.id);
  }

  return (
    <div className="image-explorer-filelist">
      {imgs.map(img =>
        <div
          key={'img-' + img.id}
          className={
            "image-explorer-thumbnail" +
            (isSelected(img) ? " selected" : "")
          }
          onClick={e => {
            e.stopPropagation();
            onSelect({ ...img, type: 'image' }, e);
          }}
        >
          <div style={{
            width: 120,
            height: 120,
            overflow: 'hidden',
            margin: '0 auto',
            background: '#f7f8fa',
            borderRadius: 16,
            border: '1.5px solid #e5e5e5',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <img
              src={img.url}
              alt={img.name}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                borderRadius: 12,
                background: '#eee',
                display: 'block',
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

// 메인 페이지 컴포넌트 (ImageManagePage)
export default function ImageManagePage() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => res.ok ? res.json() : null)
      .then(data => setUser(data?.user ?? null));
  }, []);

  // 폴더/이미지/선택 상태
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

  // 폴더/이미지 데이터 fetch (API 연동)
  useEffect(() => {
    fetch('/api/image/folder/list')
      .then(res => res.json())
      .then(data => setFolders(data));
  }, []);
  useEffect(() => {
    if (!selectedFolder) {
      setImages([]);
      setSelectedItems([]);
      return;
    }
    fetch(`/api/image/view?folder_id=${selectedFolder}`, { cache: 'no-store' })
      .then(res => res.json())
      .then(data => setImages(data));
  }, [selectedFolder]);

  // 이미지 업로드 완료시 새로고침
  const handleImagesUploaded = () => {
  if (!selectedFolder) return;
    fetch(`/api/image/view?folder_id=${selectedFolder}`, { cache: 'no-store' })
      .then(res => res.json())
      .then(data => setImages(data));
  }

  // 폴더/이미지 생성/이름변경/삭제 핸들러
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
    if (res.ok) {
      setFolders(prev => prev.map(f => f.id === id ? { ...f, name: newName } : f));
    } else {
      const data = await res.json();
      alert(data.error || '이름 변경 실패');
    }
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
      setSelectedFolder(null);
      setSelectedItems([]);
      setShowDeleteModal(false);
      setDeletingType(null);
    } else {
      const data = await res.json();
      alert(data.error || '삭제 실패');
    }
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
      setSelectedItems([]);
      setShowDeleteModal(false);
      setDeletingType(null);
    } else {
      alert('삭제 실패');
    }
  };

  // 이름변경 버튼/단축키 처리
  const handleRenameClick = () => {
    if (selectedItems.length === 1 && selectedItems[0].type === 'image') {
      setEditingId(selectedItems[0].id);
      setEditingType('image');
      setImageEditName(selectedItems[0].name);
    } else if (selectedItems.length === 0 && selectedFolder) {
      setEditingId(selectedFolder);
      setEditingType('folder');
      setContextMenu(v => ({ ...v, visible: false }));
    }
  };

  // 삭제 버튼/단축키 처리
  const handleDeleteClick = () => {
    if (selectedItems.length > 0) {
      setShowDeleteModal(true);
      setDeletingType('image');
    } else if (selectedFolder) {
      setShowDeleteModal(true);
      setDeletingType('folder');
    }
  };

  // 이미지 이름변경 처리
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
      setEditingId(null);
      setEditingType(null);
    } else {
      alert('이름 변경 실패');
    }
  };

  // 다중 선택/키보드 단축키(Del, F2) 지원
  const handleFileListSelect = (item: any, e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey) {
      setSelectedItems(prev => {
        const exists = prev.find(i => i.id === item.id);
        if (exists) return prev.filter(i => i.id !== item.id);
        else return [...prev, item];
      });
    } else {
      setSelectedItems([item]);
    }
    setEditingId(null);
    setEditingType(null);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement && ['INPUT', 'TEXTAREA'].includes((document.activeElement as HTMLElement).tagName)) return;
      if ((e.key === "Delete" || e.key === "Del")) {
        if (selectedItems.length > 0) {
          setShowDeleteModal(true);
          setDeletingType('image');
          e.preventDefault();
        } else if (selectedFolder) {
          setShowDeleteModal(true);
          setDeletingType('folder');
          e.preventDefault();
        }
      }
      if (e.key === "F2") {
        if (selectedItems.length === 1 && selectedItems[0].type === 'image') {
          setEditingId(selectedItems[0].id);
          setEditingType('image');
          setImageEditName(selectedItems[0].name);
          e.preventDefault();
        }
        else if (selectedFolder) {
          setEditingId(selectedFolder);
          setEditingType('folder');
          setContextMenu(v => ({ ...v, visible: false }));
          e.preventDefault();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [selectedFolder, selectedItems, editingId]);

  // 컨텍스트 메뉴(우클릭) 외부클릭 자동닫기
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

  // 렌더링(좌:폴더, 우:이미지, 모달/컨텍스트 메뉴)
  return (
    <div className="wiki-container">
      <WikiHeader user={user} />
      <div style={{ marginTop: 64 }}>
        <div className="image-explorer-layout">
          {/* 좌측: 폴더 탐색기 */}
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
          </div>
          {/* 우측: 이미지 목록/툴바 */}
          <div className="image-explorer-content">
            <div className="image-explorer-header-bar">
              <h1 className="image-explorer-title">이미지 업로드/관리</h1>
              <div className="image-explorer-header-btns">
                {/* 폴더 생성 */}
                <CreateFolder
                  parentId={selectedFolder ?? null}
                  onCreated={handleFolderCreated}
                  onClose={() => setCreateFolderAt(null)}  // 또는 적절한 닫기 핸들러
                  className="image-explorer-btn"
                />

                {createFolderAt !== null && (
                  <CreateFolder
                    key={createFolderKey + '-' + createFolderAt}
                    parentId={createFolderAt}
                    onCreated={handleFolderCreated}
                    onClose={() => setCreateFolderAt(null)} // 마찬가지로 onClose 필수!
                    forceOpen={true}
                  />
                )}
                {/* 이미지 업로드 */}
                <button
                  type="button"
                  className="image-explorer-btn"
                  onClick={() => setUploadOpen(true)}
                  disabled={!selectedFolder}
                >
                  업로드
                </button>
                {/* 삭제 */}
                <button
                  className="image-explorer-btn danger"
                  onClick={handleDeleteClick}
                  disabled={!selectedFolder && selectedItems.length === 0}
                >
                  🗑 삭제
                </button>
                {/* 이름변경 */}
                <button
                  className="image-explorer-btn"
                  onClick={handleRenameClick}
                  disabled={
                    !((selectedItems.length === 1 && selectedItems[0].type === 'image') ||
                      (selectedItems.length === 0 && selectedFolder))
                  }
                >
                  ✏️ 이름변경
                </button>
              </div>
            </div>
            <div className="image-explorer-filelist-outer">
              <FileList
                images={images}
                currentFolderId={selectedFolder}
                onSelect={handleFileListSelect}
                selectedItems={selectedItems}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 컨텍스트 메뉴 (우클릭) */}
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
            onClick={() => { setEditingId(contextMenu.folderId!); setEditingType('folder'); setContextMenu(v => ({ ...v, visible: false })); }}
          >✏️ 이름 변경</button>
          <button
            className="w-full px-4 py-2 text-left hover:bg-gray-100 text-red-500"
            onClick={() => { setSelectedFolder(contextMenu.folderId!); setShowDeleteModal(true); setDeletingType('folder'); setContextMenu(v => ({ ...v, visible: false })); }}
          >🗑 삭제</button>
          <button
            className="w-full px-4 py-2 text-left hover:bg-gray-100"
            onClick={() => { setCreateFolderAt(contextMenu.folderId!); setCreateFolderKey(Math.random()); setContextMenu(v => ({ ...v, visible: false })); }}
          >📁 새 폴더</button>
        </div>
      )}
      {/* 이름변경(이미지) 모달 */}
      {editingId && editingType === 'image' && (
        <Modal open={true} onClose={() => setEditingId(null)} title="이미지 이름 변경">
          <input
            value={imageEditName}
            onChange={e => setImageEditName(e.target.value)}
            className="border rounded px-2 py-1"
            autoFocus
            onKeyDown={e => {
              if (e.key === "Enter") handleImageRename();
              if (e.key === "Escape") setEditingId(null);
            }}
          />
          <div className="mt-3 flex gap-2">
            <button onClick={handleImageRename} className="image-explorer-btn">저장</button>
            <button onClick={() => setEditingId(null)} className="image-explorer-btn">취소</button>
          </div>
        </Modal>
      )}
      {/* 이미지 삭제 모달 */}
      {showDeleteModal && deletingType === 'image' && (
        <Modal open={true} onClose={() => { setShowDeleteModal(false); setDeletingType(null); }} title="이미지 삭제">
          <div className="mb-3">
            {selectedItems.length > 1
              ? <>
                  <b>{selectedItems.length}개 이미지</b>를 삭제하시겠습니까?
                  <ul style={{ color: "#888", fontSize: 13 }}>
                    {selectedItems.slice(0, 5).map(item => <li key={item.id}>{item.name}</li>)}
                    {selectedItems.length > 5 && <li>...외 {selectedItems.length - 5}개</li>}
                  </ul>
                </>
              : <>정말 <b>{selectedItems[0]?.name}</b> 이미지를 삭제하시겠습니까?</>
            }
          </div>
          <div className="flex gap-2 justify-end">
            <button className="px-4 py-2 rounded bg-gray-100" onClick={() => { setShowDeleteModal(false); setDeletingType(null); }}>
              취소
            </button>
            <button className="px-4 py-2 rounded bg-red-500 text-white" onClick={handleImageDelete}>
              삭제
            </button>
          </div>
        </Modal>
      )}
      {/* 폴더 삭제 모달 */}
      {showDeleteModal && deletingType === 'folder' && selectedFolder && (
        <Modal open={true} onClose={() => { setShowDeleteModal(false); setDeletingType(null); }} title="폴더 삭제">
          <div className="mb-3">
            <span className="font-semibold text-base">{folders.find(f => f.id === selectedFolder)?.name}</span>
            <br />
            이 폴더와 <b>모든 하위 폴더, 이미지</b>가 완전히 삭제됩니다.<br />
            정말 삭제하시겠습니까?
          </div>
          <div className="flex gap-2 justify-end">
            <button className="px-4 py-2 rounded bg-gray-100" onClick={() => { setShowDeleteModal(false); setDeletingType(null); }}>
              취소
            </button>
            <button className="px-4 py-2 rounded bg-red-500 text-white" onClick={handleDelete}>
              삭제
            </button>
          </div>
        </Modal>
      )}
      {/* 이미지 업로드 모달 */}
      <ImageUploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        folderId={selectedFolder}
        onUploaded={handleImagesUploaded}
      />
    </div>
  );
}
