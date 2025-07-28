// =============================================
// File: app/components/image/ImageSelectModal.tsx
// =============================================
/**
 * 이미지 선택 모달(폴더 트리 + 썸네일 리스트)
 * - 폴더 트리로 탐색/선택, 썸네일 클릭/더블클릭으로 이미지 선택/삽입
 * - 선택시 onSelectImage(url, name, row) 호출
 */

import { useEffect, useState } from 'react';
import Modal from '@/components/common/Modal';

// 폴더 타입
type Folder = {
  id: number;
  name: string;
  parent_id: number | null;
};

// 이미지 타입
type ImageFile = {
  id: number;
  name: string;
  url: string;
  folder_id: number;
};

// 폴더 트리 컴포넌트 props
type FolderTreeProps = {
  folders: Folder[];
  parentId: number | null;
  selectedId: number | null;
  onSelect: (id: number | null) => void;
  treeState: Record<number, boolean>;
  setTreeState: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
};

/** 
 * 폴더 트리(재귀)
 * - 하위 폴더 구조로 출력, 클릭시 선택/트리 확장
 */
function FolderTree({ folders, parentId, selectedId, onSelect, treeState, setTreeState }: FolderTreeProps) {
  const list = folders.filter(f => (parentId === null ? f.parent_id == null : Number(f.parent_id) === Number(parentId)));
  if (list.length === 0) return null;

  return (
    <ul style={{ paddingLeft: parentId === null ? 0 : 14 }}>
      {list.map(folder => {
        const hasChildren = folders.some(f => f.parent_id === folder.id);
        const isOpen = treeState[folder.id] ?? true;
        return (
          <li key={folder.id}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              {hasChildren && (
                <button
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginRight: 2 }}
                  onClick={e => {
                    e.stopPropagation();
                    setTreeState(prev => ({ ...prev, [folder.id]: !isOpen }));
                  }}
                  tabIndex={-1}
                >
                  <span style={{
                    display: 'inline-block', transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                    transition: 'transform 0.13s', fontSize: 16, color: '#bbb'
                  }}>▶</span>
                </button>
              )}
              <button
                style={{
                  background: selectedId === folder.id ? '#eaf2ff' : 'none',
                  border: 'none', cursor: 'pointer', padding: '2px 6px', borderRadius: 6,
                  fontWeight: selectedId === folder.id ? 600 : 400,
                  color: selectedId === folder.id ? '#2357b2' : '#222',
                  fontSize: 15
                }}
                onClick={() => onSelect(folder.id)}
              >
                <span role="img" aria-label="folder" style={{ fontSize: 19, marginRight: 2 }}>📁</span>
                {folder.name}
              </button>
            </div>
            {hasChildren && isOpen && (
              <FolderTree
                folders={folders}
                parentId={folder.id}
                selectedId={selectedId}
                onSelect={onSelect}
                treeState={treeState}
                setTreeState={setTreeState}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * 이미지 선택 모달 (폴더 + 썸네일)
 */
export default function ImageSelectModal({
  open,
  onClose,
  onSelectImage,
}: {
  open: boolean;
  onClose: () => void;
  onSelectImage: (url: string, name: string, row: ImageFile) => void;
}) {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [images, setImages] = useState<ImageFile[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<number | null>(null);
  const [treeState, setTreeState] = useState<Record<number, boolean>>({});
  const [selectedImg, setSelectedImg] = useState<ImageFile | null>(null);

  // 폴더 목록 fetch
  useEffect(() => {
    if (open) {
      fetch('/api/image/folder/list')
        .then(res => res.json())
        .then(setFolders);
    }
  }, [open]);

  // 폴더 선택시 이미지 목록 fetch
  useEffect(() => {
    if (selectedFolder) {
      fetch(`/api/image/view?folder_id=${selectedFolder}`)
        .then(res => res.json())
        .then(setImages);
    } else {
      setImages([]);
    }
    setSelectedImg(null);
  }, [selectedFolder]);

  // 썸네일 클릭시 선택
  const handleThumbClick = (img: ImageFile) => setSelectedImg(img);

  // 삽입 버튼
  const handleInsert = () => {
    if (!selectedImg) return;
    onSelectImage(selectedImg.url, selectedImg.name, selectedImg);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="이미지 선택">
      <div style={{ display: 'flex', width: 640, height: 350 }}>
        {/* 좌: 폴더 */}
        <div style={{ width: 180, borderRight: '1.5px solid #eee', padding: 8, overflowY: 'auto' }}>
          <FolderTree
            folders={folders}
            parentId={null}
            selectedId={selectedFolder}
            onSelect={id => setSelectedFolder(id)}
            treeState={treeState}
            setTreeState={setTreeState}
          />
        </div>
        {/* 우: 썸네일 */}
        <div style={{ flex: 1, padding: 8, overflowY: 'auto', display: 'flex', flexWrap: 'wrap', gap: 14 }}>
          {images.length === 0 && <div style={{ color: "#bbb", margin: "40px auto" }}>이 폴더에 이미지 없음</div>}
          {images.map(img =>
            <div
              key={img.id}
              style={{
                border: selectedImg?.id === img.id ? '2px solid #4a90e2' : '1.5px solid #e5e5e5',
                borderRadius: 12,
                background: selectedImg?.id === img.id ? '#f6faff' : '#f8f9fa',
                width: 92, height: 92, display: 'flex',
                alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                boxShadow: selectedImg?.id === img.id ? '0 0 6px #4a90e230' : undefined
              }}
              title={img.name}
              onClick={() => handleThumbClick(img)}
              tabIndex={0}
              onDoubleClick={handleInsert}
            >
              <img src={img.url} alt={img.name} style={{ maxWidth: '88px', maxHeight: '88px', borderRadius: 8, objectFit: 'contain' }} />
            </div>
          )}
        </div>
      </div>
      {/* 미리보기, 삽입 버튼 */}
      <div style={{ marginTop: 18, display: 'flex', alignItems: 'center', gap: 18 }}>
        <div style={{ flex: 1, minHeight: 38 }}>
          {selectedImg &&
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <img src={selectedImg.url} alt={selectedImg.name} style={{ height: 38, borderRadius: 7, border: '1px solid #ddd', background: '#fafafa' }} />
              <span style={{ color: '#444', fontSize: 14 }}>{selectedImg.name}</span>
            </div>
          }
        </div>
        <button
          className="editor-toolbar-btn"
          style={{ fontWeight: 600, background: '#2357b2', color: 'white', borderRadius: 7, fontSize: 16, minWidth: 88, height: 38 }}
          disabled={!selectedImg}
          onClick={handleInsert}
        >
          삽입
        </button>
      </div>
    </Modal>
  );
}
