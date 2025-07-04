import { useState, useEffect } from 'react';
import Modal from "@/components/common/Modal";

export default function DeleteFolder({
  folderId,
  onDeleted,
  disabled = false,
  folderName,
  className,
  open,
  onOpen,
  onClose,
}: {
  folderId: number | null;
  onDeleted?: () => void;
  disabled?: boolean;
  folderName?: string;
  className?: string;
  open?: boolean;            // 외부에서 컨트롤할 수 있게!
  onOpen?: () => void;
  onClose?: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = open !== undefined ? open : internalOpen;

  useEffect(() => {
    if (!isOpen) setLoading(false);
  }, [isOpen]);

  async function handleDelete() {
    if (folderId == null) return;
    setLoading(true);
    const res = await fetch('/api/image/folder/delete', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: folderId }),
    });
    setLoading(false);

    if (res.ok) {
      if (onDeleted) onDeleted();
      if (onClose) onClose();
      setInternalOpen(false);
    } else {
      const data = await res.json();
      alert(data.error || '삭제 실패');
    }
  }

  return (
    <>
      <button
        onClick={() => {
          onOpen ? onOpen() : setInternalOpen(true);
        }}
        className={className ?? "image-explorer-btn danger"}
        disabled={disabled || loading || folderId == null}
        title="폴더 삭제"
      >
        {loading ? '삭제 중...' : '🗑 삭제'}
      </button>
      <Modal open={isOpen} onClose={onClose ? onClose : () => setInternalOpen(false)} title="폴더 삭제 확인">
        <div className="py-2">
          <div className="mb-3 text-base text-gray-800">
            <span className="font-semibold">{folderName || ''}</span> 폴더를 정말 삭제할까요?<br />
            <span className="text-sm text-gray-500">※ 하위 폴더와 이미지도 모두 삭제됩니다.</span>
          </div>
          <div className="flex gap-2 justify-end mt-4">
            <button
              type="button"
              className="px-4 py-2 bg-gray-200 rounded"
              onClick={onClose ? onClose : () => setInternalOpen(false)}
              disabled={loading}
            >
              취소
            </button>
            <button
              type="button"
              className="px-4 py-2 bg-red-600 text-white rounded"
              onClick={handleDelete}
              disabled={loading}
            >
              {loading ? "삭제 중..." : "삭제"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
