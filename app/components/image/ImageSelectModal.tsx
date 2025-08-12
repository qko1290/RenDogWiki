// =============================================
// File: app/components/image/ImageSelectModal.tsx
// =============================================
'use client';

import { useEffect, useMemo, useState } from 'react';
import Modal from '@/components/common/Modal';

type Folder = { id: number; name: string; parent_id: number | null };
type ImageFile = { id: number; name: string; url: string; folder_id: number };

type FolderTreeProps = {
  folders: Folder[];
  parentId: number | null;
  selectedId: number | null;
  onSelect: (id: number | null) => void;
  treeState: Record<number, boolean>;
  setTreeState: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
  depth?: number;
};

function FolderTree({
  folders,
  parentId,
  selectedId,
  onSelect,
  treeState,
  setTreeState,
  depth = 0,
}: FolderTreeProps) {
  const list = folders.filter((f) =>
    parentId === null ? f.parent_id == null : Number(f.parent_id) === Number(parentId),
  );
  if (!list.length) return null;

  return (
    <ul style={{ margin: 0, paddingLeft: depth === 0 ? 0 : 12, listStyle: 'none' }}>
      {list.map((folder) => {
        const hasChildren = folders.some((f) => Number(f.parent_id) === Number(folder.id));
        const isOpen = treeState[folder.id] ?? false;
        const isSelected = selectedId === folder.id;

        return (
          <li key={folder.id} style={{ margin: '2px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
              <button
                type="button"
                onClick={() => onSelect(folder.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  width: '100%',
                  justifyContent: 'space-between',
                  borderRadius: 10,
                  padding: '6px 8px',
                  border: '1px solid',
                  borderColor: isSelected ? '#cfe0ff' : 'transparent',
                  background: isSelected ? '#eef5ff' : 'transparent',
                  color: isSelected ? '#1e40af' : '#1f2937',
                  fontWeight: isSelected ? 700 : 500,
                  cursor: 'pointer',
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span role="img" aria-label="folder" style={{ fontSize: 18 }}>
                    📁
                  </span>
                  <span style={{ fontSize: 14.5 }}>{folder.name}</span>
                </span>

                {hasChildren && (
                  <span
                    role="button"
                    aria-label={isOpen ? '접기' : '펼치기'}
                    aria-expanded={isOpen}
                    onClick={(e) => {
                      e.stopPropagation();
                      setTreeState((prev) => {
                        const next = { ...prev, [folder.id]: !isOpen };
                        if (typeof window !== 'undefined') {
                          localStorage.setItem('imgsel.treeState', JSON.stringify(next));
                        }
                        return next;
                      });
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 22,
                      height: 22,
                      borderRadius: 6,
                      color: '#9aa1ad',
                    }}
                  >
                    <span
                      style={{
                        display: 'inline-block',
                        transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                        transition: 'transform .13s',
                        fontSize: 16,
                        lineHeight: 1,
                      }}
                    >
                      ▶
                    </span>
                  </span>
                )}
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
                depth={depth + 1}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}

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
  const [allImages, setAllImages] = useState<ImageFile[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<number | null>(null);
  const [treeState, setTreeState] = useState<Record<number, boolean>>({});
  const [selectedImg, setSelectedImg] = useState<ImageFile | null>(null);
  const [search, setSearch] = useState('');

  const normalizeFolders = (data: any[]): Folder[] =>
    data.map((f) => ({
      id: Number(f.id),
      name: String(f.name),
      parent_id: f.parent_id === null || f.parent_id === undefined ? null : Number(f.parent_id),
    }));

  const normalizeImages = (data: any[]): ImageFile[] =>
    data.map((i) => ({
      id: Number(i.id),
      name: String(i.name),
      url: String(i.url),
      folder_id: Number(i.folder_id),
    }));

  useEffect(() => {
    if (!open) return;

    setSelectedImg(null);
    setSearch('');

    const ts = `?ts=${Date.now()}`;

    fetch('/api/image/folder/list' + ts, { cache: 'no-store' })
      .then((res) => res.json())
      .then((raw) => {
        const data = normalizeFolders(raw);
        setFolders(data);

        if (typeof window !== 'undefined') {
          const savedTree = localStorage.getItem('imgsel.treeState');
          if (savedTree) {
            try {
              const parsed: Record<string, boolean> = JSON.parse(savedTree);
              const cast: Record<number, boolean> = {};
              Object.keys(parsed).forEach((k) => (cast[Number(k)] = !!parsed[k]));
              setTreeState(cast);
            } catch {
              setTreeState({});
            }
          } else {
            // 기본: 전부 닫힘
            setTreeState({});
          }

          const savedSel = localStorage.getItem('imgsel.selectedFolder');
          if (savedSel !== null) {
            if (savedSel === '' || savedSel === 'null') setSelectedFolder(null);
            else {
              const n = Number(savedSel);
              setSelectedFolder(Number.isFinite(n) && n > 0 ? n : null);
            }
          } else {
            setSelectedFolder(null);
          }
        }
      });

    // 전체 이미지 목록(검색용)
    fetch('/api/image/list?all=1' + ts, { cache: 'no-store' })
      .then((res) => res.json())
      .then((raw) => setAllImages(normalizeImages(raw)))
      .catch(() => setAllImages([]));
  }, [open]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('imgsel.selectedFolder', selectedFolder === null ? 'null' : String(selectedFolder));
    }
    setSelectedImg(null);
  }, [selectedFolder]);

  useEffect(() => {
    setSelectedImg(null);
  }, [search]);

  const imagesToShow = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q) {
      return allImages.filter((i) => i.name.toLowerCase().includes(q));
    }
    if (selectedFolder == null) return [];
    return allImages.filter((i) => Number(i.folder_id) === Number(selectedFolder));
  }, [allImages, selectedFolder, search]);

  const handleInsert = () => {
    if (!selectedImg) return;
    onSelectImage(selectedImg.url, selectedImg.name, selectedImg);
    onClose();
  };

  if (!open) return null;

  return (
    <Modal open={open} onClose={onClose}>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          display: 'grid',
          placeItems: 'center',
          pointerEvents: 'none',
          zIndex: 1,
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label="이미지 선택"
          style={{
            pointerEvents: 'auto',
            width: 780,
            maxWidth: 'calc(100vw - 40px)',
            maxHeight: 'calc(100vh - 80px)',
            overflow: 'hidden',
            background: '#fff',
            borderRadius: 20,
            boxShadow: '0 24px 40px rgba(0,0,0,.12)',
            display: 'grid',
            gridTemplateRows: 'auto 1fr auto',
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '14px 16px',
              borderBottom: '1px solid #f0f2f6',
            }}
          >
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#111827' }}>
              이미지 선택
            </h3>

            <div style={{ marginLeft: 'auto', width: 280 }}>
              <div style={{ position: 'relative' }}>
                <input
                  placeholder="이미지 이름 검색"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{
                    width: '100%',
                    height: 34,
                    padding: '0 30px 0 10px',
                    borderRadius: 8,
                    border: '1px solid #e5e7eb',
                    background: '#fcfcfd',
                    fontSize: 14,
                  }}
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    aria-label="검색어 지우기"
                    style={{
                      position: 'absolute',
                      right: 6,
                      top: 6,
                      width: 22,
                      height: 22,
                      borderRadius: 6,
                      border: 'none',
                      background: '#eef2f7',
                      cursor: 'pointer',
                      fontSize: 12,
                      color: '#6b7280',
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="닫기"
              style={{
                marginLeft: 8,
                width: 32,
                height: 32,
                borderRadius: 8,
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <svg height="18" viewBox="0 0 384 512">
                <path
                  d="M342.6 150.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L192 210.7 86.6 105.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L146.7 256 41.4 361.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L192 301.3 297.4 406.6c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L237.3 256 342.6 150.6z"
                  fill="#9aa4b2"
                />
              </svg>
            </button>
          </div>

          <div
            style={{
              display: 'flex',
              width: '100%',
              height: 420,
              maxHeight: 'calc(100vh - 180px)',
            }}
          >
            <aside
              style={{
                width: 230,
                borderRight: '1px solid #edf0f5',
                padding: 10,
                overflowY: 'auto',
              }}
            >
              <div
                className={'folder-btn' + (selectedFolder === null ? ' active bg-blue-100' : '')}
                onClick={() => setSelectedFolder(null)}
                style={{
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 8px',
                  borderRadius: 10,
                }}
              >
                <span>📂</span> RDWIKI
              </div>

              <FolderTree
                folders={folders}
                parentId={null}
                selectedId={selectedFolder}
                onSelect={(id) => setSelectedFolder(id)}
                treeState={treeState}
                setTreeState={setTreeState}
              />
            </aside>

            <section
              style={{
                flex: 1,
                padding: 12,
                overflowY: 'auto',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))',
                gridAutoRows: '110px',
                gap: 12,
                alignContent: 'start',
                background: '#fff',
              }}
            >
              {imagesToShow.length === 0 && (
                <div style={{ color: '#9aa1ad', margin: '40px auto' }}>
                  {search.trim() ? '검색 결과가 없습니다' : '이 폴더에 이미지 없음'}
                </div>
              )}

              {imagesToShow.map((img) => {
                const selected = selectedImg?.id === img.id;
                return (
                  <button
                    key={img.id}
                    onClick={() => setSelectedImg(img)}
                    onDoubleClick={handleInsert}
                    title={img.name}
                    style={{
                      position: 'relative',
                      width: '100%',
                      height: '100%',
                      aspectRatio: '1 / 1',
                      borderRadius: 12,
                      border: selected ? '2px solid #4a90e2' : '1px solid #e6eaf0',
                      background: selected ? '#f6faff' : '#fbfcfd',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: selected
                        ? '0 2px 10px rgba(74,144,226,.15)'
                        : '0 1px 2px rgba(16,24,40,.05)',
                      overflow: 'hidden',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    <img
                      src={img.url}
                      alt={img.name}
                      style={{
                        width: 88,
                        height: 88,
                        borderRadius: 8,
                        objectFit: 'contain',
                        background: '#fff',
                      }}
                    />
                    {selected && (
                      <span
                        style={{
                          position: 'absolute',
                          top: 6,
                          right: 6,
                          width: 22,
                          height: 22,
                          borderRadius: 999,
                          background: '#4a90e2',
                          color: '#fff',
                          fontSize: 14,
                          fontWeight: 800,
                          display: 'grid',
                          placeItems: 'center',
                          boxShadow: '0 1px 4px rgba(0,0,0,.18)',
                        }}
                      >
                        ✓
                      </span>
                    )}
                  </button>
                );
              })}
            </section>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px 16px 16px',
              borderTop: '1px solid #f0f2f6',
              background: '#fff',
            }}
          >
            <div style={{ flex: 1, minHeight: 38 }}>
              {selectedImg && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <img
                    src={selectedImg.url}
                    alt={selectedImg.name}
                    style={{
                      height: 38,
                      width: 38,
                      objectFit: 'cover',
                      borderRadius: 8,
                      border: '1px solid #e6eaf0',
                      background: '#fafafa',
                    }}
                  />
                  <span style={{ color: '#374151', fontSize: 14, fontWeight: 600 }}>
                    {selectedImg.name}
                  </span>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handleInsert}
              disabled={!selectedImg}
              style={{
                minWidth: 100,
                height: 40,
                padding: '0 16px',
                borderRadius: 10,
                border: '1px solid transparent',
                fontWeight: 800,
                background: selectedImg ? '#2357b2' : '#e9eef6',
                color: selectedImg ? '#fff' : '#90a3bf',
                cursor: selectedImg ? 'pointer' : 'not-allowed',
              }}
              onMouseDown={(e) => {
                if (!selectedImg) return;
                (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(1px)';
              }}
              onMouseUp={(e) => {
                (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
              }}
            >
              삽입
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
