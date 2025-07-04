'use client';

import { useEffect, useState } from 'react';
import WikiHeader from "@/components/common/Header";
import CreateFolder from "@/components/image/CreateFolder";
import ImageUploadModal from "@/components/image/ImageUploadModal";
import '@wiki/css/image.css';
import Modal from "@/components/common/Modal";

// 트리 접힘/펼침용 아이콘
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
      const target = folders.find(f => f.id === editingId);
      if (target) setEditName(target.name);
    }
  }, [editingId, folders]);

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
              {depth > 0 &&
                <span
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
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                    marginRight: 2,
                    zIndex: 1,
                  }}
                  tabIndex={-1}
                >
                  <ArrowIcon open={isOpen} />
                </button>
              )}
              {editingId === folder.id ? (
                <input
                  type="text"
                  className="border px-1 py-0.5 rounded text-sm"
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
                  <span role="img" aria-label="folder" style={{ fontSize: 20 }}>📁</span>
                  {folder.name}
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

function FileList({
  images, currentFolderId, onSelect, selectedItems,
}: {
  images: any[], currentFolderId: number | null,
  onSelect: (item: any, e: React.MouseEvent) => void,
  selectedItems: any[]
}) {
  const imgs = images.filter(img => img.folder_id === currentFolderId);

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

export default function ImageManagePage() {
  const [folders, setFolders] = useState<any[]>([]);
  const [images, setImages] = useState<any[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<number | null>(null);

  // === 변경됨 ===
  const [selectedItems, setSelectedItems] = useState<any[]>([]);
  // 단일 이름변경만 유지
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingType, setEditingType] = useState<'folder' | 'image' | null>(null);
  const [imageEditName, setImageEditName] = useState('');
  const [treeState, setTreeState] = useState<Record<number, boolean>>({});
  const [uploadOpen, setUploadOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ visible: boolean, x: number, y: number, folderId: number | null }>({ visible: false, x: 0, y: 0, folderId: null });
  const [deletingType, setDeletingType] = useState<'folder' | 'image' | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // 새 폴더 만들기(컨텍스트 메뉴에서)
  const [createFolderAt, setCreateFolderAt] = useState<number | null>(null);
  // 모달을 강제로 새로 띄우기 위한 리셋 키
  const [createFolderKey, setCreateFolderKey] = useState<number>(0);

  // ===== 내부 함수 =====
  const handleImagesUploaded = () => {
    if (!selectedFolder) return;
    fetch(`/api/image/view?folder_id=${selectedFolder}`)
      .then(res => res.json())
      .then(data => setImages(data));
  }

  // 폴더 목록 API 불러오기
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
    fetch(`/api/image/view?folder_id=${selectedFolder}`)
      .then(res => res.json())
      .then(data => setImages(data));
  }, [selectedFolder]);

  const handleFolderCreated = (folder: any) => {
    setFolders(prev => [...prev, folder]);
    setCreateFolderAt(null); // 무조건 모달 닫기!
  };

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

  // === 다중 이미지 삭제 함수 ===
  const handleImageDelete = async () => {
    if (selectedItems.length === 0) return;
    // API에 id 배열 전달 (한 번에)
    const res = await fetch('/api/image/delete', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: selectedItems.map(i => i.id) }),
    });
    if (res.ok) {
      setImages(prev => prev.filter(img => !selectedItems.find(si => si.id === img.id)));
      setSelectedItems([]);
      setShowDeleteModal(false);
      setDeletingType(null);
    } else {
      alert('삭제 실패');
    }
  };

  // === 단일/다중 이름변경(1개 선택만 허용) ===
  const handleRenameClick = () => {
    // 이미지 1개만 선택된 경우
    if (selectedItems.length === 1 && selectedItems[0].type === 'image') {
      setEditingId(selectedItems[0].id);
      setEditingType('image');
      setImageEditName(selectedItems[0].name);
    } 
    // 이미지가 선택되지 않고 폴더만 선택된 경우
    else if (selectedItems.length === 0 && selectedFolder) {
      setEditingId(selectedFolder);
      setEditingType('folder');
      setContextMenu(v => ({ ...v, visible: false }));
    }
  };

  // === 다중/단일 삭제 컨트롤 ===
  const handleDeleteClick = () => {
    if (selectedItems.length > 0) {
      setShowDeleteModal(true);
      setDeletingType('image');
    } else if (selectedFolder) {
      setShowDeleteModal(true);
      setDeletingType('folder');
    }
  };

  const handleImageRename = async () => {
    if (editingId == null) return;
    const res = await fetch('/api/image/rename', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: editingId, name: imageEditName.trim() }),
    });
    if (res.ok) {
      setImages(prev => prev.map(img =>
        img.id === editingId ? { ...img, name: imageEditName.trim() } : img
      ));
      setEditingId(null);
      setEditingType(null);
    } else {
      alert('이름 변경 실패');
    }
  };

  // 폴더/이미지 다중 선택 핸들러
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

  // 키보드 Delete 지원 (다중)
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

  // 바깥 클릭 등 컨텍스트 메뉴 닫기
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

  return (
    <div className="wiki-container" style={{ background: "#f9f9f9", minHeight: "100vh" }}>
      <WikiHeader user={null} />
      <div style={{ marginTop: 64 }}>
        <div className="image-explorer-layout">
          {/* 좌측: 폴더 탐색기 */}
          <div className="image-explorer-sidebar">
            <div
              className={`flex items-center gap-2 px-2 py-1 rounded mb-2 font-bold
                ${selectedFolder === null ? 'bg-blue-100 border border-blue-400' : ''}`}
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
          {/* 우측: 제목+툴바+이미지 */}
          <div className="image-explorer-content">
            <div className="image-explorer-header-bar">
              <h1 className="image-explorer-title">이미지 업로드/관리</h1>
              <div className="image-explorer-header-btns">
                <CreateFolder
                  parentId={selectedFolder ?? null}
                  onCreated={handleFolderCreated}
                  className="image-explorer-btn"
                />
                {createFolderAt !== null && (
                  <CreateFolder
                    key={createFolderKey + '-' + createFolderAt}
                    parentId={createFolderAt}
                    onCreated={handleFolderCreated}
                    forceOpen={true}
                  />
                )}
                <button
                  type="button"
                  className="image-explorer-btn"
                  onClick={() => setUploadOpen(true)}
                  disabled={!selectedFolder}
                >
                  업로드
                </button>
                <button
                  className="image-explorer-btn danger"
                  onClick={handleDeleteClick}
                  disabled={!selectedFolder && selectedItems.length === 0}
                >
                  🗑 삭제
                </button>
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

      {/* 컨텍스트 메뉴, 모달 등 이하 동일 */}
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
      {/* 이름변경 모달 */}
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
      {/* 이미지 삭제 */}
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
      {/* 폴더 삭제 */}
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
      <ImageUploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        folderId={selectedFolder}
        onUploaded={handleImagesUploaded}
      />
    </div>
  );
}