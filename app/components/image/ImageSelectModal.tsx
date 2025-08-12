/**
 * 이미지 선택 모달(세련된 버전, 이미지 모달 전용 카드 포함)
 * - 공용 Modal은 오버레이(배경 딤)만 사용
 * - 카드(흰 배경 / 그림자 / 라운드)와 중앙 정렬은 이 컴포넌트에서 처리
 * - 폴더 트리: 오른쪽 화살표(접기/펼치기), 행 클릭으로 선택
 * - 썸네일: 클릭 선택, 더블클릭 시 즉시 삽입
 * - ✅ 최근 사용 경로 복원(localStorage) + 타입 정규화 + 숫자 비교 자식 감지
 */

'use client';

import { useEffect, useState } from 'react';
import Modal from '@/components/common/Modal';

type Folder = {
  id: number;
  name: string;
  parent_id: number | null;
};

type ImageFile = {
  id: number;
  name: string;
  url: string;
  folder_id: number;
};

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
  const list = folders.filter(f =>
    parentId === null ? f.parent_id == null : Number(f.parent_id) === Number(parentId)
  );
  if (list.length === 0) return null;

  return (
    <ul style={{ margin: 0, paddingLeft: depth === 0 ? 0 : 12, listStyle: 'none' }}>
      {list.map(folder => {
        // ✅ 숫자 비교로 자식 감지
        const hasChildren = folders.some(f => Number(f.parent_id) === Number(folder.id));
        const isOpen = treeState[folder.id] ?? false;

        const rowBase: React.CSSProperties = {
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          width: '100%',
          borderRadius: 10,
          padding: '6px 8px',
          border: '1px solid transparent',
          background: selectedId === folder.id ? '#eef5ff' : 'transparent',
          color: selectedId === folder.id ? '#1e40af' : '#1f2937',
          fontWeight: selectedId === folder.id ? 700 : 500,
          cursor: 'pointer',
          transition: 'background .12s, border-color .12s, box-shadow .12s',
        };

        return (
          <li key={folder.id} style={{ margin: '2px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
              {/* 행 전체 클릭으로 선택 */}
              <button
                type="button"
                onClick={() => onSelect(folder.id)}
                style={{
                  ...rowBase,
                  justifyContent: 'space-between',
                  borderColor: selectedId === folder.id ? '#cfe0ff' : 'transparent',
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span role="img" aria-label="folder" style={{ fontSize: 18 }}>📁</span>
                  <span style={{ fontSize: 14.5 }}>{folder.name}</span>
                </span>

                {/* 오른쪽 화살표(자식 있을 때만) */}
                {hasChildren && (
                  <span
                    role="button"
                    aria-label={isOpen ? '접기' : '펼치기'}
                    aria-expanded={isOpen}
                    onClick={(e) => {
                      e.stopPropagation();
                      setTreeState(prev => {
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
                      transition: 'background .12s, transform .12s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#f3f4f6')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
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

            {/* 자식 트리 */}
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
  const [images, setImages] = useState<ImageFile[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<number | null>(null);
  const [treeState, setTreeState] = useState<Record<number, boolean>>({});
  const [selectedImg, setSelectedImg] = useState<ImageFile | null>(null);

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

    // ✅ 폴더 로드 + 최근 트리/선택 복원
    fetch('/api/image/folder/list')
      .then(res => res.json())
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
              // 루트만 오픈
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

          const savedSel = localStorage.getItem('imgsel.selectedFolder');
          if (savedSel !== null) {
            const v = Number(savedSel);
            setSelectedFolder(Number.isFinite(v) ? v : null);
          } else {
            setSelectedFolder(null);
          }
        }
      });
  }, [open]);

  useEffect(() => {
    if (selectedFolder) {
      fetch(`/api/image/view?folder_id=${selectedFolder}`)
        .then(res => res.json())
        .then((raw) => setImages(normalizeImages(raw)));
    } else {
      setImages([]);
    }
    setSelectedImg(null);

    if (typeof window !== 'undefined') {
      localStorage.setItem('imgsel.selectedFolder', selectedFolder === null ? '' : String(selectedFolder));
    }
  }, [selectedFolder]);

  const handleThumbClick = (img: ImageFile) => setSelectedImg(img);

  const handleInsert = () => {
    if (!selectedImg) return;
    onSelectImage(selectedImg.url, selectedImg.name, selectedImg);
    onClose();
  };

  return (
    // 공용 Modal: 오버레이(딤) + 외부 클릭 닫기만 활용 (title은 전달하지 않음)
    <Modal open={open} onClose={onClose}>
      {/* ✨ 이미지 모달 전용 카드(흰 배경) + 중앙 정렬 */}
      <div
        style={{
          position: 'fixed', inset: 0,
          display: 'grid', placeItems: 'center',
          pointerEvents: 'none',           // 바깥 클릭은 오버레이가 처리
          zIndex: 1,                       // 오버레이 위
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label="이미지 선택"
          style={{
            pointerEvents: 'auto',
            width: 760,
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
          {/* 헤더 */}
          <div
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '16px 18px', borderBottom: '1px solid #f0f2f6',
            }}
          >
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#111827' }}>
              이미지 선택
            </h3>
            <button
              type="button"
              onClick={onClose}
              aria-label="닫기"
              style={{
                marginLeft: 'auto',
                width: 32, height: 32, borderRadius: 8,
                border: 'none', background: 'transparent', cursor: 'pointer',
                display: 'grid', placeItems: 'center',
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

          {/* 본문 */}
          <div
            style={{
              display: 'flex',
              width: '100%',
              height: 420,
              maxHeight: 'calc(100vh - 180px)',
            }}
          >
            {/* 좌: 폴더 트리 */}
            <aside
              style={{
                width: 230,
                borderRight: '1px solid #edf0f5',
                padding: 10,
                overflowY: 'auto',
              }}
            >
              <FolderTree
                folders={folders}
                parentId={null}
                selectedId={selectedFolder}
                onSelect={(id) => setSelectedFolder(id)}
                treeState={treeState}
                setTreeState={setTreeState}
              />
            </aside>

            {/* 우: 썸네일 그리드 */}
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
              {images.length === 0 && (
                <div style={{ color: '#9aa1ad', margin: '40px auto' }}>이 폴더에 이미지 없음</div>
              )}

              {images.map(img => {
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
                      boxShadow: selected ? '0 2px 10px rgba(74,144,226,.15)' : '0 1px 2px rgba(16,24,40,.05)',
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

          {/* 푸터: 미리보기 + 액션 */}
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
                transition: 'filter .12s, transform .06s',
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
